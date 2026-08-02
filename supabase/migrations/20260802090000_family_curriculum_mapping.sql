-- Family Library curriculum decomposition and approved Planner mapping (gh#578).
--
-- The original curriculum remains the top-level family_assets row. Each
-- approved unit is another family_assets row whose parent_asset_id points to
-- that original. Earlier decompositions remain readable because Planner links
-- may still cite them; is_current_decomposition identifies the latest approved
-- set without deleting history.

-- A unit shares its original Blob path and adds a unique fragment. The
-- original upload limit is 2,000 characters, so leave bounded room for that
-- fragment without weakening the URL field into unbounded text.
alter table public.family_assets
  drop constraint if exists family_assets_url_check;
alter table public.family_assets
  add constraint family_assets_url_check
  check (char_length(url) <= 2100);

alter table public.family_assets
  add column if not exists unit_kind text
    check (
      unit_kind is null
      or unit_kind in ('week', 'lesson', 'day', 'chapter', 'unit')
    ),
  add column if not exists unit_source_locator text
    check (
      unit_source_locator is null
      or char_length(btrim(unit_source_locator)) between 1 and 160
    ),
  add column if not exists unit_confidence text
    check (
      unit_confidence is null
      or unit_confidence in ('high', 'medium', 'low')
    ),
  add column if not exists unit_summary text
    check (
      unit_summary is null
      or char_length(btrim(unit_summary)) between 1 and 500
    ),
  add column if not exists decomposition_draft_id uuid,
  add column if not exists is_current_decomposition boolean not null default false;

create index if not exists family_assets_current_units_idx
  on public.family_assets (family_id, parent_asset_id, ordinal)
  where parent_asset_id is not null
    and is_current_decomposition
    and deleted_at is null;

create unique index if not exists family_assets_current_unit_ordinal_uidx
  on public.family_assets (family_id, parent_asset_id, ordinal)
  where parent_asset_id is not null
    and is_current_decomposition
    and deleted_at is null;

create unique index if not exists family_assets_draft_unit_ordinal_uidx
  on public.family_assets (
    family_id, parent_asset_id, decomposition_draft_id, ordinal
  )
  where parent_asset_id is not null
    and decomposition_draft_id is not null;

alter table public.family_assets
  drop constraint if exists family_assets_current_unit_complete;
alter table public.family_assets
  add constraint family_assets_current_unit_complete
  check (
    not is_current_decomposition
    or (
      parent_asset_id is not null
      and ordinal is not null
      and unit_label is not null
      and unit_kind is not null
      and unit_source_locator is not null
      and unit_confidence is not null
      and unit_summary is not null
      and decomposition_draft_id is not null
    )
  );

create table if not exists public.family_curriculum_mapping_approvals (
  draft_id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  source_asset_id uuid not null,
  final_revision smallint not null check (final_revision between 1 and 100),
  decomposition_quality text not null
    check (decomposition_quality in ('full', 'partial')),
  unit_kind text not null
    check (unit_kind in ('week', 'lesson', 'day', 'chapter', 'unit')),
  declared_unit_count smallint not null
    check (declared_unit_count between 1 and 5000),
  unit_asset_ids jsonb not null
    check (
      jsonb_typeof(unit_asset_ids) = 'array'
      and jsonb_array_length(unit_asset_ids) between 1 and 120
    ),
  planner_targets jsonb not null
    check (
      jsonb_typeof(planner_targets) = 'array'
      and jsonb_array_length(planner_targets) <= 40
    ),
  revision_history jsonb not null
    check (
      jsonb_typeof(revision_history) = 'array'
      and jsonb_array_length(revision_history) between 1 and 100
    ),
  approved_at timestamptz not null default now(),
  unique (draft_id, family_id),
  foreign key (source_asset_id, family_id)
    references public.family_assets (id, family_id)
    on delete cascade
);

create index if not exists family_curriculum_mapping_source_idx
  on public.family_curriculum_mapping_approvals (
    family_id, source_asset_id, approved_at desc
  );

alter table public.family_curriculum_mapping_approvals enable row level security;

drop policy if exists "members read their curriculum mapping approvals"
  on public.family_curriculum_mapping_approvals;
create policy "members read their curriculum mapping approvals"
  on public.family_curriculum_mapping_approvals for select to authenticated
  using (public.is_family_member(family_id));

revoke all on table public.family_curriculum_mapping_approvals from anon;
revoke insert, update, delete
  on table public.family_curriculum_mapping_approvals from authenticated;
