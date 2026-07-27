# One planner: consolidating the planner, calendar, lessons, and curriculum ecosystem

Date: 2026-07-27. Status: council-adjudicated proposal; founder rulings pending
(§5). Investigation method: ten parallel deep-readers over the codebase
(planner surface, calendar surface, data model, lessons and curriculum, chat
tools, design system, docs and rulings history, mobile, customer journey,
external world-class research), a six-expert council (product design, systems
architecture, a veteran homeschool parent, agent architecture, growth, mobile
platform) run as independent critique, cross-debate, and adjudication, plus a
completeness critic over all twelve outputs. Every claim carries a file
reference. §7 records the council; §8 maps the work to GitHub issues.

## 0. TLDR

Homa has two week surfaces that disagree about what day school work happens
(/app/planner guesses, /app/calendar knows), four database vocabularies for "a
thing happens Tuesday," five product notions answering to the word "lesson,"
four color systems over the same four tokens, and a chat tool surface that can
write calendar dates it can never read back. The co-founders asked for
"calendar and homeschool planner in one" (CG-03) and the right substrate
shipped this week (migrations 2026-07-26, PRs #232 and #250 merged
2026-07-27), but we stopped one step short: the calendar page is the unified
surface, and the planner board is a legacy guess that now sits beside it in
the nav, wearing a calendar icon.

The proposal: finish the convergence. One surface, named **Planner**, at
/app/planner, built on the calendar's real substrate: a checkable "this week"
register plus the week grid, day and week views (month is a founder trade,
§5), cards colored by the calendar's own law (per kid, family stripe for
shared things), tap and drag to schedule and unschedule, a chat canvas that
shows the same truth, tools that can read what they write, and curriculum
output that finally lands on the week instead of stranding in the binder.

The justification, stated precisely (council ruling, §7): the tool-read fixes
and PR A are **defect repair** (a shipped reshuffle procedure that is
unexecutable as written, a fabricated mobile panel narration, rebuilds that
strand wrong dates); the surface unification is **trust repair** (two adjacent
surfaces that contradict each other); only the later phases are **demand
bets**, and those are gated on a post-flip adoption read. Issue #253's zero is
not evidence against demand: it was measured hours after deploy on a feature
with zero discovery loops, and the issue itself says close it on the call, not
the count.

## 1. What exists today (the system map)

### 1.1 Two week surfaces, two truths

**/app/planner** (planner-view.tsx) renders each child's plans' CURRENT week
(derived from `retest_at` minus 28 days, plan-week.ts) spread across Monday to
Friday by `spreadAcrossWeekdays`, which its own header calls "a display guess,
never a saved date." It never reads `plan_activity_schedule`. Cards are
colored by BLOCK_TONES cycling on plan position, so the same plan changes
color when the roster filter narrows.

