-- Formal academic context for OBELIKS.
-- `organizations` remains the authorization/tenant boundary. The tables below
-- model the academic hierarchy, curriculum, periods, stages, and class offerings
-- explicitly instead of storing them inside organizations.metadata.

create table if not exists public.academic_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  university_name text not null check (char_length(trim(university_name)) between 2 and 160),
  faculty_name text not null check (char_length(trim(faculty_name)) between 2 and 160),
  department_name text not null check (char_length(trim(department_name)) between 2 and 160),
  program_name text not null check (char_length(trim(program_name)) between 2 and 160),
  program_code text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  academic_program_id uuid not null references public.academic_programs(id) on delete cascade,
  code text not null,
  name text not null,
  start_year smallint check (start_year is null or start_year between 1900 and 2200),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_program_id, code)
);

create unique index if not exists curricula_one_active_per_program_idx
  on public.curricula (academic_program_id)
  where status = 'active';

create table if not exists public.graduate_profiles (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  code text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, code)
);

create table if not exists public.program_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  code text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, code)
);

create table if not exists public.knowledge_groups (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, code)
);

create table if not exists public.curriculum_courses (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  knowledge_group_id uuid references public.knowledge_groups(id) on delete set null,
  legacy_course_id uuid references public.courses(id) on delete set null,
  code text not null,
  name text not null,
  credits numeric(4,1) not null default 0 check (credits >= 0 and credits <= 30),
  recommended_semester smallint check (recommended_semester is null or recommended_semester between 1 and 14),
  description text,
  is_available_for_reoffer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, code)
);

create table if not exists public.course_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  curriculum_course_id uuid not null references public.curriculum_courses(id) on delete cascade,
  code text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_course_id, code)
);

create table if not exists public.clo_plo_mappings (
  clo_id uuid not null references public.course_learning_outcomes(id) on delete cascade,
  plo_id uuid not null references public.program_learning_outcomes(id) on delete cascade,
  contribution smallint not null default 1 check (contribution between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (clo_id, plo_id)
);

create table if not exists public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  academic_program_id uuid not null references public.academic_programs(id) on delete cascade,
  primary_curriculum_id uuid references public.curricula(id) on delete set null,
  label text not null,
  term text not null check (term in ('Gasal', 'Genap', 'Pendek', 'Lainnya')),
  academic_year text not null,
  starts_at date not null,
  ends_at date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  late_modification_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at <= ends_at),
  unique (academic_program_id, label)
);

create unique index if not exists academic_periods_one_active_per_program_idx
  on public.academic_periods (academic_program_id)
  where status = 'active';
create unique index if not exists academic_periods_one_draft_per_program_idx
  on public.academic_periods (academic_program_id)
  where status = 'draft';

create table if not exists public.academic_stages (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  stage_key text not null,
  title text not null,
  starts_at date not null,
  ends_at date not null,
  access_roles text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at <= ends_at),
  unique (academic_period_id, stage_key)
);

create table if not exists public.class_offerings (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  curriculum_course_id uuid not null references public.curriculum_courses(id) on delete restrict,
  section_number integer not null check (section_number >= 1 and section_number <= 702),
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_period_id, curriculum_course_id, section_number)
);

create table if not exists public.class_lecturers (
  class_offering_id uuid not null references public.class_offerings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  lecturer_order integer not null default 1 check (lecturer_order >= 1),
  assignment_role text not null default 'member' check (assignment_role in ('coordinator', 'member')),
  created_at timestamptz not null default now(),
  primary key (class_offering_id, user_id)
);

create index if not exists academic_periods_program_status_idx
  on public.academic_periods (academic_program_id, status, starts_at desc);
create index if not exists academic_stages_period_idx
  on public.academic_stages (academic_period_id, sort_order);
create index if not exists curricula_program_idx
  on public.curricula (academic_program_id, status, start_year desc nulls last);
create index if not exists curriculum_courses_curriculum_idx
  on public.curriculum_courses (curriculum_id, code);
create index if not exists class_offerings_period_idx
  on public.class_offerings (academic_period_id, curriculum_course_id, section_number);
create index if not exists class_lecturers_user_idx
  on public.class_lecturers (user_id, class_offering_id);

-- These records are intentionally server-mediated. Browser clients receive the
-- shaped data from authenticated server actions, while service_role performs
-- validated mutations after checking Superadmin/Kaprodi scope.
alter table public.academic_programs enable row level security;
alter table public.curricula enable row level security;
alter table public.graduate_profiles enable row level security;
alter table public.program_learning_outcomes enable row level security;
alter table public.knowledge_groups enable row level security;
alter table public.curriculum_courses enable row level security;
alter table public.course_learning_outcomes enable row level security;
alter table public.clo_plo_mappings enable row level security;
alter table public.academic_periods enable row level security;
alter table public.academic_stages enable row level security;
alter table public.class_offerings enable row level security;
alter table public.class_lecturers enable row level security;

revoke all on public.academic_programs, public.curricula, public.graduate_profiles,
  public.program_learning_outcomes, public.knowledge_groups, public.curriculum_courses,
  public.course_learning_outcomes, public.clo_plo_mappings, public.academic_periods,
  public.academic_stages, public.class_offerings, public.class_lecturers
from anon, authenticated;

