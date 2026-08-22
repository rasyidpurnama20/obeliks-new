create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_user_id, created_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, email, display_name)
select
  id,
  coalesce(email, ''),
  nullif(trim(coalesce(raw_user_meta_data ->> 'display_name', '')), '')
from auth.users
on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      updated_at = now();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  select public.is_superadmin() or exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.platform_roles enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.platform_roles from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.platform_roles to authenticated;
grant select on table public.audit_logs to authenticated;
grant all on table public.profiles to service_role;
grant all on table public.platform_roles to service_role;
grant all on table public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated, service_role;

drop policy if exists profiles_read_authorized on public.profiles;
create policy profiles_read_authorized on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_superadmin());

drop policy if exists platform_roles_read_authorized on public.platform_roles;
create policy platform_roles_read_authorized on public.platform_roles
for select to authenticated
using (user_id = auth.uid() or public.is_superadmin());

drop policy if exists audit_logs_superadmin_read on public.audit_logs;
create policy audit_logs_superadmin_read on public.audit_logs
for select to authenticated
using (public.is_superadmin());

comment on table public.profiles is 'Application identity and lifecycle data linked one-to-one with auth.users.';
comment on table public.platform_roles is 'Global platform roles; organization roles remain in organization_members.';
comment on table public.audit_logs is 'Immutable security and administration event trail written by trusted server code.';
