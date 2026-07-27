# Carolyng feedback tickets · 2026-07-25 (CG series)

> **STATUS (2026-07-25): ALL OPEN.** Nothing in this doc is shipped.
> Tracking moved to GitHub Issues the same day (founder directive):
> CG-01 = #171, CG-02 = #174, CG-03 = #176, CG-04 = #175, CG-05 = #172,
> CG-06 = #170. This doc stays the spec; the issues carry status.
> CG-01 and CG-06 contain suspected live production failures and carry
> explicit escalation notes per the prod-bugs ruling
> (`prod-bugs-fixed-not-stored`, 2026-07-14): they could not be fixed in
> the session that found them because prod access (Supabase, founder
> console, Vercel logs) was not available there; this doc is the
> escalation, filed the same day.

Source of truth for every ask:
`docs/homa-planning/journeys/evidence/raw/2026-07-25-carolyng-whatsapp-feedback.md`
(L-refs below are its locators). Carolyng is a co-founder dogfooding the
real product; her family is `304f0003-…` in prod, the same family as the
2026-07-19 voice fabrication incident
(`docs/homa-planning/plans/2026-07-20-voice-materials-bridge.md` §1).

Read first: `AGENTS.md` (voice, tenancy, tool-honesty laws), the evidence
file, and for any UI ticket `docs/homa-design/SKILL.md` (never invent
tokens or components). Codebase findings below were verified against the
2026-07-25 tree.

## Order at a glance

| # | Ticket | Size | Gate |
|---|---|---|---|
| CG-06 | Pull evidence for the invisible-web-replies session (logs decay) | S | None; time-sensitive |
| CG-01 | Phone-call amnesia: verify the 07-25 call in prod, close the continuity gap, extend the voice honesty boundary to planning claims | M | Prod access (Supabase or founder console) |
| CG-05 | Voice note over SMS failed: diagnose which of three known paths, fix the audio-as-file routing gap | S | Prod message row for her attempt |
| CG-02 | Hours surface: per-day log by subject, editable, running totals per child, subject filter (finishes the M3-05 product half) | L | Founder scoping: where it lives (see CG-03 overlap) |
| CG-04 | Binder in-progress area: surface drafts, persist and resume chat-born working plans | M | Founder call: drafts inside binder vs a separate area (she offered both, L13) |
| CG-03 | Calendar and homeschool planner in 1: direction lab first, then build | Lab M, build XL | Founder direction pick after the lab |

