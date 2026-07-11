# Homa's tasks & the nightly research brief · one task framework, two research tiers

> Status: BUILT 2026-07-10 (late night, founder "BOIL THE OCEAN, then
> test e2e"; build-log entry same date). All seven tickets landed in one
> pass; live E2E green end to end against the dev agent + homa-prod (17
> checks: seeding, a real composed brief delivered by email, outbox
> no-op on redelivery, custom save-only task, pause switch, fleet
> research with a gated cited row). Corpus seeded (12 method/format
> rows through the gate). Both delivery loops stay dark behind
> MORNING_BRIEF_ENABLED / FLEET_RESEARCH_ENABLED (founder switches,
> HUMAN-TODO). Two build findings and one E2E incident are recorded in
> the build log: eve receive() resolves at session start (channels own
> run completion; a reaper catches crashes), and leftover dev-seeded
> journal rows from 2026-07-09 caused three real late-evening journal
> emails during the first E2E fire (delivery windows + an E2E preflight
> now prevent the class). Original plan text below, kept for the record.

> Status when written: PLAN (founder direction 2026-07-10 evening,
> chat-derived; five founder decisions taken same session on a question
> card, recorded in §Founder decisions). This plan implements Layer 6 of
> plans/2026-07-10-education-knowledge-architecture.md with one amendment
> (two-tier research, D-ht-1), performs the M3-04 reconciliation that
> plan asked for (folded into the fleet tier), and pulls M3-08 (schedule
> CRUD) forward to power the tasks tab. Built on the gateway doctrine:
> loops that talk to families wake the agent (gateway-plan.md).

## Founder direction, distilled (2026-07-10 evening)

1. The macmini's nightly research post is the feature: "it reminds me
   she's working for me even when I'm not using her." Homa cloud gets the
   same, enhanced by what the cloud knows that the macmini doesn't: the
   1,590-topic taxonomy with prerequisites, per-child MAP positions, and
   each family's homeschool style (montessori, charlotte mason, ...).
2. Delivery is a text at 9am family-local, Monday to Friday; email when
   no phone is linked.
3. The webapp gets a tab showing Homa's tasks, clearly distinct from the
   kids' week planner.
4. Think one level of abstraction above the research cron: design the
   task framework so future scheduled work (weekly scoring, weekly note,
   local discovery) lands as new task kinds, not new systems.
5. The research brief must be a killer feature out the gate.
6. Explicit challenge issued and taken: do not follow the education
   plan's "one research agent per family" blindly. The unknowns pass ran
   before this plan; its verdict and the founder's rulings are below.

## Founder decisions (D-ht-1 .. D-ht-5, 2026-07-10 evening)

- **D-ht-1 · architecture: two-tier.** A fleet research job fills the
  shared `knowledge_bank`; each family's morning run personalizes from
  it, with a capped per-family top-up search when the corpus is cold.
  Per-family full web research was rejected on four grounds: cost scales
  O(families) instead of O(topics); the macmini's own files prove ~90%
  of researched content is family-independent (its benchmark files are
  generic milestone tables with a thin child-notes section); per-family
  research pushes child specifics into third-party search queries; and
  council S1 / M3-04 quarantine is only tractable at one choke point.
- **D-ht-2 · cadence: both loops.** Morning brief Mon-Fri 9am local plus
  the evening journal prompt (still behind `JOURNAL_PROMPT_ENABLED`).
  Watch fatigue signals; MJ-27 quiet mode remains the future pressure
  valve.
- **D-ht-3 · tab scope: full management.** Built-in task kinds with
  schedules, run history, per-task toggles, plus parent-created custom
  tasks. This pulls M3-08 forward from post-revenue, including its
  safety law (schedule-spawned sessions never get schedule tools).
- **D-ht-4 · tab name: "Homa's tasks".** Founder wrote "Homa's Tasks";
  house style is sentence case, so the nav label renders "Homa's tasks".
  Copy gates confirm before ship.
- **D-ht-5 · merge posture: auto-merge behind an automated gate.**
  Citations must resolve, injection scan, typed field caps, one-action
  fleet-wide revert. Reconciles the education plan's speed-first ruling
  with council S1 / M3-04. No human wait in the path.

Also noted: PRD §3's cohort-one non-goal "automated weekly notes
(concierge only)" is superseded for the DAILY brief by this direction.
Weekly scoring and the weekly note (M3-01/M3-02) stay future task kinds.

## Reference semantics map · what the macmini research cron actually does

Read in full 2026-07-10 (founder-authorized exception to the
homa-macmini boundary; code and formats only, no family data copied).
The anatomy, so the port argues from the real thing:

- **Thin trigger, fat skill.** The cron payload is a numbered checklist
  pointing at a skill file that carries the full procedure
  (story-coach SKILL.md, 586 lines). The schedule is dumb on purpose.
- **One topic per night**, picked by staleness across 25 domain files in
  two tiers: Tier A, 15 child-development domains scored against the
  child; Tier B, 10 homeschooling-practice domains, general wisdom,
  never scored. Tie-break toward domains with the most unknowns in the
  child profile; final tie-break rotates.
- **3 to 8 vetted sources** per run (CDC, AAP, NAEYC, NGSS, Head Start
  ELOF, Montessori scope-and-sequence, peer-reviewed last-5-years);
  marketing content and anecdote explicitly banned.
- **Three artifacts per run**: the durable knowledge file
  (benchmarks/ or practice/), an append-only research journal entry
  (audit trail), and a human-readable note the morning post links.
- **Finding vs application split** in the recap: "What I learned" (the
  field's knowledge) vs "Why it's interesting" (what it means for THIS
  child and parent). The skill forbids conflating them.
- **Propose, never activate.** Findings become proposed interventions
  with a proposed_at date; a separate weekly loop reviews them. Fit
  proposals through the child's known levers (what-works.md: character-
  carried, hands-on), the fix for "her suggestions were the most
  obvious" (founder, 2026-06-28).
