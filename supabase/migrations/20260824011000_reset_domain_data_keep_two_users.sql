-- Clean-slate reset requested for the current MVP.
-- IAM is deliberately preserved: auth.users, profiles, platform_roles, and
-- user_role_assignments remain intact so the two accounts visible in
-- Pengguna & Akses survive the reset.
--
-- Safety: production mutation aborts unless the database has exactly two auth
-- users at execution time. This prevents an accidental destructive reset after
-- additional real users have been onboarded.

do $$
declare
  auth_user_count integer;
  managed_org_count integer;
begin
  select count(*) into auth_user_count from auth.users;
  if auth_user_count <> 2 then
    raise exception 'domain_reset_aborted_expected_exactly_2_auth_users_found_%', auth_user_count;
  end if;

  select count(*) into managed_org_count
  from public.organizations
  where slug = 'informatika-undip';
  if managed_org_count <> 1 then
    raise exception 'domain_reset_aborted_default_organization_missing_or_duplicated';
  end if;
end $$;

-- Domain / workflow data only. Identity and role-assignment tables are excluded.
truncate table
  public.document_chunks,
  public.document_jobs,
  public.rps_documents,
  public.class_lecturers,
  public.class_offerings,
  public.clo_plo_mappings,
  public.course_learning_outcomes,
  public.curriculum_courses,
  public.knowledge_groups,
  public.program_learning_outcomes,
  public.graduate_profiles,
  public.academic_stages,
  public.academic_periods,
  public.curricula,
  public.academic_programs,
  public.courses,
  public.organization_members,
  public.audit_logs
restart identity cascade;

-- Keep the technical authorization tenant required by Pengguna & Akses.
-- Any extra tenant is removed; its scoped role assignments cascade away while
-- the underlying auth/profile accounts remain untouched.
delete from public.organizations
where slug <> 'informatika-undip';

update public.organizations
set metadata = '{}'::jsonb
where slug = 'informatika-undip';

-- Explicit postconditions: the reset must never remove the two identities.
do $$
declare
  auth_user_count integer;
  profile_count integer;
begin
  select count(*) into auth_user_count from auth.users;
  select count(*) into profile_count
  from public.profiles p
  where exists (select 1 from auth.users u where u.id = p.id);

  if auth_user_count <> 2 or profile_count <> 2 then
    raise exception 'domain_reset_identity_postcondition_failed_auth_%_profiles_%', auth_user_count, profile_count;
  end if;
end $$;