**/app/calendar** (calendar-view.tsx, PR #232, loose ends closed in PR #250)
is the real week: a Monday to Sunday grid merging three sources through the
pure view-model `buildCalendarBoard` (lib/calendar-view.ts): dated plan
activities (`plan_activity_schedule`), family events (`family_events`, with
real times), and hours chips (`hours_log`). It has drag with half-hour snap,
overlap clustering, all-day banners, per-kid filter chips, and a color law
already ruled in its header: kid tones from `avatarTone`, family stripe woven
from kid tones, "No new colors are invented here."

The planner fleet skill (agent/skills/planner/SKILL.md:31-36) has to teach
Homa that these are "two different views of overlapping but not identical
data" and to "never imply they always show the same thing." That warning is
written for the model; parents get no explanation anywhere.

**The nav confesses the problem** (sidebar-nav.tsx:27-35): Planner (wearing
the lucide `Calendar` icon) sits beside Calendar (wearing `CalendarDays`),
plus Hours and Tasks: four time surfaces among seven tabs. The founder's
nav-labels ruling (10-reconciliation.md:145, as amended by the later
nav-chat-label ruling that renamed "Ask" to "Chat") has one planner entry and
no Calendar tab. The current nav deviates from the recorded ruling.

### 1.2 Four database vocabularies for "a thing happens Tuesday"

| Store | Time shape | On /app/calendar? | Writers |
|---|---|---|---|
| `plan_activity_schedule` | date only, no time; positional key (week, activity_index) into plan JSON | yes | chat tool only; the grid cannot create these rows |
| `family_events` | date range + optional time window on the FIRST day only; no recurrence | yes | grid actions + chat tools |
| `agent_schedules` (custom tasks) | local_hour + weekdays recurrence | no (verified: BuildCalendarBoardInput has no task input) | create_task tool |
| `hours_log` | retrospective date | yes (chips) | log_hours, /app/hours |

A doctor's appointment, "math worksheet Tuesday," "text me Tuesdays at 10,"
and "we did 45 minutes of math Tuesday" land in four tables with four time
vocabularies. The most common family calendar object in the market research,
the weekly recurring commitment (co-op day, piano lesson), has **no correct
home**: family_events has no recurrence, and a recurring task never renders on
the calendar.

Also structural: plans themselves (`child_plans`) are a four-week JSON with no
dates, built one-tap from the progress report; check-offs live in the same
row's `progress` map keyed "week.activityIndex" and feed the retest report.
That spine is load-bearing and correct, and nothing in this proposal touches
it. Note the check-off sync mechanics, though: the server sync replaces the
whole progress map per POST and the client merges local-over-server with true
winning (use-plan-checks.ts:69-71), which is a clobber hazard the moment a
second writer exists (§4.3.6).

### 1.3 The chat tool surface is half-blind and mostly silent

Eleven bounded tools cover five stores, faithful to thin-harness/fat-skills.
But (chat-tools reader, verified by grep):

- **No tool reads `plan_activity_schedule`.** open_planner returns activities
  without their scheduled dates. Homa writes dates she can never read back.
  The skill's reshuffle procedure instructs her to gather "the real scheduled
  activities" and pick the day with "fewest activities already scheduled":
  both unknowable. **The shipped reshuffle procedure is unexecutable as
  written.**
- **The chat canvas shows the guess board, not the truth.** open_planner opens
  PlannerView (spread-week math), so Homa can schedule math to Tuesday while
  the panel beside the parent shows it on Monday.
- **Nine of eleven tools render nothing in the transcript**: no busy label, no
  named-effect receipt (message-parts.tsx has chips only for edit_plan and
  log_hours). schedule_plan_activity, all four event tools, and all four task
  tools are invisible, breaking the MJ-02 visible-effect pattern.
- **No update_family_event**: the grid retimes an event in one gesture; chat
  must remove + re-add, with event loss if the second call fails.
- **list_family_events is today-forward only**: mid-week reshuffles cannot see
  Monday.
- open_planner returns only the current week while edit_plan and
  schedule_plan_activity address weeks 1 to 4, so non-current-week edits
  cannot be grounded in anything the model has read.
- instructions.md never mentions the calendar; prompt-suggestions.md still
  says "There are no Planner or external calendar write scenarios," vocabulary
  from before planner writes went live (PR #61).
- **Voice is a fourth consumer nobody inventoried**: the phone line's
  call-start digest reads plan_activity_schedule directly
  (lib/voice/recent-activity.ts), so schedule-shape changes alter what the
  phone call says; it does not read family_events, so any recurrence expansion
  that lives only in the board would leave voice ignorant of the weekly co-op.
  Voice is also explicitly forbidden to write the calendar
  (general-call-instructions.md:31-33: "add, move, or remove anything on the
  family calendar... say you cannot do that here").

### 1.4 The parent's write surface is asymmetric

The calendar UI can create, edit, and drag family events, but **cannot put
school on real days**: `plan_activity_schedule`'s only writer is the chat tool
(calendar/actions.ts touches family_events only). The surface's core promise
requires a chat round-trip through the `?draft=schedule-week` prefill. There
is also **no unschedule path anywhere**: once dated, an activity can move but
never come off the calendar (verified by repo grep). And plan activities
cannot be dragged at all; only timed family events can.

### 1.5 Latent defects found during this investigation

Exposure note, for the prod-bugs ruling: the substrate has zero real-family
rows (#253 baseline, all sandbox), so items 1 to 3 cannot currently manifest
for any real family; item 4 is live for any parent using mobile chat and is
escalated as such in the session that found it (see §8, the P1 bug issue,
and the session reply to the founder).

1. **Plan rebuild strands schedule rows against the new plan.** The
   child_plans rebuild upsert (lib/map/store.ts:1329-1341) does not touch
   plan_activity_schedule. buildCalendarBoard drops out-of-bounds rows but an
   in-bounds stale row re-reads text fresh from the NEW plan, so after a
   rebuild the calendar shows the new month's activity at a date chosen for
   the old month's activity, presented as real.
2. **A failed drag write is invisible**: the error renders only inside dialogs
   that are closed after a drag (calendar-view.tsx:447-448 vs 1245-1249); the
   block snaps back with no explanation.
3. **Timed multi-day events lose their time**: a multi-day event with a start
   time renders as an "all day" banner, its time shown nowhere
   (calendar-view.tsx:533-559 vs migration 20260726130000:14-16). Confirm in
   code before fixing; this one rests on a single reader's citation.
4. **Mobile honesty gap (live)**: mobile authenticates as channel "web," which
   is not in open_planner's NO_PANEL_CHANNELS, so on every mobile turn the
   model is told "The planner is now open beside the chat; the parent is
   looking at it" while the mobile renderer drops planner parts entirely
   (message-view.tsx falls through to null). Same fabricated-UI class as the
   voice binder incident. Issue #196 suspected this; the code confirms it.
5. **Comment and cosmetic drift**: calendar/page.tsx says the migrations are
   applied at line 22 and NOT applied at line 57 (the former is true); the
   plan_activity_schedule migration comment still documents the edit_plan
   cascade as unfixed although PR #250 fixed it; calendar-view.tsx styles with
   `var(--ink, inherit)`, a token defined nowhere (the fallback works, so this
   is cleanup, not a bug).
6. **The edit_plan schedule cascade is not transactional**: the child_plans
   UPDATE and the per-week delete-then-reinsert of schedule rows run as
   sequential statements (store.ts:886-923), so a crash mid-cascade can
   strand rows pointing at shifted indices. Verify `sql.begin` transaction
   behavior through the Supabase pooler before relying on it (the pooler
   silently ignoring session-level settings is a known scar, tool-deadlines).

### 1.6 Five notions answer to "lesson," and none reaches the planner

(1) lesson_recordings: recorded audio sessions feeding progress evidence. (2)
subject_lessons: auto-built teach-this-next packages, surfaced only on report
pages, living under /onboarding/r/{token} URLs (route-shared.ts:4-11). (3)
curriculum atlas: 155 static profiles (atlas.ts header). (4) child_curricula:
prose curriculum from a phone call. (5) curriculum-studio agent_jobs:
multi-week material builds. **No table, column, or code path connects any of
them to child_plans or plan_activity_schedule.** Curriculum-studio stage
payloads carry structured weekNumber/theme/focus/activities
(lib/jobs/contracts.ts:74-79) that could round-trip into PlanWeek, but putting
a built curriculum on the planner is manual chat labor the skill assigns to
the model one edit_plan call at a time, and nothing prompts it when a job
completes. Approving a curriculum stage only flips stage status
(lib/jobs/store.ts:381-390) and never finalizes materials, so volumes strand
invisible to the Binder (the finalize-gap class, issue #197).

### 1.7 Color: four systems over the same four tokens

BLOCK_TONES by plan position (planner), avatarTone by roster position
(calendar, "a kid keeps their color everywhere"), SUBJECT_TONES by hours-enum
index (hours), KIND_TONES by material kind (binder), plus the trajectory
chart's real per-subject map. "Math" has no stable color anywhere, and the
identical activity card is a different color on the two week surfaces.
Council-verified constraint: AVATAR_TONES and SUBJECT_TONES draw from the same
four hue families (clay, sage, gold, sky), so kid-color and subject-color are
not visually separable at pill scale, and the design system forbids inventing
a distinguishable subject palette inside this proposal. The "calendar colors"
of this product are the kid tones plus the family stripe, which is what the
co-founders asked for ("Color coded per kid," the Skylight reference) and what
the calendar already ships.

### 1.8 Discovery: nothing routes a parent to either surface

No email links to /app/planner or /app/calendar (lib/map/email.ts links
report tokens, ?draft=journal, /app/tasks). The suggestion rail cannot route
into the planner (prompt-suggestions.md:39). Voice refuses calendar writes
(general-call-instructions.md:31-33). Mobile has no planner or calendar
surface, no deep link, and renders planner tool parts as silence. The planner
board's own links leave the app namespace into /onboarding/r/{token} URLs.
Cross-linking is one-way (calendar links planner; planner never links
calendar). Onboarding's skill calls the planner "the calendar" in the exact
flow where a new family forms its vocabulary (onboarding SKILL.md:325). F5's
instrumentation spec (planner.requested, planner.committed,
planner.week_completion) exists in no shipped code.

## 2. What the customer experiences

Carolyng's own words built CG-03: "have an option for each kid and then a
family calendar... check off each kid's lessons, added homa lessons, family
subjects, related activities, appts etc." One surface, checkable, holding
school and life together. What she gets today:

- Two adjacent tabs whose difference no parent-facing copy explains, where
  checking a box on either syncs (same check store) but the same activity sits
  on different days with different colors.
- A calendar that cannot schedule school work without a chat round-trip, and a
  planner whose only verbs are check and navigate.
- A week that cannot hold her real life's most common shape (weekly co-op),
  cannot show "math at 9," and cannot take a wrongly scheduled thing back off.
- An assistant that says "moved it to Thursday" while the panel beside her
  shows Monday, gives no receipt chips for calendar writes, and on her phone
  says the planner is open when nothing happened.
- A curriculum she commissioned that finishes into a tasks card and never
  appears on her week.
- One thing her quote names that the data model cannot represent at all:
  **family subjects** (morning basket, family read-aloud). Plans are strictly
  per child+subject; the family lane holds only events, which are neither
  checkable nor connected to progress or hours. Named as an open item in §5.

The F5 journey (journeys/04) defines the planner's job: a week drafted from
the child around her real constraints, committed in minutes, checked off with
zero nagging, replanned without guilt when the week collapses. Its metric is
done-rate, not plan-beauty. The market research (below) says the killer
workflow is not creating the schedule but repairing it. Both point at the
same product: one legible week, cheap to repair.

## 3. The world-class bar, and the delta

From the external research pass (Homeschool Planet, Homeschool Tracker,
Skylight, Cozi, Google/Apple Calendar, Motion, Reclaim):

1. **Plan and schedule are separate objects.** The field's core insight
   (Homeschool Tracker): lesson plans are ordered and date-free; the schedule
   projects them onto dates. If every assignment is born tied to a date, every
   disruption forces mass rescheduling. Homa's child_plans vs
   plan_activity_schedule split is ALREADY this architecture. The mistake
   would be forcing all school work onto dated slots; the gap is that our two
   projections (guess board, real calendar) coexist as rival surfaces.
2. **School work is sequence-first, life is calendar-first.** Homeschool
   parents run loop schedules and daily checklists; "a homeschool mama's life
   does not start and stop in 15-minute increments." Best-in-class renders the
   same work as a calendar for the parent AND a checklist. One surface, two
   registers.
3. **The killer workflow is repair.** Homeschool Planet's standout feature is
   the bump: auto-reschedule incomplete work, one-gesture catch-up, and it
   earns trust by being reversible. Motion and Reclaim auto-reflow around
   fixed events. Nobody in the homeschool market does AI-native reshuffle yet:
   our reshuffle skill is exactly this, and it is currently starved of reads.
4. **Day/week/month plus a list view is table stakes** (Google, Apple), with
   consistent visual language across views so switching is free.
5. **Color conventions**: general calendars color by source calendar; family
   organizers (Skylight, Cozi) color by family member so kids self-locate;
   homeschool planners color by subject when viewing one child. No successful
   calendar flips its color dimension on filter.
6. **Recurring commitments, printable checklists, digest emails, and magic
   import** (Skylight Sidekick: forward a flyer, get events) are the adoption
   levers in the family market. Printable daily and weekly checklists remain a
   first-class output; many families run the day off paper.

Delta, stated plainly: our substrate (separated plan/schedule, real grid,
judgment-owning reshuffle skill, one check-off spine) is architecturally ahead
of the incumbents. Our surface layer (two rival boards, no month/day views, no
recurrence, half-blind tools, zero discovery loops) is behind all of them. The
consolidation is mostly deletion and wiring, not invention.

## 4. Proposal: one Planner (as adjudicated by the council)

### 4.1 The surface

- **/app/planner becomes the unified surface, named Planner.** One
  resolve-and-verify core feeds several thin registers (see §4.2): a
  **Today / This-week checklist register** (per-kid rail items, anything
  dated, and timed life events interleaved, check-off as the primary tap
  target) and the **week grid** (the shipped calendar), one toggle apart on
  every width. The council recommends the checklist register as the default
  landing, near-unanimously; because that reinterprets the co-founders'
  Skylight grid reference, the default goes to the founder (§5 Q-A), and both
  registers ship either way with rail vs grid check-offs instrumented
  separately.
- **The rail (undated work) is a first-class register, not a sidebar.**
  Computed by plan coordinates (each plan's current week minus its scheduled
  rows, per child and subject, never derived from the date-window fetch, unit
  test for the scheduled-outside-window case). Grouped per kid, collapsible
  per plan at three or more kids, today-first ordering, 44-point check
  targets. With adoption at zero, day one shows most families rail-only
  content; the rail must carry the morning on its own.
- **Interaction spec.** Tap a rail card, pick a day from a one-week strip:
  that is the primary scheduling affordance and the keyboard and assistive
  path. Drag (rail to day, day to day, day back to rail to unschedule) is the
  desktop enhancement. On grid pills, tap opens the detail card with a
  full-size checkbox inside; inline checkboxes live only in the rail and
  agenda registers, never on a draggable timed block. Failed writes surface a
  visible toast (§1.5.2).
- **/app/calendar redirects to /app/planner permanently.** Rendering code
  lives at /app/planner from day one. The redirect PR grep-sweeps hardwired
  /app/calendar references (revalidatePath in calendar/actions.ts lines 76,
  117, 139, prefill links, emails, skills), revalidates both paths during the
  flag window, and tests the signed-out deep-link path (old email link, auth
  wall, then planner, never a 404). Nav drops to one entry, matching the
  nav-labels ruling as amended (Chat, Progress, Planner, ...).
- **Views**: week (shipped grid) and day (an agenda/checklist projection of
  the same core, not the grid narrowed to one column). Month view is
  preconditioned on the fleet-wide plan-vocabulary sweep and is a founder
  trade against magic import (§5 Q-D).
- **Color law (council-settled)**: kid tone everywhere, one law, no mode
  switch; whole-family items wear the woven stripe; subject is always a text
  chip. The one shared canonical subject-to-tone module is still built (it
  deletes the four divergent arrays) but does not drive card color. Subject
  color may return only via a ratified, genuinely distinguishable palette in
  docs/homa-design/ as its own proposal, delivered as server-resolved semantic
  tone tokens in the board payload.
- **Vocabulary**: Homa never corrects a parent who says "calendar." Onboarding
  introduces the surface once as "your planner, the family calendar." The
  skill routes both words. The onboarding skill's "complain at the calendar"
  moment gets renamed to match.

### 4.2 The data model (additive, expand-contract)

- **One resolve-and-verify core, many thin projections.** The core owns the
  merge rules once: schedule rows joined to live plan text with the
  out-of-bounds drop, recurrence expansion (one shared module, also consumed
  by list_family_events and the voice digest), event day-spanning, hours
  attribution, rail computation. Day, week, month, rail, Today, the canvas,
  and the mobile JSON route are pure projections over its output, each
  independently unit-tested. (This amends the earlier one-view-model claim:
  merge rules have exactly one home; cell layouts do not.)
- `plan_activity_schedule`: add nullable `scheduled_time`; unschedule is a row
  delete exposed to both surfaces; plan rebuilds clear that plan's schedule
  rows **in the same transaction** as the child_plans upsert, surfaced with
  reassure-before-inform receipt copy ("the new month starts fresh, last
  month's placed days were taken off the calendar"), because those rows are
  work the parent did with her hands.
- **Positional-reference guards (new).** Every schedule write path (drag
  server action, schedule_plan_activity, the per-toggle check op) carries
  `expectedText` that code verifies against the live plan, plus a plan
  revision precondition; conflicts return honest parent copy, never a clobber.
  No stable-ID migration in this arc (check-off keys, PLAN_CHECK_KEY_RE, and
  tokenized report pages make it a packages/core migration). Recorded forcing
  triggers for that migration: external calendar sync, offline mobile writes,
  a second concurrency incident; the trigger review is owned before PR G
  ships second-client writes; the board route carries an opaque per-card ref
  from birth so the eventual migration is a server-side re-derivation.
- `family_events`: add `updated_at`; add weekly recurrence as `weekdays[]` +
  optional `until` + `exdates date[]` (default empty), materialized at read
  time by the shared expansion module, never into rows. V1 semantics, stated
  in the tool description and the skill: edits apply to the series,
  single-instance removal goes through exdates ("skip this Friday"), dragging
  a materialized instance is refused with plain copy offering to skip that
  week. DST-boundary tests in the family timeZone.
- The edit_plan schedule cascade (store.ts:886-923) is wrapped in one
  transaction with the child_plans UPDATE (PR A), after verifying transaction
  behavior through the pooler.

### 4.3 The chat ecosystem (models judge, code verifies, fat skills)

1. **open_planner returns model grounding, not the whole board**
   (council-settled over the single-payload alternative, dissent preserved in
   §7): all four plan weeks with per-activity `scheduledDate` and
   `scheduledTime`, bounded (full weeks for plans the turn addresses, current
   week plus summaries otherwise, expected token size stated in the PR).
   Family events stay with list_family_events, which gains a from/to window
   with look-back; the skill mandates list_family_events before any reshuffle
   or placement, with an adversarial eval asserting it. This makes the
   reshuffle procedure executable and closes the write-only-schedule gap.
2. **The canvas and page fetch the unified board** via the extended
   /api/map/plan/board route (caller JWT, RLS) and refresh on ANY
   plan-writing tool part, not just edit_plan. The canvas defaults to the
   checklist register in its narrow panel.
3. **New narrow tools**: `update_family_event` (one-call retitle/retime/move,
   defineBoundedTool with a deadline tier); unschedule via
   schedule_plan_activity accepting `scheduledDate: null`.
4. **Receipt chips and busy labels for every planner-family tool**, delivered
   as a renderable-kind descriptor on the tool result (rides the #196 D1
   contract), not per-toolName client dispatch; web renders it now, mobile
   renders one generic kind-dispatched receipt card.
5. **Channel honesty (capability signal)**: default-closed allowlist. The
   client declares panel and receipt capability via a connect-time transport
   fact the channel adapter validates and stamps into auth attributes, never
   model-supplied; unknown callers get the honest branch; the same signal
   governs whether the model may reference visible chips. This fixes §1.5.4
   for mobile and every future client at once.
6. **Per-toggle check-off write op (PR C, hard precondition for any second
   client writing checks)**: (childId, subjectId, checkKey, value,
   expectedText, revision precondition), implemented as an atomic server-side
   single UPDATE on the progress JSON (jsonb_set style or row lock), never
   read-modify-write in app code, reconciled server-wins; localStorage
   demotes to an optimistic echo; the whole-map POST survives only for the
   legacy tokenized share page; check state stops being keyed by reportToken.
   Until this lands, "check off anywhere" is scoped to web.
7. **Reshuffle definition of done (PR C)**: reads real dates from
   open_planner and real events from list_family_events; produces a receipt
   listing every move (activity, from-day, to-day) in one chip with a single
   put-it-back action restoring the prior schedule rows; never silently
   unschedules; gated on the family's school-day pattern (the skill asks
   once, remembers via existing memory tools, treats non-school days and
   all-day events as ineligible).
8. **Governed offers, not ambient links** (council-settled Q3: offer by
   default, never auto-place). Three venues, each deterministic in origin:
   the empty-grid offer card (shown until acted on, never re-shown after
   decline), once immediately after the first plan is built, and the morning
   brief capped at one scheduling offer per family per week, suppressed after
   decline. Every offer records acceptance as a durable row the
   offer-recovery detector watches (the #126-#128 scar), instrumented shown
   vs accepted. Both empty states are designed in B1: plans-but-nothing-dated
   (the offer card) and no-plans-yet (route to building the first plan).
9. **Curriculum lands on the planner, by reference** (council-settled): the
   model proposes a schema-validated mapping object (target plan weeks,
   condensed activity texts, provenance links to the stage activities each
   condenses); code fetches the real stage payload by jobId + stageNumber,
   verifies week bounds, counts, and provenance, then applies through the
   existing plan-edits path. The model never re-transcribes stage content
   (the #239 pageIndex scar). The completion offer is emitted
   deterministically by the job runner's completion surface with durable
   acceptance. Same skill procedure covers "schedule this subject lesson for
   Thursday." planner.curriculum_offer events ship with the bridge.
10. **Check-off-to-hours bridge** (council-settled Q5 addition): after
    check-offs, a deterministic companion note on the tool result offers to
    log hours (the PR #169 pattern), chat text only so every client renders
    it, capped, using the existing log_hours tool. At check-off time the
    product already knows child, subject, and date; double entry is what
    kills homeschool tracking habits.
11. **Discovery**: the morning brief and follow-up emails may link
    /app/planner, gated on the opening channel actually rendering the
    surface; the stale prompt-suggestions planner rules are deleted;
    instructions.md's surface map names the planner as the one week surface.

### 4.4 The planner copy law (new; gated through homa-copy-reviewer before B1)

- No overdue or deficit states anywhere. Unfinished rail work simply remains:
  never dated means never late. No overdue badges, no missed counts.
- Past-dated unchecked work gets a guilt-free one-gesture "bring these into
  this week."
- Repair copy anchors on the life event, never the deficit ("moved around the
  dentist," never "you fell behind").
- Empty days are visually neutral, never framed as gaps.
- Lanes stay; per-child completion counts are never juxtaposed; the per-kid
  filter is sticky. The sibling law is recorded in the surface component
  header.
- The fleet-wide plan-object naming sweep (the plan, never "month plan," in
  SKILL.md, plan pages, and report copy) is a hard precondition for any Month
  view: the collision lives mostly in chat, where a parent who taps Month and
  asks about "next month" would get an answer about a four-week plan object.

### 4.5 What retires (deletion is a feature)

- spread-week.ts, day-grid's guess spread, planner-view's board rendering and
  BLOCK_TONES (the focus strip's content moves into the register headers).
- The /app/calendar nav entry and route (redirect stays; flag-off keeps
  /app/calendar fully functional as a reader of drag-created schedule rows
  for the flag's lifetime).
- The two-surface disclaimers in the planner skill (SKILL.md:31-36, the
  stale-date apology at 130-134): deleted in the same deploy as the fleet
  flip, never later.
- The ?draft=schedule-week prefill, retired in PR C once drag parity lands.
- The duplicate subjectLabel/subjectDisplayName helpers and the four
  divergent tone arrays (one shared module).
- prompt-suggestions.md's pre-write-era planner rules; the superseded
  "calendar writes are not available" build-log law (retired loudly with a
  pointer, per context-file rules, and re-ruled for voice: what the phone
  line now says about the planner is part of PR B0's scope); the stale page
  comments; the `--ink` cleanup.
- NOT retired: child_plans, the check-off spine, the report's one-tap month,
  hours, tasks, binder. Recurring agent reminders stay off the grid
  (council-settled Q4; if ever revisited, they normalize through the shared
  recurrence-expansion module).

### 4.6 Phasing, guards, and the cut line

Each PR is shippable and carries the house guards in its definition of done:
`pnpm check:isolation` before every schema or query change (A, B, C, E),
`pnpm check:events` with typed EVENT_SCHEMAS registry entries for every new
planner.* event (staged via STAGED_EVENTS if registry precedes emitters),
`pnpm check:continuity` for the channel-adapter capability signal,
`pnpm check:tool-deadlines` for update_family_event, `pnpm check:fleet-skills`
for the SKILL.md rewrite, and the deploy law (watch READY, probe live, and
for PR A verify the voice digest still reads correctly) for anything touching
prod paths.

- **PR A (defect repair, unflagged, full deploy treatment)**: transactional
  cascade + rebuild-clears-rows with receipt copy; drag error toast; timed
  multi-day display (verify first); comment/cosmetic drift; the mobile
  honesty note interim fix (conservative wording until the capability signal
  lands). Regression test for the voice digest.
- **PR B0 (tool truth, unflagged, channel-neutral)**: open_planner four-week
  reads with scheduledDate/scheduledTime; receipt descriptors and busy
  labels; update_family_event; list_family_events window; planner.* events
  instrumenting BOTH old and new surfaces; payload-shape evals; eval fixture
  seeds gain plan_activity_schedule and family_events rows (Walker family and
  eval:sandbox seed both).
- **PR B1 (the unified surface)**: registers + rail + redirect + nav + color
  law + canvas swap + empty states + capability signal, behind per-family
  HOMA_UNIFIED_PLANNER_ENABLED (verify per-family targeting exists or add
  it), canaried on sandbox plus co-founder families; the minimum skill edits
  ride the same deploy as the fleet flip. Paywall/lock interaction is
  specified here: what a locked family sees, and that check-offs keep working.
- **PR C (write parity)**: tap-to-schedule and drag (schedule, reschedule,
  unschedule) through server actions sharing the tool validation path +
  expectedText guards; per-toggle check-off op; reshuffle DoD with undo and
  the school-day gate; skill rewrite finalized; write-parity and
  adversarial-negative eval fixtures (unschedule vs edit_plan remove vs
  remove_family_event; update vs remove-plus-add); suite green or explicitly
  re-ruled before the fleet flip.
- **PR D (views)**: day view (agenda projection). Month view only after the
  vocabulary sweep, per the founder's month-vs-magic-import trade.
- **PR E (time and recurrence)**: scheduled_time; weekly events with exdates;
  shared expansion module wired into board, list_family_events, and the voice
  digest.
- **PR F (ecosystem)**: curriculum bridge + subject-lesson scheduling +
  check-off-to-hours bridge + printable week (one page per child via
  create_printable, filed in the Binder: the artifact a co-founder shows
  another mom at co-op) + email/brief links (gated on channel rendering) +
  responsive mobile-web Today/day view before any links ship.
- **PR G (mobile native)**: versioned board JSON route (unknown kinds degrade
  to a generic card), native Today/board screen, check-off write via the PR C
  op; stable-ID trigger review beforehand; /app/planner excluded from
  associated-domains until the native screen routes it; stated refresh
  contract.
- **Later, named**: magic import (photo or forwarded flyer, model proposes
  events, code verifies dates, parent approves); attendance-day math (the
  compliance force that eventually pulls the day log toward the planner);
  family subjects (§5).

**The cut line** (council scope-inflation warning): the funded core of this
arc is A + B0 + B1 + C. D through G are demand bets gated on the adoption
read. If the arc slips, riders drop in this order: printable week, hours
bridge, month view, mobile-web pull-forward; the guards, the copy law, the
check-off op, and the honesty fixes never drop.

**Named tests that launch pressure cannot skip**: cascade under transaction;
rail scheduled-outside-window; recurrence expansion with exdates across DST
boundaries; check-off parity of the new surface against the existing spine;
per-toggle op race tests; redirect signed-out deep link; month date math when
Month ships.

**Success metric** (council-adopted, numbers to the founder): count of real
non-sandbox families who check off at least one DATED activity in a week,
sustained two consecutive weeks, read two weeks post-flip; rail-only
check-offs tracked as the paired diagnostic that would honestly say families
want the checklist, not the calendar.

## 5. Founder questions (adjudicated list; Q1 to Q5 as originally posed are settled, see §7)

- **Q-A, default landing register.** Council recommends the Today/This-week
  checklist register as the default landing with the week grid one toggle
  away (an empty time grid at first render is false and quietly shaming; most
  families never date most school work). This reinterprets the Skylight grid
  reference, so it is the founder's call, ideally after (a) pulling the
  actual reference images from #homa-inspo (verify ingestion; Cosmo's
  fabricated-ingest failure mode applies) and (b) showing Carolyng both
  registers.
- **Q-B, the gate on PRs D to G.** Name go and stop numbers for the adoption
  metric above, and rule whether the gate is hard or advisory. Council
  recommends hard, preserving growth's caution that two-week gates on a tiny
  fleet can consume the runway proving the obvious. Related: the July 13
  conference deadline in CLAUDE.md is in the past as of this doc's date; the
  runway this arc is priced against needs re-anchoring before deadline-based
  scope arguments are accepted.
- **Q-C, the Carolyng canary.** Is one real school week on her phone (watched
  via the founder console) a hard gate on the fleet-wide flip? Council
  recommends hard: it is the cheapest validation of her own CG-03 ask, and
  the flip swaps the only behavior with proven real usage (check-offs).
- **Q-D, the PR D trade.** Keep Month view (behind the vocabulary sweep) or
  trade its slot for magic import. Council recommends the trade: month view
  serves families who already use a surface; magic import creates them.
  Printable week ships in PR F either way.
- **Q-E, the #244 ruling (needed before the flip).** Is bare open_planner
  without the skill acceptable? Council recommends: yes for pure view intents
  (assert on outcome), skill load required and asserted for reshuffle,
  scheduling, and curriculum mapping. The fatter tool result makes
  skill-skipping more attractive, so rule this before the surface changes.
- **Q-F, the #196 D1 ruling and mobile capacity.** Rule the render-contract
  at PR B time so the receipt descriptor ships server-side once; decide how
  much mobile pulls forward (council recommends: descriptor in B1, generic
  receipt card with PR C, mobile-web Today view before PR F links, native
  screen in PR G).
- **Q-G, family subjects.** Carolyng's ask names family-level school
  activities the model cannot represent (per-child plans only). Rule whether
  a family-level checkable activity is a v-next data-model extension or
  out of scope; the council did not reach it (completeness finding), so it
  arrives unrecommended.

## 6. The delta table (world-class vs ours, post-arc)

| Capability | World-class | Today | After |
|---|---|---|---|
| One family surface | Skylight/Cozi one grid | two rival boards | one Planner, two registers |
| Plan vs schedule split | Homeschool Tracker | yes (buried) | yes (legible: rail vs grid) |
| Repair the week | Planet's bump, Motion reflow | skill exists, starved of reads | executable reshuffle + undo |
| Day/week/month | table stakes | week only, two boards | day + week; month a ruled trade |
| Color | by member (family view) | four systems | one law: kid tone + subject chip |
| Recurring commitments | standard | no home | weekly events + exdates |
| Time-of-day for school | optional everywhere | impossible | optional |
| Kid checklist register | Planet student view | none | Today register (parent-side) |
| Curriculum lands on the week | Planet auto-distribute | manual chat labor | by-reference bridge + offer |
| Printable week | Planet checklists | none | PR F, via create_printable |
| Discovery loops | digests drive usage | zero links anywhere | governed offers + gated links |
| Mobile | native parity | silence + false narration | honest signal now, cards next, native PR G |

## 7. Council record

Verdicts: six experts (product design, systems architecture, veteran
homeschool parent, agent architecture, growth, mobile platform), all
endorse-with-changes; no oppose. Two rounds (independent critique, then
cross-debate with concessions), then adjudication and a completeness critic.
Full transcripts in the session workflow record (wf_e0ed6eeb).

Adjudicated rulings folded into §4 and §5 above, most notably: the split of
PR B into B0/B1 with per-family canary; open_planner as bounded model
grounding rather than the whole board; kid-tone-everywhere color law;
checklist-forward default recommended but referred to the founder;
offer-by-default never-auto-place with three governed venues; recurrence with
exdates and one shared expansion module; the per-toggle check-off op as a
hard multi-client precondition; reshuffle undo and the copy law; the
by-reference curriculum bridge; the default-closed capability signal; month
view behind the vocabulary sweep; instrumentation before the flip with the
dated-check-off metric.

Dissents preserved for the founder:

- Subject color (homeschool parent): market demand is real (paper-planner
  culture, Homeschool Planet's configurable dimension); kid-tone-everywhere
  is a parking decision with a named path back (ratified distinguishable
  palette as its own design-system proposal), reconsidered if planner.*
  events show heavy single-child filtering.
- Single-payload open_planner (agent architecture): embedding the board in
  the tool result is the only design where model and parent are guaranteed
  the same bytes; the adopted split reintroduces a seam where transcript and
  panel can disagree. Mitigation: both consumers read one core; an
  adversarial eval asserts the read order. If drift recurs at this seam,
  revisit with a measured token budget.
- Runway (growth, against his own gating posture): with a tiny fleet,
  staircase gates can consume the runway proving the obvious; shipping the
  whole honest surface fast and measuring once is defensible.
- Scope discipline (systems architecture): the hours bridge belongs in its
  own issue if the arc slips.
- Concurrency ceiling (mobile platform): expectedText guards expire the
  moment a store-lagged client ships writes; the stable-ID trigger review
  must precede PR G, not follow an incident.
- Offer conservatism (homeschool parent): the adopted offer stack is three
  constraints deep; if offers do not convert, loosen the brief cadence first
  before concluding demand is absent.

Completeness critic additions folded above: the voice-digest consumer
(§1.3, §4.6 PR A and E), family subjects (§2, §5 Q-G), house guards in every
DoD (§4.6), the atomic per-toggle write design (§4.3.6), paywall/lock
interaction (§4.6 B1), eval fixture seeds (§4.6 B0), the Skylight
primary-source check (§5 Q-A), the signed-out redirect test (§4.1), corrected
claims (the `--ink` fallback works, §1.5.5; the ship date, §0; the amended
nav ruling, §1.1), and the deadline re-anchoring note (§5 Q-B).

## 8. Tracking

GitHub issues are the live tracker (founder directive 2026-07-25); this doc
is the spec they link. Filed from this session: gh#256 (PR A defect repair,
bug/P1/production; the mobile honesty gap is the live half, the rest latent
at zero adoption), gh#257 (B0 tool truth), gh#258 (B1 unified surface),
gh#259 (C write parity), gh#260 (D views), gh#261 (E time and recurrence),
gh#262 (F ecosystem bridges), gh#263 (G mobile native), gh#264 (calendar
ship doc debt, chore), and gh#265 (the founder ruling package for §5).
Cross-linked in the same session: #253 (metric and instrumentation), #244
(ruling needed before the flip), #196 (silence code-confirmed, D1 on the
critical path).
