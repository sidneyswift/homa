# Education knowledge architecture · how Homa stores and uses what she learns

> Status: PLAN (founder direction 2026-07-10 late morning, chat-derived). Four
> decisions locked below (storage substrate, onboarding split, moderation
> gate, nightly job shape); the specific nightly research agent's selection
> logic and prompts are explicitly deferred, per founder: "we can design the
> research agent later... we should think more about the architecture."

## Founder direction, distilled

1. General education knowledge (what a method/philosophy/format actually is,
   current curriculum providers, current studies) should compound across the
   whole fleet, not be re-researched from scratch by every family's agent.
   Token cost paid once should benefit every future family.
2. The model's own training-data knowledge of, say, Montessori is already
   decent; the value Homa adds is the *delta*, what's changed since training
   cut off, what's specific to Homa's product framing, and corrections to
   common mix-ups. Don't re-teach 101-level facts the model already has.
3. Don't force the model to consult a knowledge store on every turn. Make it
   available, let relevance decide, the way skills already work in this repo.
4. Onboarding metadata (which method a family follows) is one legitimate,
   lightweight way to use this: tag the family, let downstream systems read
   the tag. It should not be the only way; deeper, on-demand lookups matter
   too.
5. The nightly "go research one thing and tell Alessa about it" behavior
   (today: Mac Mini only) should become one unified nightly research agent
   per family, not parallel per-topic schedules. It picks its target each run
   (a method/format refresh, a subject tied to the kid, general new studies)
   and its findings should flow into the same shared knowledge system,
   alongside whatever gets said to the parent that night.
6. Moderation: optimize for speed. Auto-merge everything the research agent
   finds into the shared bank; treat review as a background audit, not a
   gate that blocks other families from benefiting.

## What exists today (verified in code, 2026-07-10)

- **Skills already do "available, not forced."** `skill_bank` (fleet-wide,
  DB-backed, markdown) + `family_skills` (per-family) get merged every turn
  by a dynamic resolver (`agent/skills/skill-library.ts`), matched against
  child tags. The model only pulls a skill into context by calling the
  framework's `load_skill` tool when its advertised description matches.
  Nothing forced, nothing hidden. This is the shape to extend, not replace.
- **Method/curriculum metadata exists but has a live gap.** Onboarding
  (`app/onboarding/homeschool-step.tsx`) writes `families.context.styles`
  (the `HOMESCHOOL_STYLES` enum in `packages/core/src/map/schemas.ts`) and
  `.curriculums`. Those already feed the deterministic four-week plan
  builder (`lib/map/store.ts`) and the report-writer LLM prompt
  (`lib/map/narrative-store.ts`). They are **not** injected into the live
  conversational agent's per-turn context block
  (`agent/instructions/family-context.ts`), so a mom who told onboarding
  she's Montessori is invisible to Homa in chat unless she says so again or
  it became a `remember` memory.
- **No shared research-writeback path exists.** The only "persist a learned
  thing" tools are `remember` (per-family, `family_memories`) and
  `save_skill` (per-family, `family_skills`). Nothing writes to `skill_bank`
  at runtime, and nothing writes general research findings anywhere shared.
- **No nightly research job is shipped.** The per-subject nightly research
  behavior is Mac Mini automation, documented but not cloud code. The
  closest shipped analog, an hourly `journal_prompt` schedule
  (`agent/schedules/dispatch.ts`), composes a check-in text with no web
  research and is still dark in prod. A related backlog item, M3-04
  "nightly benchmark research," is planned but also unbuilt; this plan's
  unified nightly-research schedule likely supersedes or absorbs M3-04's
  scope rather than sitting beside it as a second system. Reconcile that
  explicitly in `03-backlog.md` before either gets built.
- **The research-quality bar already exists as a written convention.**
  `icp-research/08-segments-curricula.md` and the new
  `icp-research/10-homeschool-methods-glossary.md` both use FACT / INFERENCE
  / CAUTION labeling, inline citations with access dates, and confidence
  ratings. The nightly research agent's output should meet this same bar,
  not a lower one, since it feeds a shared system other families will trust.

## Architecture: six layers