grant all on public.academic_programs, public.curricula, public.graduate_profiles,
  public.program_learning_outcomes, public.knowledge_groups, public.curriculum_courses,
  public.course_learning_outcomes, public.clo_plo_mappings, public.academic_periods,
  public.academic_stages, public.class_offerings, public.class_lecturers
to service_role;

-- Keep updated_at consistent with the existing core helper.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_programs','curricula','graduate_profiles','program_learning_outcomes',
    'knowledge_groups','curriculum_courses','course_learning_outcomes','academic_periods',
    'academic_stages','class_offerings'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Formalize the existing S1 Informatika authorization scope without inventing a
-- second tenant. This row can be edited later through Kelola Institusi.
insert into public.academic_programs (
  organization_id, university_name, faculty_name, department_name, program_name, program_code
)
select
  o.id,
  'Universitas Diponegoro',
  'Fakultas Sains dan Matematika',
  'Departemen Informatika',
  'S1 Informatika',
  'S1-INF'
from public.organizations o
where o.slug = 'informatika-undip'
on conflict (organization_id) do nothing;

-- A migration baseline preserves every existing course. The label deliberately
-- says Baseline so no unverified curriculum year is asserted.
insert into public.curricula (academic_program_id, code, name, status, notes)
select ap.id, 'BASELINE', 'Kurikulum Baseline', 'active',
  'Hasil migrasi awal dari master mata kuliah OBELIKS; lengkapi identitas kurikulum sebelum dipublikasikan.'
from public.academic_programs ap
join public.organizations o on o.id = ap.organization_id
where o.slug = 'informatika-undip'
on conflict (academic_program_id, code) do nothing;

insert into public.curriculum_courses (
  curriculum_id, legacy_course_id, code, name, credits, recommended_semester, description
)
select c.id, old.id, old.code, old.name, coalesce(old.credits, 0), old.semester, null
from public.curricula c
join public.academic_programs ap on ap.id = c.academic_program_id
join public.organizations o on o.id = ap.organization_id and o.slug = 'informatika-undip'
join public.courses old on old.organization_id = o.id
where c.code = 'BASELINE'
on conflict (curriculum_id, code) do nothing;

-- Per the current application state there is one current period. Future periods
-- are created explicitly as Draft and previous periods become Closed.
insert into public.academic_periods (
  academic_program_id, primary_curriculum_id, label, term, academic_year,
  starts_at, ends_at, status
)
select ap.id, c.id, 'Gasal 2026/2027', 'Gasal', '2026/2027',
  date '2026-08-17', date '2026-12-19', 'active'
from public.academic_programs ap
join public.organizations o on o.id = ap.organization_id and o.slug = 'informatika-undip'
left join public.curricula c on c.academic_program_id = ap.id and c.status = 'active'
where not exists (
  select 1 from public.academic_periods p where p.academic_program_id = ap.id
);

insert into public.academic_stages (
  academic_period_id, stage_key, title, starts_at, ends_at, access_roles, sort_order
)
select p.id, s.stage_key, s.title, s.starts_at, s.ends_at, s.access_roles, s.sort_order
from public.academic_periods p
join public.academic_programs ap on ap.id = p.academic_program_id
join public.organizations o on o.id = ap.organization_id and o.slug = 'informatika-undip'
cross join (values
  ('assignment', 'Penugasan pengajaran', date '2026-07-20', date '2026-08-03', array['admin','kaprodi']::text[], 1),
  ('rps-authoring', 'Penyusunan RPS', date '2026-08-01', date '2026-08-20', array['admin','dosen']::text[], 2),
  ('gpm-review', 'Review GPM', date '2026-08-10', date '2026-08-25', array['admin','gpm']::text[], 3),
  ('head-approval', 'Pengesahan Kaprodi', date '2026-08-18', date '2026-08-29', array['admin','kaprodi']::text[], 4),
  ('teaching', 'Pelaksanaan pengajaran', date '2026-08-17', date '2026-12-05', array['admin','dosen','mahasiswa']::text[], 5),
  ('evaluation', 'Evaluasi & tindak lanjut', date '2026-12-07', date '2026-12-23', array['admin','kaprodi','gpm','dosen']::text[], 6)
) as s(stage_key, title, starts_at, ends_at, access_roles, sort_order)
where p.status = 'active'
on conflict (academic_period_id, stage_key) do nothing;

-- RPS records can now be anchored to the formal context while remaining
-- backward-compatible with legacy course_id until the authoring flow migrates.
alter table public.rps_documents
  add column if not exists academic_period_id uuid references public.academic_periods(id) on delete set null;
alter table public.rps_documents
  add column if not exists curriculum_course_id uuid references public.curriculum_courses(id) on delete set null;
alter table public.rps_documents
  add column if not exists class_offering_id uuid references public.class_offerings(id) on delete set null;

comment on table public.academic_programs is 'Formal hierarchy: university/faculty/department/program mapped 1:1 to an OBELIKS authorization organization.';
comment on table public.academic_periods is 'Current, previous, and one-next-draft academic period. Active status is the global academic context gateway.';
comment on table public.curriculum_courses is 'Versioned course catalog; courses from retired curricula may remain available for re-offering.';
comment on table public.class_offerings is 'A period-specific class. section_number is rendered A, B, C ... automatically by the application.';