- **Guardrails**: don't pathologize ("below age" is a flag, not a
  judgment), citation-or-unknown, silent at night, one channel gets the
  recap, time budget with "partial pass, continuing tomorrow" logging.
- **Reply loop**: a parent reply to the research post is training
  signal, fanned out to profile + benchmarks + journal, acknowledged
  with a "what I changed" list.

### Preserved · changed · dropped

| | Macmini | Homa cloud (this plan) |
|---|---|---|
| Preserved | one angle per family per night | same, the brief never firehoses |
| Preserved | thin cron + skill file carries procedure | schedule message stays a checklist; `agent/skills/research-brief/` carries the craft (materials-studio precedent) |
| Preserved | three artifacts (knowledge, journal, human note) | `knowledge_bank` row · `homa_task_runs` row + events · the brief itself (also persisted as a `dispatch` conversation row) |
| Preserved | staleness-driven selection, tie-break to unknowns | selection over taxonomy frontier + `child_reports.scores` positions + bank freshness TTL |
| Preserved | two knowledge tiers (child-scored vs practice wisdom) | `knowledge_bank.topic_type`: subject/study vs method_philosophy/method_format/other |
| Preserved | finding vs application split | brief frame keeps the two-beat shape |
| Preserved | propose, never activate; fit the child's levers | briefs make offers through interests/characters/style; nothing mutates plans silently |
| Preserved | don't pathologize; citation-or-unknown | same laws, plus the DS reassure-before-inform rules |
| Changed | posts at 2:17am to Slack | works overnight, delivers 9am family-local Mon-Fri, SMS first, email fallback |
| Changed | research runs per family (it has one family) | research runs fleet-level; the family run personalizes (D-ht-1) |
| Changed | files in a workspace | Postgres with RLS; briefs land in `conversation_messages` |
| Changed | auto-writes its own files, no gate | shared-bank writes pass the automated gate (D-ht-5) |
| Changed | Slack-thread feedback needs custom fan-out | a reply to the SMS/email IS an agent turn already (gateway); memory + observation capture handle the fan-out |
| Dropped | vault regeneration rule | no projection layer to regenerate; the tab reads the DB |
| Dropped | weekly scoring cron | out of scope; lands later as a task kind (M3-01/M3-02) |
| Dropped | ambient learning sweep | cloud already ships post-turn review (M2-13 slice) separately |
| Dropped | interventions_active lifecycle | M3-03 later; v1 briefs make offers, accepted work happens in chat |