Not ticketed: L11/L12 phone-plus-email praise is a keep-doing signal (the
voice `send_email` webhook works and delights; see §CG-01 findings).
L28/L29 ("integrate into people's lives beyond homeschool", "rely on homa
for general life") are positioning inputs for journeys/07, not build
tickets. L19's "Also cosmo?" is unclear and stays uninterpreted. The Dock
and Skylight screenshots are directional references only, not specs.

---

## CG-06 · Pull evidence for the invisible-web-replies session (S, time-sensitive)

Source: L1, L2, L10, L12. In a web session (timestamps 5:12 to 5:13 PM,
likely 07-24), Carolyng typed "Where's what I just typed?" and "Homa
where are your responses?" while Homa's replies claim to have been
sending. In the screenshot the replies ARE present, so they either
rendered late or never painted on her device in the moment. She then
churned to Claude for the task (L11): this is a retention-grade failure.

- Per-turn eve failure reasons live only in Vercel runtime logs (project
  `prj_pKBD87W4tmlT7lnYRgrs8WYociTz`, team Homa); v2 briefs never persist
  the model's terminal message or stream trace. Runtime log retention is
  short. **Pull and archive the logs for her turns first, before any
  other work in this doc.**
- Correlate: `conversation_messages` rows for family `304f0003-…` around
  the screenshot window vs what the logs say streamed. Candidate causes:
  stream stall on the client, session-rotation edge, mobile Safari
  display issue (mobile parity memory notes suspected silent renders).
- Acceptance: a written diagnosis with evidence, and either a shipped fix
  or a named repro. If logs are already rotated, say so explicitly and
  instrument: add whatever minimal turn-delivery telemetry would have
  answered this, so the next report is diagnosable.

## CG-01 · Phone-call amnesia (M, prod access required)

Source: L12, L14. "I called HOMA this morning and she squared away my
itinerary" then "We talked about our trip and she allotted hours to
subjects and chat has no idea what I am talking about." Also L12: "I am
waiting to see where she added the school hours from my phone call."

What the code says (verified 2026-07-25):

- Web chat's automatic context
  (`apps/web/agent/instructions/family-context.ts`) never reads
  `call_transcripts`. Call content reaches web chat only through (a) the
  on-demand `recall` tool (`apps/web/agent/tools/recall.ts:121-136`),
  which the model must choose to invoke, and (b) post-call memory
  extraction (`apps/web/lib/learning/call-memory.ts`) into
  `family_memories`.
- Both paths are delayed: `syncCallTranscripts`
  (`apps/web/lib/voice/transcript-sync.ts:224`) runs on the hourly cron
  (`apps/web/vercel.json:6`), and memory extraction runs a later pass,
  only once the transcript is settled, capped 3 per pass
  (`transcript-sync.ts:267-279`). For an hour or more after a call there
  is nothing for recall to find. "Chat has no idea" is the designed
  behavior, and it fails the parent.
- The general voice line has exactly four tools
  (`scripts/telnyx-provision.mts:458-465`): send_email, remember,
  log_hours, send_signup_link. None writes a plan. `log_hours` records
  retrospective minutes to `hours_log`, it does not allot hours to
  subjects. The `Curriculum` type has no hours field. So if Homa claimed
  on the call that she HAD allotted hours, that is the 07-19 fabrication
  class on a surface (planning and scheduling claims) that the Phase 0
  honesty boundary (`apps/web/agent/general-call-instructions.md:22-59`,
  which covers worksheets, binder, email attachments) does not name.

The work, in order:

1. **Verify in prod** (Supabase `homa-prod` or founder console): the
   07-25 morning `call_transcripts` rows for family `304f0003-…`. Did
   the call invoke `log-hours` (rows in `hours_log` with
   `source='call'` that day)? Quote exactly what Homa said about hours.
   Decide: fabricated durable-write claim vs verbal-only discussion.
2. **If fabrication: extend the honesty boundary.** Add planning,
   scheduling, and hours-allotment claims to the "you cannot do this,
   never say you did" list in `general-call-instructions.md`, and
   re-push via `scripts/telnyx-provision.mts` (provisioning push is the
   deploy path per PR #88; do not leave the edit stranded uncommitted,
   that exact failure cost 2 days in July).
3. **Close the continuity gap structurally**, two smallest moves:
   sync the transcript at call end (Telnyx call-ended webhook) instead
   of waiting for the hourly cron, and surface a bounded "recent phone
   calls" line in the per-turn family context (dynamic instructions are
   the ruled home for fresh bounded context, AGENTS.md placement table)
   so web chat knows a call happened and recall has something to find.
4. Acceptance: a fresh phone call is visible to web chat within a
   minute of hangup ("what did we just talk about on the phone?" gets a
   correct answer), and no voice line can claim planning writes it
   cannot make. Add a continuity test (`pnpm check:continuity` touches
   this module).

Escalation note (prod-bugs ruling): the fabrication half, if step 1
confirms it, is a live tool-honesty-law violation in production,
recurrence of the 2026-07-19 class. This doc plus the founder reply of
2026-07-25 is the escalation; the fix in step 2 is small and should ship
the day step 1 confirms.

## CG-05 · Voice note over SMS failed (S)

Source: L18. "Homa unable to read a voice note over text."

What the code says: SMS voice-note transcription IS built and robust.
Inbound audio attachments route through `normalizeSmsAttachments`
(`apps/web/agent/channels/telnyx.ts:492`) to Telnyx STT, Whisper large v3
turbo (`apps/web/lib/voice/transcribe.ts:36-120`), including iPhone
AMR/3gpp handling. Failures fail soft: a note "[A voice note was attached
but could not be transcribed.]" or the direct reply "I couldn't quite
make out what you sent." Three candidate causes for her report:

1. STT returned null (bad clip, download or API error).
2. **A real routing gap**: audio arriving typed `file` with an `audio/*`
   MIME hits `kindForFile` (`apps/web/lib/voice/sms-attachments.ts:228-238`),
   which recognizes only documents and drops the audio as unreadable
   without ever reaching STT.
