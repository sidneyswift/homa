-- Family Library: durable records for resources a family brings to Homa.
-- Originals live in Vercel Blob under families/{familyId}/library/. The
-- database owns family identity, provenance, processing state, associations,
-- and searchable metadata. Binder remains the home for Homa-created outputs.
--
-- Tenancy posture: authenticated members may read non-deleted records for
-- their own family. Every write is server-only and re-derives family_id from
-- the authenticated session. Composite foreign keys prove that attachment,
-- child, tag, and curriculum-unit relationships stay inside one family.

create unique index if not exists chat_attachments_family_identity_idx
  on public.chat_attachments (id, family_id);

create table if not exists public.family_assets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  uploaded_by_user_id uuid references auth.users (id) on delete set null,
  source_attachment_id uuid,
  parent_asset_id uuid,
  atlas_id text check (atlas_id is null or char_length(atlas_id) <= 120),
  ordinal smallint check (ordinal is null or ordinal >= 1),
  unit_label text check (unit_label is null or char_length(unit_label) <= 120),
  title text not null check (char_length(title) between 1 and 180),
  original_name text not null check (char_length(original_name) between 1 and 240),
  url text not null check (char_length(url) <= 2000),
  download_url text not null check (char_length(download_url) <= 2100),
  media_type text not null check (char_length(media_type) between 1 and 160),
  byte_size bigint not null check (byte_size between 1 and 524288000),
  file_kind text not null
    check (file_kind in ('document', 'image', 'audio', 'video', 'archive', 'link', 'other')),
  resource_kind text
    check (resource_kind is null or resource_kind in (
      'worksheet', 'book', 'curriculum', 'answer_key', 'activity', 'reference', 'other'
    )),
  authors text[] not null default '{}',
  publisher text check (publisher is null or char_length(publisher) <= 180),
  language text check (language is null or char_length(language) <= 32),
  status text not null default 'ready'
    check (status in ('ready', 'processing', 'needs_attention', 'failed')),
  processing_error_code text
    check (processing_error_code is null or char_length(processing_error_code) <= 80),
  processing_note text
    check (processing_note is null or char_length(processing_note) <= 500),
  content_sha256 text
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  embedding extensions.vector(1536),
  processed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_assets_not_own_parent
    check (parent_asset_id is null or parent_asset_id <> id),
  constraint family_assets_processing_error_coherence
    check (
      (status in ('needs_attention', 'failed'))
      or processing_error_code is null
    ),
  unique (id, family_id),
  unique (family_id, url),
  foreign key (source_attachment_id, family_id)
    references public.chat_attachments (id, family_id)
    on delete set null (source_attachment_id),
  foreign key (parent_asset_id, family_id)
    references public.family_assets (id, family_id)
    on delete cascade
);

create index if not exists family_assets_family_recent_idx
  on public.family_assets (family_id, created_at desc)
  where deleted_at is null;
create index if not exists family_assets_family_status_idx
  on public.family_assets (family_id, status, created_at desc)
  where deleted_at is null;
create index if not exists family_assets_parent_idx
  on public.family_assets (parent_asset_id, ordinal)
  where parent_asset_id is not null and deleted_at is null;
create index if not exists family_assets_search_idx
  on public.family_assets using gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(original_name, '') || ' ' ||
      coalesce(publisher, '')
    )
  );

create table if not exists public.family_asset_children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  asset_id uuid not null,
  child_id uuid not null,
  created_at timestamptz not null default now(),
  unique (asset_id, child_id),
  foreign key (asset_id, family_id)
    references public.family_assets (id, family_id)
    on delete cascade,
  foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete cascade
);

create index if not exists family_asset_children_family_child_idx
  on public.family_asset_children (family_id, child_id);

create table if not exists public.family_asset_tags (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  asset_id uuid not null,
  kind text not null
    check (kind in ('subject', 'topic', 'age_band', 'theme', 'work', 'entity')),
  value text not null check (char_length(value) between 1 and 160),
  catalog_id text check (catalog_id is null or char_length(catalog_id) <= 120),
  quote text not null check (char_length(quote) between 1 and 500),
  source_locator text
    check (source_locator is null or char_length(source_locator) <= 160),
  source text not null default 'model'
    check (source in ('model', 'parent', 'import', 'system')),
  created_at timestamptz not null default now(),
  foreign key (asset_id, family_id)
    references public.family_assets (id, family_id)
    on delete cascade
);

create index if not exists family_asset_tags_asset_idx
  on public.family_asset_tags (asset_id, kind);
create index if not exists family_asset_tags_catalog_idx
  on public.family_asset_tags (family_id, kind, catalog_id)
  where catalog_id is not null;

alter table public.family_assets enable row level security;
alter table public.family_asset_children enable row level security;
alter table public.family_asset_tags enable row level security;

drop policy if exists "members read their family assets"
  on public.family_assets;
create policy "members read their family assets"
  on public.family_assets for select to authenticated
  using (public.is_family_member(family_id) and deleted_at is null);

drop policy if exists "members read their family asset children"
  on public.family_asset_children;
create policy "members read their family asset children"
  on public.family_asset_children for select to authenticated
  using (
    public.is_family_member(family_id)
    and exists (
      select 1
      from public.family_assets asset
      where asset.id = family_asset_children.asset_id
        and asset.family_id = family_asset_children.family_id
        and asset.deleted_at is null
    )
  );

drop policy if exists "members read their family asset tags"
  on public.family_asset_tags;
create policy "members read their family asset tags"
  on public.family_asset_tags for select to authenticated
  using (
    public.is_family_member(family_id)
    and exists (
      select 1
      from public.family_assets asset
      where asset.id = family_asset_tags.asset_id
        and asset.family_id = family_asset_tags.family_id
        and asset.deleted_at is null
    )
  );

revoke all on table public.family_assets from anon;
revoke all on table public.family_asset_children from anon;
revoke all on table public.family_asset_tags from anon;
revoke insert, update, delete on table public.family_assets from authenticated;
revoke insert, update, delete on table public.family_asset_children from authenticated;
revoke insert, update, delete on table public.family_asset_tags from authenticated;
