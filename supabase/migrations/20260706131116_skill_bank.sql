-- Migration #15: the Homa skills bank, the shared tier above family_skills.
-- Curated, fleet-wide procedures with targeting: a skill can be general
-- (advertised to everyone), age-banded, capability-tagged, or both. The
-- resolver (agent/skills/skill-library.ts) advertises a bank skill only to
-- families where some one child satisfies every targeting dimension it
-- sets, so Alessa's generalized letter-worksheet craft loads for a family
-- working on letters and never for a teens-only family.
--
-- Curation posture (fleet-wide blast radius, same reasoning as M3-04):
-- members can only READ published rows. There are deliberately NO insert,
-- update, or delete policies: promotion from a family skill happens
-- through founder review (generalize, strip family specifics, get the
-- family's consent), executed outside the product surface for cohort one.
-- Unpublishing a row is the one-action fleet-wide revert.
--
-- Targeting semantics (enforced in lib/agent-skills.ts, documented here):
--   min/max_age_months null  = no age gate
--   tags empty               = no capability gate
--   tags are lowercase stems ("letter", "count") substring-matched against
--   a child's focus + interests text; a child must pass BOTH gates the
--   skill sets for the skill to advertise.

create table public.skill_bank (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  description text not null
    check (char_length(description) between 8 and 200),
  markdown text not null
    check (char_length(markdown) between 20 and 6000),
  min_age_months int
    check (min_age_months between 0 and 216),
  max_age_months int
    check (max_age_months between 0 and 216),
  tags text[] not null default '{}',
  published boolean not null default false,
  provenance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_bank_age_range_ordered
    check (
      min_age_months is null
      or max_age_months is null
      or min_age_months <= max_age_months
    )
);

alter table public.skill_bank enable row level security;

create policy "members read published bank skills"
  on public.skill_bank
  for select
  to authenticated
  using (published);
