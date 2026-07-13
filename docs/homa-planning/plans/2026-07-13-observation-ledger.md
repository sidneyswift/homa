# The observation ledger · parent input about a child is never wasted

> Status: PLAN (founder direction 2026-07-13 morning, chat-derived; not
> yet built). Grounded in a production incident from the night before:
> a real parent report about a real child produced no durable write
> anywhere except an audit row. Production evidence is in §2. Founder
> sign-off on the open decisions in §7 turns this into tickets.

## 1. Founder direction, distilled (2026-07-13 morning)

1. Parent chat input about a child's abilities is the most valuable
   resource the product has. Homa must NEVER waste it.
2. Every such input is saved as SOMETHING and/or linked to the child's
   progress, and classified by its effect on scoring: no effect,
   raises, or lowers.
3. Homa should see where the child is in the learning sequence, judge
   whether the input fills a gap, and store it with tags so it can be
   used within the week.
4. The reuse is intelligence reinforcement for the parent: for example,
   Homa texts the next morning with a simple lesson built on what the
   parent reported the night before.
5. In the moment itself, Homa should commit to the follow-up. At 11pm
   the right reply is "I noted that on Emma's record, and I'll weave it
   into her math this week", not a compliment that saves nothing.
6. Homa must not be blocked by our own system, and she must know how to
   navigate it.

Stated as one law: a parent's statement about a child's ability is
never discarded. It is always written somewhere durable, always
classified by its effect on scoring (none, raises, lowers), and always
fed forward into what Homa does for that family within the week.

What this law does NOT change: scores still move only when the
server-side matcher maps the parent's exact words to a reviewed bank
item. The model still cannot invent evidence, quotes, or scores. This
plan splits "does it score?" from "do we keep it?", which were
accidentally the same question.

## 2. The incident that proves the gap (production, 2026-07-12 night)

The Noser family, verified in homa-prod on 2026-07-13:

- 11:00:09pm local: Sara texts that Emma (3) recognized "chapter 11"
  in print, unprompted. Two-digit numeral recognition.
- 11:00:23pm: the agent correctly calls manage_child_progress with
  record_journal_evidence. The matcher returns no_match (there is no
  bank item for numeral recognition in her band, and the clause
  attributes "read" to the parent, not the child). The only write is
  the child_progress_operations audit row.
- 11:00:29pm: Homa replies "I'll hold that as a sweet moment rather
  than a formal update". Nothing was held. The family's
  family_memories table has zero rows.

The tool result note is the root cause. It delegates durability to the
model's discretion and the model dropped it:

- NO_MATCH_PROGRESS_NOTE (tool-result-contract.ts): "No specific
  progress skill matched strongly enough. Keep this as journal or
  memory context, and do not claim a progress update."

"Can't score it" currently implies "didn't keep it". Those must be
different outcomes.

## 3. What already exists (reuse, do not rebuild)

- **Scored evidence and effect classes.** child_progress_evidence rows
  raise a score (easily, getting_there), lower it (not_yet), or open a
  conflict. This is the founder's "raises / lowers" half, already
  deterministic and server-side. Untouched by this plan.
- **The matcher already computes what we need to keep.**
  journal-matcher.ts scores every bank item against the parent's
  clause and then throws away everything below threshold. The top
  candidates ARE the tags the founder asked for; today they die in a
  local variable.
- **The operations audit.** Every journal call already writes a
  child_progress_operations receipt inside a transaction with
  idempotent replay. Observation capture slots into the same
  transaction and inherits replay safety for free.
- **The proactive rail is live.** The hourly dispatcher
  (agent/schedules/dispatch.ts) wakes the agent per family;
  morning_brief runs Mon-Fri 9am local behind MORNING_BRIEF_ENABLED,
  with per-child scored positions and frontier lines pre-loaded by
  lib/tasks/brief-context.ts, composed under
  agent/skills/research-brief/SKILL.md. "Text her tomorrow with a
  lesson" is a context gap in this rail, not a new system.
- **family_memories stays what it is**: stable facts and what-works
  signal, char-budgeted. Observations are a different thing (moments
  and reports, append-only, time-decaying) and do not compete for the
  memory budget.

## 4. Design: the third store and its loops

Homa gains a third durable store between scored evidence and memories:

| Store | What it holds | Score effect |
|---|---|---|
| child_progress_evidence | matched, reviewed skill lines | raises or lowers |
| child_observations (new) | everything the parent said about ability that could not score | none |
| family_memories | stable facts, what-works | none |

