-- Family Drive pilot, gh#1199. Metadata is authoritative here; checkpoint
-- bytes live in private Blob. Provider files are rebuildable working copies.
create table public.family_workspace_files (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  namespace text not null check (namespace in ('production', 'preview', 'development')),
  path text not null check (length(path) between 11 and 180 and path like 'drafts/%'),
  revision uuid not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size between 0 and 65536),
  blob_url text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (family_id, namespace, path),
  unique (family_id, namespace, revision)
);
alter table public.family_workspace_files enable row level security;
revoke all on public.family_workspace_files from public, anon, authenticated;
comment on table public.family_workspace_files is
  'Server-only family-scoped workspace index with optimistic revision checks. Drive and Blob access pass the account deletion fence.';