### Layer 1: the curated seed (done)

`icp-research/10-homeschool-methods-glossary.md`. Human-readable, founder/
agent-reviewed, planning corpus. Not runtime-loaded directly; it seeds
Layer 2.

### Layer 2: `knowledge_bank`, a new fleet-wide table

Broader than "methods only," because the founder wants one research agent
that can also land subject knowledge and general studies in the same shared
system. One table, discriminated by topic type, is simpler to build and
query than three narrow tables that all end up needing the same audit
tooling later.

```sql
create table public.knowledge_bank (
  id uuid primary key default gen_random_uuid(),
  topic_type text not null check (topic_type in (
    'method_philosophy', 'method_format', 'subject', 'study', 'other'
  )),
  topic_key text not null,        -- e.g. 'montessori', 'fractions'
  title text not null,
  summary text not null,          -- short, for Layer 4 auto-inject
  content text not null,          -- full delta-knowledge, markdown
  source_tier smallint,           -- 1-4, same tiers as icp-research docs
  citations jsonb not null default '[]',  -- [{url, accessed_at, claim}]
  confidence text check (confidence in ('high','medium','low')),
  contributed_by text not null default 'seed', -- seed | agent_research | founder
  status text not null default 'active',       -- active | flagged | superseded
  superseded_by uuid references public.knowledge_bank(id),
  freshness_ttl_days int not null default 180,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.knowledge_bank (topic_type, topic_key, status);
```

Notes on the choices baked into this shape:

- **`status` + `superseded_by` exist even though merges are auto-approved.**
  Speed was the explicit call, but "auto-merge" and "no audit trail" are not
  the same decision. A background audit (human or a second-pass model
  check, either can come later) needs somewhere to flag a bad row without
  deleting history or breaking whatever already cited it that night.
- **`citations` is mandatory-shaped, not optional prose.** If the nightly
  agent can't produce a URL and an access date for a claim, that claim
  shouldn't be writing to a table every family's Homa reads from. This is
  the one non-negotiable carried over from the icp-research convention.
- **`freshness_ttl_days` gives the nightly agent a reason to revisit a topic**
  without needing separate "refresh" scheduling logic: research targets
  whose newest active row is past its TTL are simply eligible again. Default
  180 days is a placeholder, not a considered number; revisit once real
  entries exist.
- **Seeding Layer 1 into this table** is a one-time migration/script:
  walk `10-homeschool-methods-glossary.md`'s §3 profiles into rows with
  `contributed_by = 'seed'`, `topic_type = 'method_philosophy'` (or
  `'method_format'` for the format-only entries like online/virtual charter
  and microschools), citations pulled from the glossary's own inline links.

### Layer 3: onboarding metadata, split into two fields

Confirmed: philosophy and format are different axes (a family can be
classical *and* in a microschool at once), so they get separate fields
instead of one flattened list.

- `packages/core/src/map/schemas.ts`: keep `HOMESCHOOL_STYLES` for
  philosophy (expand the list using the glossary's §2 ranking: add
  `charlotte_mason` improvements aside, likely additions are
  `classical_christian` as a distinct value from `classical` if the product
  wants that granularity, plus whichever niche philosophies are worth
  surfacing as explicit picks vs. free-text). Add a new
  `HOMESCHOOL_FORMATS` export: `homeschool_only`, `online_charter`,
  `microschool_hybrid`, `forest_school`, `co_op_heavy`, or similar,
  informed by glossary §2 entries 8-12.
- `mapFamilyExtrasSchema` gets a new optional `formats` array field,
  mirroring `styles`'s shape (`z.array(z.enum(HOMESCHOOL_FORMATS))`).
- `homeschool-step.tsx` gets a second multi-select block, same chip pattern
  as the existing styles picker, labeled distinctly ("Philosophy" vs.
  "Setting," exact copy needs the homa-copy-writer skill's pass before it
  ships, not decided here).