3. The note never arrived as usable MMS (e.g. iMessage audio message to
   a non-iMessage number; the header comment at `telnyx.ts:62-68` only
   guarantees HEIC and Live Photo fallback).

The work: find her inbound message row and Telnyx media record, identify
which path fired, then fix cause 2 regardless (route file-typed `audio/*`
attachments into `processSpeech`; it is strictly better handling) and
add a fixture. If cause 3, the fix is copy: reply telling the parent
that carrier audio messages do not arrive and to use the app's voice
notes. Acceptance: her exact clip format transcribes or gets an honest,
specific reply, with a test covering the chosen path.

## CG-02 · Hours surface: the calendar day log (L)

Source: L12, L16. Verbatim spec from a co-founder who tracks state
compliance: per-day view of hours logged by subject, editable, running
totals per child per week, month, and school year, filter by subject,
state minimums in view ("some states require a certain amount of hours"),
auto-logged blocks split by subject (her example: a 45 minute lesson
logs as 30 min math plus 15 min reading), manual additions move the same
counters (her Spanish example).

What exists (verified): the substrate is `hours_log` (migration #37):
minutes 1 to 600, coarse subject enum (`apps/web/lib/hours-model.ts`),
`happened_on` date, nullable child, source chat/sms/call, RLS. Writers:
`log_hours` chat tool, voice `log-hours` webhook, both via
`recordHoursPinned`. Readers today: the agent's transient week sum and
the founder console. **No parent-facing page reads it at all.** This is
the unfinished half of M3-05 ("hours engine + product surfaces"
remaining) and the F4 journey (journeys/04 §F4), and it overlaps open
ticket T9 (day log) from the 07-07 tester feedback.

Net-new inside the ticket:

- A parent hours view under `/app` (day rows by subject, week grid, or a
  lane on the planner: placement is the founder scoping call, and CG-03's
  lab may decide it). Editable entries (RLS already allows member
  insert/delete; add update or delete-and-replace).
- Running totals per child per week/month/school-year and a subject
  filter. `hours_log` is already indexed `(family_id, happened_on)`;
  totals are a GROUP BY, exactly as the migration comment promised.
- State minimums: `state_requirements` (migration #21) has NO
  minimum-hours field today, and the state card copy already promises
  tracking aspirationally (`state-card.tsx:102-105`). Add the field via
  the existing statute-sourced refresh runbook, never hardcode.
- Splitting: `log_hours` takes one subject per call. Teach the skill
  layer to log two blocks from one sentence (model judges the split,
  code validates each block; models judge, code verifies). No new tool
  needed.
- Subject vocabulary: `hours_log` subjects are coarser than planner/MAP
  subjects and do not share an enum. Decide the mapping before building
  the filter, or the filter will lie.
- Voice: reassure-before-inform, no red "behind" states even when a
  state minimum is unmet; growth framing only (M1-17 law).

Acceptance: Carolyng can answer "where did she add the school hours from
my phone call" herself in under 10 seconds, edit a wrong row, and see
year-to-date totals per child vs her state's stated minimum with a
statute link and last-verified date.

## CG-04 · Binder in-progress area (M)

Source: L13. "I would like to see things in progress in the binder and
have the option to go in a finalize. Or have an in progress area.
Because I was working on a plan with her and then jumped to NYC and now
I have to find that."

What exists (verified): the binder is hard-pinned to finalized materials
(`apps/web/app/app/binder/page.tsx:45-48`, `status: "final"`), so drafts
are invisible by construction; this is the same root as the known
finalize gap (materials stranding in draft, still open after PR #136).
A best-draft selector already exists and is unused by the binder
(`apps/web/lib/materials/parent-visible.ts`). Chat working state is
deliberately ephemeral (daily session rotation,
`apps/web/app/app/chat-storage.ts:14-49`; the planner canvas is
chat-turn state, `planner-canvas.tsx:14-26`), so a plan being co-drafted
in chat has no persistent object anywhere. The existing pattern for
resumable in-progress work is `agent_jobs` plus `/app/tasks`.

Two halves, one ticket:

1. **Materials drafts get visible.** An "in progress" section or filter
   in the binder fed by `parent-visible.ts`, each draft carrying a
   finalize action (reuse `finalizeMaterialCaller`). Guard the Blob
   deletion path (`library.ts:662-676`) so surfacing drafts never shows
   a card whose bytes are gone. This also converts the finalize-gap
   class from invisible to self-serve recoverable.
2. **Chat-born working plans persist.** When a planning thread produces
   a draft plan that is not saved to the real planner, it must land as a
   durable in-progress object the parent can reopen and finish, not
   live in scrollback. Model it on `agent_jobs`/`/app/tasks` rather
   than inventing a new primitive; founder call on whether it surfaces
   in the binder or a separate "in progress" area (she offered both).

Acceptance: her exact story replays clean, work on a plan, switch topics
to a trip, come back tomorrow (post session-rotation), find the plan in
one obvious place, finish and finalize it.

## CG-03 · Calendar and homeschool planner in 1 (lab M, build XL)

Source: L16, L19, L21 to L27. Not Google Calendar (L20/L21): Homa's own
calendar where the family's real life lives, so Homa can fit school
around it. Per-kid lanes plus a family lane, color coded (L24, L27).
Check off lessons, Homa-added lessons, family subjects, activities,
appointments (L24). Homa optimizes: "doctor's appt on Tuesday let's push
things back", "ara does better with math in the morning" (L21). Homa
herself told Carolyng this is a someday (L22): the model already sells
the vision, the product owes it.

What exists (verified): almost nothing of this.

- The plan model has no dates and no durations
  (`packages/core/src/map/plans.ts:19-37`); weekday placement is
  presentation-only (`apps/web/app/app/planner/spread-week.ts:6-9`),
  and persisted per-day scheduling is the explicitly unbuilt milestone
  the code names (`day-grid.tsx:16-19`).
- There is NO family events, appointments, or trips table anywhere;
  `homa_tasks_framework` schedules Homa waking up, not parent events.
- No optimizer exists and cannot yet: nothing persists which day school
  lands on.

This matches the F5 journey (journeys/04 §F5), whose own design flag
says the multi-child week arrangement is undesigned. Carolyng just
designed a first draft of it, and F5's authored scenario ("co-op
Tuesday, dentist Thursday" constraints) is her exact ask.

Sequence, deliberately:

1. **Direction lab first** (repo convention: the dated `-directions.html`
   labs). 3 or 4 explorable directions for one surface that merges
   planner and calendar: per-kid lanes vs child switcher, family lane
   treatment, where hours (CG-02) render, what check-off looks like,
   how an appointment visually pushes school. Use design-system tokens
   only. The Dock and Skylight references are mood, not spec.
2. Founder direction pick, recorded as a ruling.
3. Build in slices behind the ruled direction: (a) persisted per-day
   scheduling for plan activities (finally lands M2-10's missing
   substrate), (b) `family_events` table plus agent tools to add events
   from chat, voice, and SMS (tenancy laws apply: familyId never
   model-supplied), (c) the merged surface, (d) the optimizer LAST, as
   a fat skill orchestrating narrow move/reschedule tools (judgment in
   the skill, date math and writes in code, per AGENTS.md).

Explicitly out of scope until ruled: external calendar sync (Google),
and any Skylight-style hardware framing.

## Journey deltas (fold at next reconciliation, do not edit journeys mid-audit)

- **F4 Hours & compliance** (journeys/04 §F4): add Carolyng 2026-07-25
  as primary field evidence (P4-equivalent voice from a co-founder);
  add requirements: per-day editable log view, subject filter, running
  totals per child per week/month/year, manual add adjusting the same
  counters, auto-split of one block across subjects.
- **F5 Weekly planner** (journeys/04 §F5): resolve the multi-child
  design flag with her structure (per-kid lanes plus family lane, color
  coded); add the family-events constraint surface (its own calendar,
  not Google) and the optimize-around-life behaviors; add "calendar and
  homeschool planner in 1" as the stated user model.
- **F2 Voice capture** (journeys/04 §F2): add voice-note-over-SMS as an
  explicit capture path with its three failure modes and honest-fallback
  copy.
- **05-edge-cases**: add cross-channel continuity expectation: a parent
  treats Homa as one person across phone, SMS, and web; any channel
  answering "no idea" about another channel's conversation is a trust
  break (L14), and any channel claiming another channel's abilities is
  a tool-honesty violation.
- **07-positioning**: L28/L29 verbatim quotes ("no separations between
  home and school", "rely on homa for general life") as
  co-founder-stated north star for the beyond-homeschool arc.