## What exists today (verified in code, 2026-07-10)

- **Scheduling rails.** eve `defineSchedule` (v0.19.0) becomes a Vercel
  cron (UTC, minute granularity); the hourly dispatcher
  (`agent/schedules/dispatch.ts`) + `agent_schedules` rows +
  `lib/schedule-store.ts` implement per-family local-hour scheduling
  with atomic leases, self-healing seeding, at-least-once delivery, and
  a local-date idempotency guard. Dev trigger:
  `POST /eve/v1/dev/schedules/:id`.
- **Proactive delivery.** `agent/channels/dispatch.ts` delivers the
  agent's composed text by SMS when a line is linked
  (`sendHomaSms`, Telnyx, live, 10DLC verified), else the approved
  email shell (`lib/map/email.ts`). Replies arrive as normal agent
  turns on the parent's own surface.
- **Family knowledge to personalize with.** `families.time_zone`,
  `families.context.styles` + `.curriculums` (HOMESCHOOL_STYLES enum),
  `children.profile.interests`/`focus`, `family_memories`
  (fact/what_works), `child_reports.scores` (per-subject position +
  monthsAhead), `child_plans` (+progress), and `@homa/taxonomy`
  (1,590 topics, prerequisite graph, cluster summaries).
- **Agent web access.** `web_search` on (provider-run); `web_fetch`
  disabled by ruling (15-agentic-architecture §3). The gate's citation
  checks run in server code, which may fetch normally.
- **Cost posture.** `model_usage` ledger + record-usage hook cover
  dispatch sessions automatically; 08-billing classifies scheduled
  loops as plan-included (costed, not charged).
- **Gaps this plan fills.** `agent_schedules.kind` allows only
  `journal_prompt`; no run-history table exists (the tab needs one); no
  `knowledge_bank`; no research/tasks events; `family-context.ts` still
  hardcodes America/New_York for dates.

## Architecture

### 1. The task framework (one level above any single cron)

A **task kind** is a registry entry (`lib/tasks/kinds.ts`), not a new
system. The contract every kind fills:

```
kind            journal_prompt | morning_brief | custom | (future: weekly_scoring, weekly_note, local_discovery)
scope           family (agent_schedules row) | fleet (authored eve schedule)
schedule        family-local hour + weekday mask (DST-safe via nextLocalHourInstant) | UTC cron
eligibility     SQL predicate for seeding (and self-disabling)
session         the receive() message: thin checklist + skill reference + composed context
delivery        none | dispatch channel (SMS-first, email fallback, send window)
idempotency     outbox key (schedule_id, local_date) per M3-10
artifacts       what the run writes (bank rows, materials, brief text)
events          MJ-08 registry names the kind emits
kill switch     env flag per kind
```

Two new tables, one widened:

- `agent_schedules` gains kinds (`morning_brief`, `custom`), and
  parent-visible columns for D-ht-3: `label`, `prompt` (custom kinds
  only), `weekday_mask`, `local_hour`, `delivery_pref`, `created_by`.
  RLS changes from deny-all to: SELECT for the family's members on their
  own rows; writes stay server-only (tools and server actions route
  through guarded libs, familyId from auth context only, per the
  tenancy law).
- `homa_task_runs` (new): `id, family_id nullable (null = fleet run),
  kind, status (running|done|failed|skipped), scheduled_for, started_at,
  finished_at, session_id, title, summary, artifacts jsonb,
  delivered_channel, error`. SELECT for own family; writes server-only.
  This table IS the tab's feed, the dedupe outbox, and the health
  record (a janitor-style check reads it later, M4-01).
- The dispatcher generalizes: `schedule-store.ts` seeds/claims/advances
  per kind from the registry (journal keeps 8pm daily; brief gets 9am
  Mon-Fri); `dispatch.ts` builds the session message per kind; the
  dispatch channel parametrizes its title/continuation token by kind.

**Safety law carried from M3-08**: sessions started BY a schedule never
see the schedule CRUD tools (channel `dispatch` refuses them), so no
task can create tasks. Custom-task prompts are parent-authored content;
they run with the family's own pinned scope, same trust basis as SMS.

