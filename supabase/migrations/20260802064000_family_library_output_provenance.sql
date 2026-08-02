-- Family Library output provenance (gh#579).
--
-- A family asset stays owned by Library. A planner activity may point back to
-- that original without copying ownership into child_plans. Materials keep
-- their source snapshots in materials.generation, the existing atomic
-- generation-provenance record. Planner activities need a relational edge
-- because their week and index coordinates move when a plan is edited.
--
-- activity_text is a fail-closed fingerprint of the human-readable activity.
-- Readers expose a link only while the current plan still has that exact text
-- at that exact coordinate. Writers that understand provenance rewrite links
-- in the same transaction as the plan, check-off, and schedule changes.

create table if not exists public.family_asset_plan_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  asset_id uuid not null,
  child_id uuid not null,
  subject_id text not null
    check (char_length(btrim(subject_id)) between 1 and 80),
  week smallint not null check (week between 1 and 4),
  activity_index smallint not null check (activity_index between 0 and 30),
  activity_text text not null
    check (char_length(btrim(activity_text)) between 1 and 500),
  source_title text not null
    check (char_length(btrim(source_title)) between 1 and 180),
  source_locator text
    check (
      source_locator is null
      or char_length(btrim(source_locator)) between 1 and 160
    ),
  created_at timestamptz not null default now(),
  unique (
    family_id, asset_id, child_id, subject_id, week, activity_index
  ),
  foreign key (asset_id, family_id)
    references public.family_assets (id, family_id)
    on delete cascade,
  foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete cascade,
  foreign key (child_id, subject_id)
    references public.child_plans (child_id, subject_id)
    on delete cascade
);

create index if not exists family_asset_plan_links_plan_idx
  on public.family_asset_plan_links (
    child_id, subject_id, week, activity_index
  );
create index if not exists family_asset_plan_links_asset_idx
  on public.family_asset_plan_links (family_id, asset_id);

alter table public.family_asset_plan_links enable row level security;

drop policy if exists "members read their family asset plan links"
  on public.family_asset_plan_links;
create policy "members read their family asset plan links"
  on public.family_asset_plan_links for select to authenticated
  using (public.is_family_member(family_id));

revoke all on table public.family_asset_plan_links from anon;
revoke insert, update, delete
  on table public.family_asset_plan_links from authenticated;
