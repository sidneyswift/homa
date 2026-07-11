-- Migration #15: family skills, the runtime "save this as a skill" library.
-- The Mac Mini's homa-system-skillify wrote skill files to disk; the cloud
-- equivalent is rows that a defineDynamic resolver (agent/skills/
-- family-skills.ts) advertises to that family's sessions as loadable skills
-- (eve dynamic-capabilities pattern). Two-tier model: fleet skills ship in
-- git via deploys; family skills live here, per family, behind RLS.
--
-- name is the model-facing skill name (kebab-case, stable, unique per
-- family); description is the always-advertised routing hint (costs one
-- line of context per turn, so it is tightly capped); markdown is the
-- procedure body, loaded only on demand via load_skill. Count cap (20) is
-- enforced app-side; the checks here are the hard backstops.

create table public.family_skills (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null
    check (name ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  description text not null
    check (char_length(description) between 8 and 200),
  markdown text not null
    check (char_length(markdown) between 20 and 6000),
  source text not null default 'homa'
    check (source in ('homa', 'parent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_skills_name_unique unique (family_id, name)
);

create index family_skills_family_idx
  on public.family_skills (family_id, created_at);

alter table public.family_skills enable row level security;

create policy "members read their skills"
  on public.family_skills
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy "members add skills"
  on public.family_skills
  for insert
  to authenticated
  with check (public.is_family_member(family_id));

create policy "members update their skills"
  on public.family_skills
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "members delete their skills"
  on public.family_skills
  for delete
  to authenticated
  using (public.is_family_member(family_id));