### 2. Fleet research (nightly, one job, fills the corpus)

`agent/schedules/fleet-research.ts` (authored eve schedule, nightly
UTC, `FLEET_RESEARCH_ENABLED` gate). Each run:

1. **Builds the demand queue in SQL**: candidate topics scored by
   (a) how many families' children are AT or NEAR a taxonomy topic or
   MAP subject (frontier pressure), (b) styles/curriculums in use across
   families (method refreshes), (c) `knowledge_bank` freshness TTL
   expiry or absence, (d) rotation so no topic starves.
   Child data never leaves the query; the queue is topic keys.
2. **Researches the top N topics** (`RESEARCH_TOPICS_PER_NIGHT`,
   default 5) with `web_search`, source rules ported from the macmini
   skill (tier-1 orgs, peer-reviewed last 5 years, no marketing/blog
   anecdote), FACT/INFERENCE/CAUTION labeling per the icp-research
   convention.
3. **Writes through the gate** (D-ht-5), a server lib
   (`lib/knowledge/gate.ts`), never raw: every citation URL must
   resolve server-side; content is stripped of invisible/bidi
   characters and HTML; length caps per field; banned-words + em-dash
   scan on parent-visible fields; then the row goes `active` with
   `content_hash` + `run_id`. Failures land `flagged` with a reason,
   visible in the run record, never in family context.