- Check every consumer of `HOMESCHOOL_STYLES` for exhaustive `switch`
  statements (the repo's `typescript-exhaustive-switch` rule) before adding
  new enum values; none were found to have that shape in the explore pass,
  but re-verify at implementation time.

### Layer 4: auto-inject the shallow blurb (closes the live gap)

`agent/instructions/family-context.ts` gains a lookup: for each
`families.context.styles`/`.formats` value present, pull the matching
`knowledge_bank` row's `summary` (not `content`, keep this cheap) where
`status = 'active'`, inject alongside the existing name/state block. No
model decision involved, no `load_skill` call needed for this shallow layer.
This is the piece that makes "she told onboarding she's Montessori" actually
visible to Homa in a plain chat, which today it isn't.

### Layer 5: on-demand depth via the existing skill mechanism

Extend `skill-library.ts`'s dynamic resolver to also pull matching
`knowledge_bank` rows (by the family's tagged styles/formats) into the same
`defineSkill({ description, markdown })` map it already builds from
`skill_bank`/`family_skills`, using `content` (the long form) as the
markdown body. The model calls `load_skill` exactly like it does for
`worksheet-studio` today, no new loading mechanism, no new tool, just a
second data source feeding a resolver that already exists.

### Layer 6: the unified nightly research agent (architecture only, per founder)

One schedule, not three. Explicitly deferred: the target-selection logic and
research prompts. What's being decided here is only the shape it writes
into:

- **Trigger**: one `agent_schedules.kind = 'nightly_research'` row per
  family (reusing the existing `agent_schedules` table and lease pattern
  from `journal_prompt`), likely at the same family-local evening hour.
  Some research targets (general "new studies" scans) may not need to be
  per-family at all and could run as a separate fleet-wide cron instead of
  once per family; that's a target-selection detail, not an architecture
  decision, left to whoever designs the research agent.
- **Each run produces up to two outputs**, not one:
  1. A durable, shared contribution to `knowledge_bank` (`contributed_by =
     'agent_research'`), auto-merged per the founder's speed-first call.
     This is the "pay once, benefit every family" half.
  2. A personalized, ephemeral message to the parent tying that night's
     research back to their specific kid, delivered through the existing
     `dispatch.ts` SMS/email channel. This is the "sends Alessa a little
     message" half, and it does not need to touch `knowledge_bank` at all,
     it's family-specific framing of whatever was learned, not a fact worth
     sharing fleet-wide.
- **Write path**: a new tool, shaped like `save_skill.ts` but targeting
  `knowledge_bank` instead of `family_skills`, taking the same
  citation-required shape as the table schema above.
- **Reconcile with M3-04** before building: read `03-backlog.md`'s M3-04
  description against this plan and decide whether M3-04 *is* this, gets
  folded in, or is a genuinely separate concern. Not resolved in this pass.

## What this deliberately does not decide yet

- The nightly research agent's actual target-selection logic (how it
  weighs a stale method entry vs. a subject tied to the kid vs. a general
  studies scan). Founder call: design later.
- Exact copy for the two onboarding fields (needs `homa-copy-writer` /
  `homa-copy-reviewer` / `homa-copy-editor`, not decided in an architecture
  pass).
- The final `HOMESCHOOL_STYLES`/`HOMESCHOOL_FORMATS` enum membership lists;
  §2 of the glossary is the input, not the final picker copy.
- Whether/how a background audit process for `knowledge_bank` actually gets
  built (flagging bad rows). The `status` column makes it possible later;
  nothing here builds the auditor itself.
- Whether `family_skills` ever promotes into `skill_bank` today (not
  confirmed either way in the explore pass); if a promotion path exists,
  `knowledge_bank` contributions from `remember`-style family-specific
  learnings could someday follow the same promotion pattern. Out of scope
  here.

## Sequencing, if/when this gets built

1. `knowledge_bank` migration + seed script from the glossary (Layer 1 → 2).
   Low risk, no agent behavior changes yet, immediately useful as a
   reviewable artifact.
2. Split onboarding fields (Layer 3): schema + UI + copy pass.
3. Layer 4 auto-inject (closes the live context gap, small, high value on
   its own even before Layer 5/6 exist).
4. Layer 5 skill-resolver extension (depth on demand).
5. Reconcile Layer 6 with M3-04 in the backlog doc, then design the actual
   nightly research agent as its own follow-up plan.