### 4.1 Capture is server-side, never model-optional

recordJournalProgressEvidence (progress-service.ts) writes a
child_observations row inside the existing transaction whenever the
match outcome is no_match, activity_only, or ambiguous. Matched
outcomes do not write one; the evidence row already preserves the
quote. Replays cannot double-write because claimOperationOrReplay
short-circuits before matching.

The matcher's return shape for no_match gains the top three scored
candidates (item id + score), so the row stores the nearest skill
lines even when nothing crossed the threshold. Subject hints derive
from those candidates plus the model-supplied optional subjectId.

Schema sketch (additive migration, conventions copied from
child_progress_evidence):

```sql
create table public.child_observations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  member_user_id uuid references auth.users (id) on delete set null,
  quote text not null check (char_length(quote) between 1 and 2000),
  channel text not null check (channel in ('web', 'sms', 'email')),
  message_id uuid,
  provider_message_id text,
  classification text not null check (
    classification in ('no_match', 'activity_only', 'ambiguous')
  ),
  candidates jsonb not null default '[]'::jsonb,
  subject_hints text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new', 'used')),
  used_task_run_id uuid,
  used_at timestamptz,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint child_observations_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade on delete cascade
    deferrable initially deferred
);

create index child_observations_reinforcement_idx
  on public.child_observations
  (family_id, child_id, status, created_at desc);

alter table public.child_observations enable row level security;
create policy "members read child observations"
  on public.child_observations for select to authenticated
  using (public.is_child_family_member(child_id));
revoke all on table public.child_observations
  from public, anon, authenticated;
grant select on table public.child_observations to authenticated;
```

Writes stay on the guarded server path (mapDb), the same posture as
every other ChildProgress table.

### 4.2 The same-turn contract changes

The two non-scoring notes stop stranding the model. New model-facing
text (literals in tool-result-contract.ts; the parent-facing behavior
they induce goes through the copy gates in ticket OBS-2):

- no_match: "Saved as an observation on this child's record. No score
  changed because it did not match a reviewed skill line yet. Tell the
  parent you noted it, and offer one way to build on it this week."
- activity_only: "This describes activity or time, so no score
  changed. It is saved as an observation. Use log_hours for a stated
  duration, and offer one way to build on the activity this week."
- ambiguous keeps its ask-first behavior; the observation row exists
  underneath so the moment survives even if the parent never clarifies.

