-- Real account lifecycle and scoped multi-role assignments for the dashboard.
-- Academic write access deliberately remains separate from these assignments.

insert into public.organizations (name, slug, metadata)
values (
  'Universitas Diponegoro · S-1 Informatika',
  'informatika-undip',
  '{"source":"if.undip.ac.id","scope":"program_study"}'::jsonb
)
on conflict (slug) do nothing;

alter table public.profiles
  drop constraint if exists profiles_status_check;
alter table public.profiles
  alter column status set default 'invited';
alter table public.profiles
  add column if not exists archived_at timestamptz;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('invited', 'active', 'suspended', 'archived'));

create unique index if not exists profiles_email_normalized_unique_idx
  on public.profiles (lower(email))
  where length(trim(email)) > 0;

create table if not exists public.user_role_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('kaprodi', 'gpm', 'dosen', 'mahasiswa')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, role)
);

create index if not exists user_role_assignments_user_idx
  on public.user_role_assignments (user_id, organization_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text := case
    when new.email_confirmed_at is null then 'invited'
    else 'active'
  end;
begin
  insert into public.profiles (id, email, display_name, status)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    next_status
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when tg_op = 'INSERT' then coalesce(excluded.display_name, public.profiles.display_name)
          else public.profiles.display_name
        end,
        status = case
          when public.profiles.status in ('suspended', 'archived') then public.profiles.status
          else excluded.status
        end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, email_confirmed_at on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and exists (
    select 1
    from public.platform_roles
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and (
    public.is_superadmin() or exists (
      select 1
      from public.organization_members
      where organization_id = target_organization_id and user_id = auth.uid()
    )
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated, service_role;

alter table public.user_role_assignments enable row level security;
revoke all on table public.user_role_assignments from anon, authenticated;
grant select on table public.user_role_assignments to authenticated;
grant all on table public.user_role_assignments to service_role;

drop policy if exists user_role_assignments_read_authorized on public.user_role_assignments;
create policy user_role_assignments_read_authorized on public.user_role_assignments
for select to authenticated
using (public.is_active_user() and (user_id = auth.uid() or public.is_superadmin()));

-- Existing member-wide ALL policies were unsafe once normal accounts existed.
-- Browser clients may read legacy membership data; all writes stay behind trusted
-- server commands until course assignments and workflow-specific policies land.
drop policy if exists courses_member_all on public.courses;
drop policy if exists courses_member_select on public.courses;
create policy courses_member_select on public.courses
for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists rps_documents_member_all on public.rps_documents;
drop policy if exists rps_documents_member_select on public.rps_documents;
create policy rps_documents_member_select on public.rps_documents
for select to authenticated
using (public.is_org_member(organization_id));

create or replace function public.admin_apply_user_access(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_organization_id uuid,
  p_display_name text,
  p_status text,
  p_roles text[],
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := nullif(regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), '');
  normalized_roles text[] := coalesce(p_roles, '{}'::text[]);
  legacy_membership_snapshot jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    join public.platform_roles pr on pr.user_id = p.id and pr.role = 'superadmin'
    where p.id = p_actor_user_id and p.status = 'active'
  ) then
    raise exception 'active_superadmin_required' using errcode = '42501';
  end if;

  if p_actor_user_id = p_target_user_id then
    raise exception 'self_management_forbidden' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.platform_roles
    where user_id = p_target_user_id and role = 'superadmin'
  ) then
    raise exception 'protected_platform_admin' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'managed_user_not_found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'managed_organization_not_found' using errcode = 'P0002';
  end if;

  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if p_status not in ('invited', 'active', 'suspended', 'archived') then
    raise exception 'invalid_account_status' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(normalized_roles) as selected_role
    where selected_role not in ('kaprodi', 'gpm', 'dosen', 'mahasiswa')
  ) then
    raise exception 'invalid_application_role' using errcode = '22023';
  end if;

  if p_status <> 'archived' and cardinality(normalized_roles) = 0 then
    raise exception 'application_role_required' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = normalized_name,
      status = p_status,
      created_by = coalesce(created_by, p_actor_user_id),
      archived_at = case when p_status = 'archived' then coalesce(archived_at, now()) else null end,
      updated_at = now()
  where id = p_target_user_id;

  if p_status = 'archived' then
    delete from public.user_role_assignments
    where user_id = p_target_user_id;
  else
    delete from public.user_role_assignments
    where organization_id = p_organization_id and user_id = p_target_user_id;
  end if;

  select jsonb_agg(jsonb_build_object(
    'organization_id', organization_id,
    'role', role
  ) order by organization_id)
  into legacy_membership_snapshot
  from public.organization_members
  where user_id = p_target_user_id
    and (p_status = 'archived' or organization_id = p_organization_id);

  -- Legacy membership is never silently retained after the Admin explicitly
  -- manages this account. New dashboard roles do not imply academic rights.
  if p_status = 'archived' then
    delete from public.organization_members
    where user_id = p_target_user_id;
  else
    delete from public.organization_members
    where organization_id = p_organization_id and user_id = p_target_user_id;
  end if;

  if p_status <> 'archived' then
    insert into public.user_role_assignments (organization_id, user_id, role, granted_by)
    select p_organization_id, p_target_user_id, selected_role, p_actor_user_id
    from (select distinct unnest(normalized_roles) as selected_role) roles;
  end if;

  insert into public.audit_logs (actor_user_id, target_user_id, action, metadata)
  values (
    p_actor_user_id,
    p_target_user_id,
    p_action,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'organization_id', p_organization_id,
      'status', p_status,
      'roles', normalized_roles,
      'revoked_legacy_memberships', legacy_membership_snapshot
    ))
  );
end;
$$;

revoke all on function public.admin_apply_user_access(
  uuid, uuid, uuid, text, text, text[], text, jsonb
) from public, anon, authenticated;
grant execute on function public.admin_apply_user_access(
  uuid, uuid, uuid, text, text, text[], text, jsonb
) to service_role;

comment on table public.user_role_assignments is
  'Scoped additive dashboard roles. These rows do not grant legacy academic table membership.';
comment on function public.admin_apply_user_access(
  uuid, uuid, uuid, text, text, text[], text, jsonb
) is 'Atomic trusted command for account profile, scoped roles, lifecycle status, and audit.';
