create extension if not exists pgcrypto;
create extension if not exists vector;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'reviewer', 'lecturer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  credits numeric(4,1),
  semester smallint check (semester between 1 and 14),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.rps_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references auth.users(id),
  academic_year text,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'queued', 'parsing', 'extracting', 'review', 'approved', 'failed')),
  source_path text,
  source_checksum text,
  parser_version text,
  model_name text,
  raw_extraction jsonb not null default '{}'::jsonb,
  structured_data jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_checksum)
);

create table public.document_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.rps_documents(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'parsing', 'extracting', 'review', 'completed', 'failed')),
  attempt integer not null default 0,
  progress smallint not null default 0 check (progress between 0 and 100),
  error_code text,
  error_message text,
  diagnostics jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.rps_documents(id) on delete cascade,
  ordinal integer not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

create index courses_organization_idx on public.courses (organization_id);
create index rps_documents_course_idx on public.rps_documents (course_id, updated_at desc);
create index rps_documents_status_idx on public.rps_documents (organization_id, status, updated_at desc);
create index rps_documents_structured_gin on public.rps_documents using gin (structured_data jsonb_path_ops);
create index document_jobs_queue_idx on public.document_jobs (status, created_at) where status in ('queued', 'parsing', 'extracting');
create index document_chunks_document_idx on public.document_chunks (document_id, ordinal);
create index document_chunks_embedding_hnsw on public.document_chunks using hnsw (embedding vector_cosine_ops) where embedding is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at before update on public.courses
for each row execute function public.set_updated_at();
create trigger rps_documents_set_updated_at before update on public.rps_documents
for each row execute function public.set_updated_at();
create trigger document_jobs_set_updated_at before update on public.document_jobs
for each row execute function public.set_updated_at();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.courses enable row level security;
alter table public.rps_documents enable row level security;
alter table public.document_jobs enable row level security;
alter table public.document_chunks enable row level security;

create policy organizations_member_select on public.organizations
for select using (public.is_org_member(id));

create policy organization_members_member_select on public.organization_members
for select using (public.is_org_member(organization_id));

create policy courses_member_all on public.courses
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy rps_documents_member_all on public.rps_documents
for all using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy document_jobs_member_select on public.document_jobs
for select using (public.is_org_member(organization_id));

create policy document_chunks_member_select on public.document_chunks
for select using (public.is_org_member(organization_id));

comment on column public.rps_documents.raw_extraction is 'Lossless parser output for audit and reprocessing.';
comment on column public.rps_documents.structured_data is 'Current validated RPS object; schema version should be stored inside the JSON.';
comment on column public.document_chunks.embedding is 'Default dimension 1536; change in a dedicated migration if the embedding model changes.';

