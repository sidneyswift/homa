-- Migration #21: state_requirements, the per-jurisdiction homeschool
-- compliance reference table (M3-05 data layer; 50 states + DC).
--
-- Seeded ONLY from the repo's reviewed snapshots of HomeschoolLeap's
-- public API (data/state-requirements/, CC BY-SA 4.0, attribution
-- required). Pipeline: pnpm pull:state-requirements (snapshot + git
-- diff review) then pnpm seed:state-requirements (direct-connection
-- upsert). The product reads THIS table, never the API at runtime and
-- never a model's memory: compliance answers must route through
-- state_requirements (AQ-10), rendered with statute links and
-- last-verified dates (journeys/04 F4-S2).
--
-- Write posture (same reasoning as skill_bank and M3-04, fleet-wide
-- blast radius): members can only READ. Deliberately NO insert, update,
-- or delete policies, so no Data API role and no compromised model turn
-- can alter a legal claim. Writes happen only through the seed script's
-- direct connection after a human reviews the snapshot diff.
--
-- Column semantics:
--   payload                    = full upstream per-state document
--                                (pathways with statute citations,
--                                notification deadlines, assessment
--                                rules, instructional time,
--                                recordkeeping, instructor rules,
--                                sources, citation_urls, esa_programs),
--                                verbatim; wins over summary columns if
--                                they ever disagree
--   notification_required /    = upstream per-state rollups from the
--   assessment_required          index listing ("does the DEFAULT
--                                pathway require it"); pathway-level
--                                truth lives in payload->'pathways'
--   source_last_verified       = HomeschoolLeap's own per-state
--                                verification date, the in-product
--                                "last verified" trust signal
--   pulled_at                  = when we snapshotted upstream
--                                (manifest.pulled_at)
--   updated_at                 = when row content last actually changed
--                                (seed bumps it only on a real change)

create table public.state_requirements (
  state_code text primary key
    check (state_code ~ '^[A-Z]{2}$'),
  state_name text not null,
  regulation_level text not null
    check (regulation_level in ('none', 'low', 'moderate', 'high')),
  compulsory_start_age int
    check (compulsory_start_age between 0 and 21),
  compulsory_end_age int
    check (compulsory_end_age between 0 and 21),
  notification_required boolean not null,
  assessment_required boolean not null,
  default_pathway text,
  payload jsonb not null,
  source text not null default 'homeschoolleap',
  source_page_url text,
  source_verification_status text not null,
  source_last_verified date not null,
  pulled_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.state_requirements enable row level security;

create policy "members read state requirements"
  on public.state_requirements
  for select
  to authenticated
  using (true);
