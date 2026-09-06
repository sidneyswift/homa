-- Additive only. Deploy before code starts using the page cache or attempt ids.
alter table public.family_assets
  add column processing_attempt_id uuid,
  add column processing_version text;

create table public.family_pdf_page_reads (
  family_id uuid not null references public.families(id) on delete cascade,
  asset_id uuid not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  extraction_version text not null check (char_length(extraction_version) between 1 and 80),
  page_ordinal integer not null check (page_ordinal between 1 and 240),
  lease_id uuid,
  lease_until timestamptz,
  page_state text check (page_state in ('readable', 'blank', 'partial', 'unreadable')),
  extraction_method text check (extraction_method in ('embedded', 'vision')),
  model text,
  text_content text not null default '' check (char_length(text_content) <= 32000),
  gaps jsonb not null default '[]' check (jsonb_typeof(gaps) = 'array' and jsonb_array_length(gaps) <= 12),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (family_id, asset_id, content_sha256, extraction_version, page_ordinal),
  foreign key (asset_id, family_id) references public.family_assets(id, family_id) on delete cascade,
  check ((completed_at is null and page_state is null) or
    (completed_at is not null and page_state is not null and extraction_method is not null and lease_id is null and lease_until is null)),
  check (page_state not in ('readable', 'partial') or char_length(btrim(text_content)) > 0),
  check (page_state <> 'blank' or text_content = '')
);

alter table public.family_pdf_page_reads enable row level security;
create policy "members read active original page text"
  on public.family_pdf_page_reads for select to authenticated
  using (public.is_family_member(family_id) and exists (
    select 1 from public.family_assets asset
    where asset.id = family_pdf_page_reads.asset_id
      and asset.family_id = family_pdf_page_reads.family_id
      and asset.deleted_at is null
      and asset.content_sha256 = family_pdf_page_reads.content_sha256
  ));
revoke all on public.family_pdf_page_reads from anon;
revoke insert, update, delete on public.family_pdf_page_reads from authenticated;
grant select on public.family_pdf_page_reads to authenticated;