instructions.md and the SMS block (instruction-guidance.ts) gain the
matching line: when the journal tool reports an observation save,
acknowledge it and commit to the follow-up ("I noted that on Emma's
record. I'll weave number spotting into her math this week."), and
never promise a lesson at night; the morning loop delivers it.

The web transcript keeps rendering no card for these kinds
(progress-message-parts.ts is unchanged in v1; see open decision Q1).

### 4.3 The reinforcement loop (used within the week)

loadBriefContext (lib/tasks/brief-context.ts) gains one query: status
'new' observations from the last 7 days, capped at 3 per child, and
renders them as a labeled data block next to the frontier lines it
already renders ("What parents shared this week, not yet built on",
with child name, short quote, weekday, and the observation id). Same
data-never-instructions posture as the knowledge rows.

The research-brief skill's "Pick ONE angle" list gains a new first
entry: a fresh parent observation that touches a child's frontier or
current work, the strongest possible angle because it is her own
report meeting real research. After composing a brief built on one,
the session calls the new manage_child_progress action
mark_observation_used with that observation's id.

mark_observation_used: model supplies only the observation UUID (shown
in trusted context). Family scope comes from session auth; the run id
comes from the dispatch session's taskRunId attribute, never the
model. It flips status to 'used' and stamps used_at and
used_task_run_id. The action must accept dispatch-channel sessions
(record_journal_evidence stays restricted to web, sms, email inbound).

Used observations never resurface. New ones older than 7 days simply
age out of the query; no third status.

### 4.4 The bank growth loop (later, cheap because capture exists)

no_match observations with their stored candidates are the fleet-wide
signal for missing bank items ("ten families reported numeral
recognition and nothing matched"). Phase one only makes them visible
per family in the admin deep view. Clustering and back-crediting old
observations after a bank item ships are explicitly deferred
(§6 non-goals).

### 4.5 Events

Two additions to the MJ-08 registry (packages/core/src/events.ts),
emitted from the committed-operation path in progress-events.ts,
following the existing rule that quotes and contact data stay out of
analytics props:

- progress.observation_saved: family_id, child_id, classification
- progress.observation_used: family_id, child_id

## 5. Tickets

**OBS-1 · capture (ships the law).**
Migration supabase/migrations/<ts>_child_observations.sql as §4.1.
journal-matcher.ts returns top candidates on no_match.
Repository interface + postgres-repository.ts gain appendObservation
inside the transaction; progress-service.ts writes it for the three
non-scoring classifications. Events per §4.5.
Tests: journal-matcher.test.ts (candidates on no_match),
progress-service.test.ts (InMemory repo: observation persisted per
classification, none on matched, replay writes once), extend the
child-progress e2e harness scenario.
Guards: pnpm check:isolation before the schema lands, pnpm
check:events, pnpm check:child-progress, pnpm child-progress:e2e.

**OBS-2 · same-turn contract.**
tool-result-contract.ts note literals per §4.2 and schema updates;
tool-result-adapter.ts unchanged shapes; instructions.md rows and the
progress section; instruction-guidance.ts SMS block.
Parent-facing behavior lines go through homa-copy-reviewer then
homa-copy-editor.
Tests: tool contract and trust tests, instruction-guidance.test.ts,
progress-interaction-policy tests if copy is asserted there.
Guards: pnpm check:continuity (SMS guidance changed), pnpm
check:progress-ui, and pnpm --filter web exec eve build locally
(agent tool surface changed).

**OBS-3 · reinforcement loop.**
brief-context.ts query + render block; research-brief SKILL.md new
first angle and the mark-used rule; tool-contract.ts +
tool-adapter.ts + runtime.ts + repository methods for
mark_observation_used with the dispatch-channel allowance.
Tests: brief-context tests (extend or add alongside lib/tasks tests),
tool adapter routing, service test for scoped status flip (wrong
family refused).

**OBS-4 · admin visibility.**
family-deep-data.ts gains an observations query (pattern: the
family_memories query at its line ~222); the family Brain tab renders
an "Observations" section with classification, status, and age.

**OBS-5 · founder ruling on the record.**
Append the ruling ("parent input about a child's ability is never
wasted; observations are captured server-side and fed forward within
the week") to docs/homa-planning/build-log.md and the founder-ruling
index (journeys/10-reconciliation.md §5 later-ruling register), citing
this plan.

## 6. Non-goals (explicit)

- No model-side scoring of unmatched observations. The reviewed-bank
  law stands.
- No automatic family_memories writes from observations. Different
  store, different budget, different purpose.
- No back-crediting v1: re-matching stored observations after a bank
  item ships is designed-for (quotes, timestamps, provenance are all
  kept) but not built now.
- No new proactive system and no new task kind. The brief carries the
  reinforcement; a dedicated "observation follow-up" kind is a future
  registry entry if briefs prove too narrow.
- No parent-facing "observations" surface yet (see Q2).

## 7. Open decisions for the founder

- **Q1 · web chat acknowledgment.** When an observation saves on web
  chat, v1 shows no card (text acknowledgment only, same as today).
  A small "Noted on Emma's record" card can come later. Proposed:
  later.
- **Q2 · parent-visible surface.** Do observations appear on the
  family Progress page, or stay admin-only until the loop proves
  itself? Proposed: admin-only for launch week.
- **Q3 · freshness and cadence.** 7-day window, cap 3 per child in
  brief context, at most one observation-built brief angle per day
  (the skill's one-angle rule already enforces this). Confirm.
- **Q4 · activity_only inclusion.** "We read for 30 minutes" saves as
  an observation too (classification kept, log_hours still owns the
  duration). Proposed: yes.

## 8. Rollout order (deploy laws apply)

1. OBS-1 migration is additive-only, so it may lead or ship with the
   code push. Run pnpm check:isolation before it lands.
2. Capture rides the existing journal path, so it inherits the
   ChildProgress rollout posture and flags; no new env flag.
3. OBS-2/OBS-3 touch apps/web/agent: run pnpm --filter web exec eve
   build locally before pushing, then watch the Vercel deploy to READY
   and probe a live journal message end to end (expect an observation
   row where last night produced only an audit row).
4. The brief integration stays dark wherever MORNING_BRIEF_ENABLED is
   off; no separate switch.