4. **Records the run** in `homa_task_runs` (family_id null) and emits
   events. `scripts/knowledge-revert.mts` flags every row from a given
   run id in one action (M3-04's fleet-wide revert).

`knowledge_bank` uses the education plan's Layer 2 schema verbatim,
plus three additive columns: `run_id uuid`, `content_hash text`,
`flagged_reason text`. The glossary seed script (that plan's
sequencing #1) ships here too, so the corpus starts non-empty.

### 3. The morning brief (per family, cheap, the killer feature)

One `agent_schedules` row per eligible family, kind `morning_brief`,
next_run_at = next weekday 9am family-local. Eligibility mirrors the
journal gate: >= 1 child with a generated report, `time_zone` set,
family older than 20 hours, not opted out of this kind, and a phone or
email on file. `MORNING_BRIEF_ENABLED` gates seeding + dispatch.

The dispatched session (skill: `agent/skills/research-brief/SKILL.md`)
does, in order:

1. **Pick tonight's angle** for THIS family: the child's frontier
   (from `child_reports.scores` + taxonomy prerequisites), unknown or
   stale positions, plan targets this week, family style, recent
   memories (a museum trip, a new interest), and which fresh
   `knowledge_bank` rows intersect those. One angle, not a survey.
2. **Top-up escape hatch**: if the best angle has no fresh bank row,
   the session may run ONE bounded `web_search` pass
   (`BRIEF_TOPUP_SEARCH_CAP`, default 1). Anything learned goes back
   through the same gate into the bank, so the next family never pays
   for it again. Searches are topic-phrased; child names and profile
   details never enter queries.
3. **Compose the brief** in the macmini two-beat frame: what I looked
   into (finding, cited), why it matters for YOUR kid (application:
   position, interests, style, what-works). Then at most one offer
   ("want a paper-airplane version in his week? just reply"). SMS form:
   2 to 4 short sentences, no markdown, no link required (the tab holds
   the full note). Email form: the fixed shell with the fuller note.
   Copy discipline: reassure-before-inform, offers never commands, no
   "behind" framing, never compare siblings, honest tense (the fleet
   researched overnight; the brief may say "last night I looked into",
   the top-up case says "this morning").
4. **Deliver and record**: dispatch channel sends (send window guard:
   only between 9am and noon local; a family with no working channel
   records `skipped`), `homa_task_runs` row written with the brief text
   as summary + artifact refs (bank rows cited, any material offered),
   `research.brief_sent` emitted, schedule advances to the next weekday
   9am. At-least-once redelivery is absorbed by the
   (schedule_id, local_date) outbox key.

Weekend rhythm: fleet research runs 7 nights (the corpus never
sleeps); briefs go out Mon-Fri only, so Monday's brief naturally has
the freshest weekend research to draw from.

While in `family-context.ts` for the composer, fix the hardcoded
America/New_York date rendering to use `families.time_zone`.

### 4. The tab: Homa's tasks (full management, D-ht-3)

New nav entry in `APP_NAV_ITEMS` (`sidebar-nav.tsx`), route
`apps/web/app/app/tasks/` under the existing `DashboardShell`. The
label "Homa's tasks" and a one-line subhead distinguish it from the
kids' Week planner ("what Homa does on her own, and what she found").
Two sections, existing design tokens only:

- **Scheduled**: one card per task. Built-in kinds show plain-language
  name + description, a schedule chip ("Weekdays · 9:00 am",
  "Every evening · 8:00 pm"), next run, last run status, and an on/off
  toggle (writes `enabled`, which doubles as the per-kind opt-out).
  Custom tasks add Edit and Delete. "New task" opens a form: what
  should Homa do (prompt), which days + time, deliver by text, email,
  or just save to this page.
- **History**: the `homa_task_runs` feed, newest first: kind icon,
  title, the brief/summary text, artifact links (a bank-backed note
  view, a material preview), timestamp in family time. Fleet research
  runs do NOT appear here (they are not the family's work record);
  their output shows up as the sources behind a brief.

Chat parity (M3-08 pulled forward): `create_task`, `list_tasks`,
`update_task`, `delete_task` tools on the same store, family-scoped
via session auth, refused on schedule-spawned sessions. "Remind me
every Tuesday at 3 to prep co-op" works in chat and shows up in the
tab.

Empty states matter for day one: Scheduled shows the two built-ins
(brief + journal) with honest off/on states; History earns its first
row the first morning. All tab copy passes homa-copy-writer, then
homa-copy-reviewer, then homa-copy-editor before ship.

## Tickets

### HT-1 · Task framework migrations + store generalization
- Migration: widen `agent_schedules.kind` check
  (`journal_prompt | morning_brief | custom`), add `label`, `prompt`,
  `weekday_mask`, `local_hour`, `delivery_pref`, `created_by`; RLS:
  family-member SELECT on own rows, writes server-only. New
  `homa_task_runs` per §1 with family SELECT policy. Isolation checks
  extended (`pnpm check:isolation` green).
- `lib/tasks/kinds.ts` registry + `schedule-store.ts` generalized
  (per-kind seeding/advance, weekday mask, outbox key); dispatcher and
  dispatch channel parametrized by kind; journal behavior provably
  unchanged (same seeds, same 8pm advance).
- Acceptance: dev dispatch of `journal_prompt` byte-identical behavior;
  a seeded `morning_brief` row advances Fri to Mon 9am across a DST
  boundary in tests.

### HT-2 · knowledge_bank + gate + seed
- Migration per education plan Layer 2 + the three additive columns;
  deny-all RLS (server-only; families never read it directly, Layer 4/5
  of that plan remain its own work).
- `lib/knowledge/gate.ts` (citation-resolve, sanitize, caps, scans,
  hash) + `scripts/knowledge-revert.mts` (one-action flag by run id).
- Seed script walks the methods glossary §3 into `contributed_by='seed'`
  rows through the same gate.
- Acceptance: a fixture row with a dead citation lands `flagged`; a
  prompt-injection fixture (invisible chars + instruction text) is
  neutralized or flagged; revert flags a whole run in one command.

### HT-3 · Fleet research schedule
- `agent/schedules/fleet-research.ts` (nightly UTC,
  `FLEET_RESEARCH_ENABLED`), demand-queue SQL, research session with
  source rules, writes via HT-2's gate, `homa_task_runs` fleet rows,
  `model_usage` instrumentation, events.
- Acceptance: a live run against dev produces >= 1 active gated row
  with resolving citations and a run record; topic queue provably
  excludes child-identifying strings (query review + fixture).

### HT-4 · Morning brief (selection + composition + delivery)
- `agent/skills/research-brief/SKILL.md` (selection rules, two-beat
  frame, offer discipline, guardrails ported from the macmini skill:
  don't pathologize, citation-or-unknown, one angle, partial-pass
  honesty); dispatcher message per §3; top-up cap; send-window guard;
  email shell `sendResearchBriefEmail` (fixed frame, agent body);
  family-context timezone fix.
- Acceptance: E2E against the dev agent for a synthetic family with a
  scored report: brief composed referencing the child's actual position
  + a real bank row, delivered SMS-first, email fallback when the phone
  is missing, run recorded, second same-day dispatch a no-op, reply to
  the SMS becomes a normal agent turn.

### HT-5 · The tab, feed first
- Nav entry + `/app/tasks` route + Scheduled cards (built-ins, toggles)
  + History feed from `homa_task_runs` (family time, artifact links).
- Acceptance: toggle off stops the next morning's brief (seeding
  respects `enabled`); feed renders the E2E run; no design-system
  drift (tokens only); copy gates run.

### HT-6 · Custom tasks (management + chat parity)
- "New task"/Edit/Delete in the tab (server actions, guarded lib);
  `create_task`/`list_tasks`/`update_task`/`delete_task` agent tools;
  dispatch-session refusal rule; custom runs deliver per
  `delivery_pref` through the same channel.
- Acceptance: "remind me Tuesdays 3pm" via chat appears in the tab and
  fires in dev dispatch; a dispatched session calling `create_task` is
  refused (fixture); delete requires explicit confirmation in chat.

### HT-7 · Events + guards + ledger
- Registry: `tasks.run_completed` {family_id?, kind, status},
  `research.brief_sent` {family_id, channel},
  `knowledge.row_merged` {topic_type, gate}. Emitters wired,
  `check:events` green; all four guards + build green.
- Backlog annotations (M3-04 folded here, M3-08 pulled forward) and the
  build-log entry land with this plan; HUMAN-TODO gains the two founder
  switches when built: `FLEET_RESEARCH_ENABLED`, `MORNING_BRIEF_ENABLED`
  (a read-aloud of the first real brief is the flip ritual, journal
  precedent).

## Sequencing

1. **HT-1** (rails; journal must not wobble).
2. **HT-2 → HT-3** (corpus starts filling immediately; nothing
   parent-visible yet, zero risk while it bakes).
3. **HT-4** (the killer feature; E2E before any flag flips).
4. **HT-5**, then **HT-6** (feed first so day one has evidence; custom
   tasks ride the proven rails).
5. **HT-7** finishes the ledger work, though events/guards land inside
   each ticket as they go.

Rough shape: HT-1/2 carry migrations and verification; HT-3/4 are the
judgment work where the killer-feature quality lives; HT-5/6 are UI
with copy gates; HT-7 is bookkeeping.

## Cost posture

Fleet: N topics/night regardless of family count (default 5; founder
knob). Brief: one no-search model pass per family per weekday, cheap,
plus at most one gated top-up search. Models env-swappable
(`HOMA_RESEARCH_MODEL`, `HOMA_BRIEF_MODEL`, default `HOMA_MODEL`); every
call lands in `model_usage` (surfaces `fleet_research`, `morning_brief`)
per the plan-included ruling in 08-billing-credits-design.md.

## Unknowns pass record (finding-unknowns skill, this session)

- Resolved from code: scheduling/delivery/timezone/taxonomy rails all
  exist (see §What exists today); SMS is live; `web_search` on,
  `web_fetch` off; `agent_schedules.kind` constraint and the missing
  runs table were the real gaps.
- Founder-decided: D-ht-1 .. D-ht-5 above.
- Deliberately deferred: weekly scoring/note as task kinds (M3-01/02),
  local discovery (M3-12) as a kind with S1 quarantine, interventions
  lifecycle (M3-03), knowledge_bank Layers 4/5 injection into chat
  context (education plan's own tickets), MJ-27 quiet mode as the
  fatigue valve, mobile app tab (web first), any human moderation UI
  (the `status`/`flagged_reason` columns keep it possible).

## What this deliberately does not do

- No per-family open web research by default (D-ht-1); the top-up cap
  is the only family-tier search, and it is corpus-building, not
  private.
- No silent plan mutations from research; briefs offer, chat accepts.
- No new delivery stack: the dispatch channel and email shells are the
  only doors out, and replies remain ordinary agent turns.
- No dollar amounts in `model_usage`; quantities only, priced later
  (standing 08-billing sequencing).
