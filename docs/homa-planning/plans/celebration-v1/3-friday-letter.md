# The Friday letter: the only proactive celebration beat

<!--
Status: BUILD PLAN, not yet implemented. Derived from the celebration-v1
design workflow (2026-07-22): one design pass per tranche, then three
adversarial skeptics per tranche (correctness, harm, law), then a revise
pass that folded surviving objections back in. The objections that
survived are listed at the bottom; they are already reflected in the
file specs above them.

Every file:line citation was written by an agent that read the repo. Treat
them as strong leads, not gospel: re-verify each before you touch it, the
codebase moves. Builds on docs/homa-planning/plans/2026-07-22-celebration-system.md.
-->

## Summary

The Friday letter (spec R6) ships as `apps/web/lib/celebration/` on the existing hourly `/api/map/cron`, not the agent dispatcher (`apps/web/agent/schedules/dispatch.ts:34-60` wakes a whole family session; `agent_schedules` has no `child_id`, `supabase/migrations/20260711030000_homa_tasks_framework.sql:56-58`). Nine of the skeptics' findings were correctness-fatal and are folded in whole: the weekly cap is now an ISO-week-identity test rather than a rolling 168 hours (a weekly beat is always 7 days minus epsilon apart and would have sent exactly one letter per child, ever); every slot draws only from `mastered`/`emerging` ability states, never `not_yet`, because `deriveAbilityMap` stamps a real `observedAt` on a correction row (`apps/web/lib/child-progress/abilities.ts:163-179`, `stateForAnswer` :97-106) and the old depth-7 rule would have read a mother's "he cannot actually do that" back to her as a win; movement now derives through `resolveEffectiveProgressEvidence`'s conflict and supersession rules (`apps/web/lib/child-progress/effective-evidence.ts:284,296`) instead of a second looser truth path; the outbox unique index is partial on `('composing','sent')` so a Monday `too_new` row can no longer silence a Friday send; recency is a typed field (`withinLetterWeek`) so no string ever asserts "this week" over October content; the recipient is resolved once and persisted with a `family_members` composite FK so a departed co-parent structurally stops receiving; the pronoun flag derives from the child's full quote corpus, not the three-slot lottery; bookkeeping integers and item ids leave the model payload entirely so `allowedNumbersFrom` cannot admit "quiet for 3 weeks"; and the letter's offer binds its reply with `buildSignedReplyAddress` before the loop opens, or the decline ledger records nothing. Two things the copy promised are now built rather than cut: `families.celebration_letter_cadence` with one narrow preference tool, and `family_memories.worry_subject_id` without which the named-worry rail could never have fired at all. Five skeptic fixes are rejected with reasons in `risks`.

## Files

### `supabase/migrations/20260722120000_celebration_letters.sql` (create)

**Purpose.** Additive schema for the letter outbox/skip ledger, the persisted per-child recipient, the hard-day hold, the worry subject id, and the family's letter cadence. Additive only, may lead the deploy.

All statements `create table if not exists` / `create index if not exists` / `add column if not exists`, matching the lesson_listen posture (supabase/migrations/20260714033500_lesson_listen.sql:11-14).

1. `public.celebration_letter_recipients` (created FIRST, celebration_letters references it): id uuid pk default gen_random_uuid(); family_id uuid not null references public.families(id) on delete cascade; child_id uuid not null; member_user_id uuid (NULLABLE); email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'); origin text not null check (origin in ('default','opted_in')); state text not null default 'opted_in' check (state in ('opted_in','muted')); opted_in_at timestamptz not null default now(); muted_at timestamptz; created_at timestamptz not null default now().
  `constraint celebration_letter_recipients_child_fkey foreign key (child_id, family_id) references public.children (id, family_id) on update cascade on delete cascade` (identity index at supabase/migrations/20260711213330_agent_led_live_progress.sql:18-19).
  `constraint celebration_letter_recipients_member_fkey foreign key (member_user_id, family_id) references public.family_members (user_id, family_id) on delete cascade`. This is the objection's fix and it is the whole point of the table: `family_members` PK is (family_id, user_id) (supabase/migrations/20260704033742_tenancy_v0.sql:15-21), so the composite FK was available and not using it meant a co-parent removed from a family kept receiving weekly letters naming the child and quoting the mother, forever, because `family_members` cascades only from `families` and `auth.users` and his `auth.users` row survives. Under MATCH SIMPLE a NULL `member_user_id` skips the check, which is exactly right for the fallback recipient (families.email, no member row).
  Indexes: `create unique index celebration_letter_recipients_child_email_idx on public.celebration_letter_recipients (child_id, email_hash)` (two adults sharing one sign-in address collapse to one recipient, never two identical letters); `create unique index celebration_letter_recipients_child_default_idx on public.celebration_letter_recipients (child_id) where origin = 'default'` (the default is resolved once, ever).

2. `public.celebration_letters`: id uuid pk default gen_random_uuid(); family_id uuid not null references public.families(id) on delete cascade; child_id uuid not null; recipient_id uuid not null references public.celebration_letter_recipients(id) on delete cascade; recipient_email_hash text not null check (char_length(recipient_email_hash) = 64) (a snapshot for the console, deliberately NOT in any unique key); iso_year smallint not null check (between 2026 and 2100); iso_week smallint not null check (between 1 and 53); status text not null default 'composing' check (in ('composing','sent','skipped','failed')); skip_reason text check (null or in ('hard_day_hold','closed_window','stale_window','burst_deferred','weekly_cap','too_new','too_few_dated_abilities','suppressed','opted_out','gate_failed','compose_timeout','send_failed','no_email','no_recipient')); slot_item_ids text[] not null default '{}'; slot_depths smallint[] not null default '{}'; fallback_depth smallint check (null or between 1 and 7); peak_slot smallint check (null or between 1 and 3); worry_rail boolean not null default false; worry_subject_id text; quiet_week boolean not null default false; offer_kind text check (null or in ('ritual','dinner_question','cadence')); offer_delivery_id uuid; offer_stop_announced boolean not null default false; delivered_at timestamptz; created_at timestamptz not null default now(). Composite children FK as above. Check `array_length(slot_item_ids,1) is not distinct from array_length(slot_depths,1)`.
  THE OUTBOX, now partial: `create unique index celebration_letters_week_idx on public.celebration_letters (child_id, recipient_id, iso_year, iso_week) where status in ('composing','sent')`. The skeptics were right twice over: with the old unqualified index, `recordLetterSkipped` and `claimLetterWeek` inserted through the same key, so a `too_new` row written at Monday 09:00 for ISO week W made Friday's `claimLetterWeek` return null and the family's FIRST letter, the one whose copy says "This is the first of these", silently never arrived. The partial predicate lets skipped and failed rows accumulate as an append-only ledger while still guaranteeing one live claim and one send per child per recipient per week.
  I keep `recipient_id` in the key and reject the skeptic's `(child_id, iso_year, iso_week)`: that key would silently drop the second adult's letter, which is the exact thing D5's opt-in exists to permit. The churn the objection is really about is fixed by persisting the recipient (item 1) and never re-deriving, not by narrowing the key.
  Other indexes: `celebration_letters_family_idx (family_id, created_at desc)`; `celebration_letters_child_recent_idx (child_id, created_at desc)`; `celebration_letters_skip_idx (child_id, iso_year, iso_week, created_at desc) where status in ('skipped','failed')`; partial `celebration_letters_composing_idx (created_at) where status = 'composing'` for the reaper; `celebration_letters_sent_idx (family_id, delivered_at desc) where status = 'sent'` for the longest-wait queue ordering.

3. `public.family_proactive_holds`: family_id uuid primary key references public.families(id) on delete cascade; tier text not null check (in ('distress_about_child','distress_at_homa','grief_or_crisis')); started_at timestamptz not null default now(); expires_at timestamptz not null; updated_at timestamptz not null default now(). NO message column and no quote column: apps/web/agent/instructions.md:289-291 forbids storing anything shared in acute distress and this ticket does not relax it.

4. `alter table public.families add column if not exists celebration_letter_weekday smallint check (celebration_letter_weekday is null or celebration_letter_weekday between 1 and 5), add column if not exists celebration_letter_hour smallint check (celebration_letter_hour is null or celebration_letter_hour between 7 and 16), add column if not exists celebration_letter_weekday_source text check (celebration_letter_weekday_source is null or celebration_letter_weekday_source in ('derived','parent')), add column if not exists celebration_letter_weekday_told_at timestamptz, add column if not exists celebration_letter_cadence text not null default 'weekly' check (celebration_letter_cadence in ('weekly','monthly'));`
  `celebration_letter_cadence` is new in this revision and is not optional: `CADENCE_OFFER` says "If you would rather these came monthly for a while, say the word", and the only cadence control that existed was the binary `journal_opt_out_at` (supabase/migrations/20260709230000_gateway_groundwork.sql:19). Offering a depleted mother the one control the letter promises, at the exact moment the letter admits it is thin, and then not honoring it, is worse than not offering. The hour ceiling drops from 17 to 16 so the widened 4-hour window still closes by 20:00 local.

5. `alter table public.family_memories add column if not exists worry_subject_id text;` plus `create index if not exists family_memories_worry_idx on public.family_memories (child_id, created_at desc) where worry_subject_id is not null;`. Also required, not optional: `grep -rn worry` over apps/web/lib, apps/web/agent, packages and supabase/migrations returns one unrelated prose hit in a materials-studio recipe, and `family_memories` has exactly id, family_id, child_id, kind, content, source, created_at, updated_at (supabase/migrations/20260706061222_family_memory.sql:57-69) plus superseded_at, embedding, session_id from later alters. Without this column `readNamedWorry` returns null on every call and the named-worry rail, its cadence constant, its columns and its tests are dead code against spec 5A's only mitigation for the failure the spec calls the worst one.

RLS, copied in posture from supabase/migrations/20260714033500_lesson_listen.sql:106-141: `enable row level security` on all three new tables; one `for select to authenticated using (public.is_family_member(family_id))` policy each; NO insert/update/delete policies; `revoke all on table ... from public, anon, authenticated; grant select on table ... to authenticated;`. Every write goes through mapDb.

Table comments: celebration_letters is 'One live claim and one send per child per recipient per ISO week, enforced by the partial unique index. Skipped and failed rows are an append-only ledger and deliberately do not block a later claim.'; celebration_letter_recipients is 'Resolved once per child and never re-derived. The family_members composite FK is the revocation path: losing membership stops the letters structurally.'; family_proactive_holds is 'A tier and two timestamps. The words are never stored (agent/instructions.md).'

### `apps/web/lib/celebration/flag.ts` (create)

**Purpose.** The founder kill switch. Dark until copy clears review.

`export function celebrationLettersEnabled(): boolean { return process.env.HOMA_CELEBRATION_LETTERS_ENABLED === "true"; }`. Exact-value comparison and the same header comment shape as apps/web/lib/drip/flag.ts: anything else, including unset, keeps it off, so a missing env var can never start emailing real families.

### `apps/web/lib/celebration/week.ts` (create)

**Purpose.** ISO week identity in the family's own zone, the week's start instant, the monthly-cadence test, and the send-order rotation.

Imports at top: `zonedDateParts` from '../time-zone' (it lives at apps/web/lib/time-zone.ts:16, NOT in tasks/time.ts; the earlier draft cited the wrong module) and `localDateKey` from '../tasks/time'.
`export interface IsoWeek { isoYear: number; isoWeek: number }`
`export function isoWeekOf(zone: string, instant: Date): IsoWeek` - derives the family-local Y-M-D via `localDateKey(zone, instant)` (apps/web/lib/tasks/time.ts:93-102) then runs ISO 8601 on that date, never on the UTC date, so two siblings in one house never land in different weeks across a midnight boundary.
`export function localIsoWeekStart(zone: string, instant: Date): Date` - the UTC instant of Monday 00:00 family-local in the ISO week containing `instant`. NEW and load-bearing: it is what the weekly cap compares against instead of `now - 7 days`. Built by walking `zonedDateParts(candidate, zone).weekday` back to 1 from the local date key, then resolving midnight with the same two-pass DST offset correction `nextLocalHourInstant` uses (apps/web/lib/tasks/time.ts:12-70).
`export function isFirstIsoWeekOfLocalMonth(zone: string, instant: Date): boolean` - true when the ISO week containing `instant` also contains the family-local 1st of a month. The monthly cadence's whole rule, deterministic, no elapsed-day arithmetic.
`export function rotateBySeed<T>(items: readonly T[], seed: number): T[]` - returns `items` when length < 2, else `[...items.slice(k), ...items.slice(0, k)]` with `k = ((seed % items.length) + items.length) % items.length`.
`export function weekdayNameFor(weekday: number): string` - 'Sunday'..'Saturday' indexed 0..6, for the one-time 'these come on Thursday' line.

### `apps/web/lib/celebration/window.ts` (create)

**Purpose.** The closed window and the delivery window as one shared pure guard, ahead of everything else.

Split out of eligibility.ts because the skeptics were right that a branch buried at step 12 of the letter's own chooser is not a fence. Imports `zonedDateParts` from '../time-zone' and `localHourOf` from '../tasks/time'.
`export const LETTER_DEFAULT_WEEKDAY = 5; export const LETTER_DEFAULT_HOUR = 9; export const LETTER_DELIVERY_WINDOW_HOURS = 4;`
`export function withinProactiveWindow(zone: string, now: Date): boolean` - false when family-local weekday is 0 (Sunday), or 6 (Saturday) with hour >= 18, or 1 (Monday) with hour < 7. Spec line 126's hard closed window, as a reusable predicate rather than a letter-private branch.
`export type LetterWindowState = "not_due" | "due" | "closed_window" | "stale_window";`
`export function letterWindowState(input: { zone: string; letterWeekday: number; letterLocalHour: number }, now: Date): LetterWindowState` - in this order, first match wins:
  1. `!withinProactiveWindow(zone, now)` -> "closed_window". FIRST, not twelfth. In the old ordering `weekday !== letterWeekday` returned not_due before the closed-window branch could ever run, and because `families.celebration_letter_weekday` is constrained 1..5 the branch was unreachable in production and three of the plan's own tests could not have passed as written. Putting it first makes it a real floor that survives a parent-chosen weekday, a DST shift, and any future widening of the column's check.
  2. `zonedDateParts(now, zone).weekday !== letterWeekday` -> "not_due".
  3. `localHourOf(zone, now) < letterLocalHour` -> "not_due".
  4. `localHourOf(zone, now) >= letterLocalHour + LETTER_DELIVERY_WINDOW_HOURS` -> "stale_window". The kinds.ts:56-59 lesson applied: after downtime a stale claim records skipped, never arrives as a late-night email.
  5. "due".
The window widens from 3 hours to 4 (09:00 to 13:00 local by default) as part of the burst-ceiling arithmetic in sweep.ts. Still full daylight, still four hours short of the 18:00 Saturday edge and nowhere near the 11pm incident.

### `apps/web/lib/celebration/school-week.ts` (create)

**Purpose.** Her school week, derived from her own signals, defaulting to Friday.

`const MIN_TOTAL_SIGNALS = 8; const CLEAR_MARGIN = 1.5;`
`export interface SchoolWeekSignals { parentEventWeekdayCounts: readonly number[]; inboundMessageWeekdayCounts: readonly number[] }` (both length 7, index 0 = Sunday, computed in the family's zone over the last six weeks).
`export function deriveLetterWeekday(signals: SchoolWeekSignals): { weekday: number; source: "derived" | "default" }`:
  counts[d] = parentEventWeekdayCounts[d] + inboundMessageWeekdayCounts[d]; total = sum.
  total < MIN_TOTAL_SIGNALS -> { weekday: LETTER_DEFAULT_WEEKDAY, source: "default" } (a thin distribution is noise, not a rhythm).
  Scanning [1,2,3,4,5] in order, candidate = the LAST weekday whose `counts[day] * 5 >= total`. Saturday and Sunday are never candidates: the closed window forbids them and a derived Sunday letter is the exact thing the spec bans.
  candidate === 5 -> default. `counts[candidate] < counts[5] * CLEAR_MARGIN` -> default ('does not beat Friday by a clear margin'). else { weekday: candidate, source: "derived" }.
The SQL filling the counts lives in store.ts and counts `public.events` rows whose `name = any(PARENT_INITIATED_EVENTS)` (apps/web/lib/activation/signals.ts:34-39) plus `conversation_messages` rows with `role = 'user'`, bucketed by `extract(dow from (created_at at time zone $zone))`. Counting weekdays is arithmetic, not interpretation, so it stays deterministic.
SCOPE CALL in the header comment: the spec also names rhythm memories ('school four mornings a week, Fridays are co-op') as an input. Reading a weekday out of that sentence is a judgment call and pattern-matching it is what the models-judge-code-verifies law forbids; doing it right needs a model call with its own measured fixtures. v1 derives from the distribution and from her explicit setting (`set_celebration_letter_preference`) only, and the memory path is a named follow-on.

### `apps/web/lib/celebration/hold.ts` (create)

**Purpose.** The 72-hour hard-day hold: read side for the sweep, write side for the inbound classifier.

`export const PROACTIVE_HOLD_MS = 72 * 60 * 60 * 1000;`
`export type DistressTier = "distress_about_child" | "distress_at_homa" | "grief_or_crisis";`
`export async function recordProactiveHold(input: { familyId: string; tier: DistressTier; now?: Date }): Promise<void>` - upsert on family_id with **`expires_at = greatest(coalesce(public.family_proactive_holds.expires_at, excluded.expires_at), excluded.expires_at)` where `excluded.expires_at = $now + interval '72 hours'`**, and `started_at` preserved from the existing row. The earlier draft wrote `greatest(coalesce(existing, now), now) + interval '72 hours'`, which applies the interval AFTER the greatest and therefore COMPOUNDS: an existing expiry at now+71h became now+143h, and five messages across one bad week silenced a struggling mother for roughly fifteen days instead of three. The old test ("extends and never shortens") passed on the buggy formula, so the replacement test asserts an exact instant. It also broke `heldWithinLastWeek`, whose 'the week a hold ran' semantics assume a bounded 72 hours.
`export async function activeProactiveHolds(familyIds: readonly string[]): Promise<Map<string, Date>>` - one batched `where family_id = any($1) and expires_at > now()`, the batch shape of suppressedHashesForDrip (apps/web/lib/email/suppression.ts:79-94). Fails open to an empty map ONLY on a missing-table error (the migration may lead the code); any other error rethrows, because failing open on a hold means emailing a mother who just told Homa something painful.
`export async function heldWithinLastWeek(familyId: string, now: Date): Promise<boolean>` - `expires_at > $now - interval '7 days'`, used to suppress share and ritual offers in a week where a hold ran (spec R3 Never).
Stores no text and adds NO outbound message on any path: the whole point is that the hold is invisible.
Header comment records the seam: the enum classifier that calls recordProactiveHold runs on inbound turns, is one generateObject returning `z.object({ tier: z.enum(["none","frustration_logistics","distress_about_child","distress_at_homa","grief_or_crisis"]) })`, and code applies the fence for the last three. That wiring is a separate small ticket; this file is its only write API. See risks: shipping the letter before the classifier means the hold table is empty and the fence inert.

### `apps/web/lib/celebration/eligibility.ts` (create)

**Purpose.** Every named fence, as one pure function, evaluated ONLY inside the family's own send window.

Imports `letterWindowState` from './window' and `localIsoWeekStart`, `isFirstIsoWeekOfLocalMonth` from './week'.
`export type LetterSkipReason = "hard_day_hold" | "closed_window" | "stale_window" | "weekly_cap" | "too_new" | "too_few_dated_abilities" | "suppressed" | "opted_out" | "no_email" | "no_recipient";`
`export interface LetterCandidateSignals { familyId: string; childId: string; childName: string; recipientId: string; childCreatedAt: Date; familyCreatedAt: Date; timeZone: string; sandbox: boolean; recipientEmail: string | null; recipientMemberUserId: string | null; cadence: "weekly" | "monthly"; familyOptedOut: boolean; suppressed: boolean; muted: boolean; holdExpiresAt: Date | null; lastOtherProactiveAt: Date | null; lastLetterDeliveredAt: Date | null; letterWeekday: number; letterLocalHour: number; alreadyClaimedThisWeek: boolean; datedConfirmedAbilityCount: number | null }`
`export type LetterDecision = { send: true } | { send: false; reason: LetterSkipReason | null };`
`export function chooseLetterSend(signals: LetterCandidateSignals, now: Date): LetterDecision`
TWO STAGES. Stage A is the window and writes nothing; Stage B holds the named reasons and only ever runs on a tick when the letter was genuinely due. This reordering is the fix for three separate findings at once: the hourly event flood (a permanently opted-out family emitted `celebration.letter_skipped` 168 times a week per child, roughly 6,700 rows a week fleet-wide into the shared `events` table the console and digest read), the Monday-skip-row-blocks-Friday failure, and the cost of `datedConfirmedAbilityCount`, which cannot be a flat SQL count and must run `deriveAbilityMap` per child.

Stage A, first match wins, all return `{ send: false, reason: null }` except where noted:
 1. sandbox.
 2. timeZone is empty or null (the task seeder's own rule: there is no correct local hour to send at).
 3. muted (a mute is a settled preference, not a weekly event).
 4. `letterWindowState({ zone, letterWeekday, letterLocalHour }, now)`: "closed_window" -> reason "closed_window"; "stale_window" -> reason "stale_window"; "not_due" -> reason null.
 5. alreadyClaimedThisWeek (a row with status in ('composing','sent') for this child/recipient/week) -> reason null.
 6. cadence === "monthly" && !isFirstIsoWeekOfLocalMonth(timeZone, now) -> reason null.

Stage B, only reached when Stage A says due:
 7. !recipientEmail -> "no_email".
 8. familyOptedOut (families.journal_opt_out_at is not null) -> "opted_out".
 9. suppressed -> "suppressed".
10. now - familyCreatedAt < 7 days -> "too_new".
11. `datedConfirmedAbilityCount === null` -> "no_recipient" is wrong here; instead the sweep never passes null into Stage B (it derives the count for exactly the children that reached Stage B). A null at this point is a programming error and throws.
12. `datedConfirmedAbilityCount < 3` -> "too_few_dated_abilities". The floor counts abilities whose derived state is `mastered` AND whose `observedAt` is non-null. The earlier wording counted 'abilities with a non-null observedAt', which `deriveAbilityMap` stamps on EVERY explicit answer including `not_yet` (apps/web/lib/child-progress/abilities.ts:163-179 with `stateForAnswer` at :97-106). A child with three `not_yet` rows passed that floor and then received three fabrications. It also cannot be a SQL count over `child_progress_evidence`: the derivation needs `resolveEffectiveProgressEvidence` plus `deriveAbilityMap`'s graph closure, so the sweep runs it per surviving child.
13. holdExpiresAt !== null && holdExpiresAt > now -> "hard_day_hold".
14. **`lastOtherProactiveAt !== null && lastOtherProactiveAt >= localIsoWeekStart(timeZone, now)` -> "weekly_cap".** This replaces the rolling `now - lastOtherProactiveAt < 7 days` and is the tranche's single most important correction. `email_sends.created_at` defaults to `now()` at insert (supabase/migrations/20260712210000_founder_console.sql:36-47), written by recordEmailSend AFTER compose and the Resend POST, so week N+1's tick at the same family-local hour always sees an elapsed time a few seconds SHORT of 168 hours. The drip's identical arithmetic (apps/web/lib/drip/sweep.ts:44, strict `<` at :110-115) is safe only because every drip kind is additionally once-ever (`sentKinds` :381-388, `dripAlreadySent` :437-448); a recurring beat has no such second guard, so the old rule sent exactly one letter per child, ever. `lastOtherProactiveAt` also now excludes ALL `friday_letter` rows, not just the current week's: the letter's own dedupe is the ISO-week outbox, and the cross-system fence is 'one OTHER proactive beat per family per ISO week'. A sibling's letter never caps this child; a drip nudge earlier in the same local ISO week does.
15. `{ send: true }`.

### `apps/web/lib/celebration/slots.ts` (create)

**Purpose.** The seven-rung fallback chain, the named-worry rail with a pinned position, and the state fence that keeps a correction out of a celebration.

`export type SlotDepth = 1|2|3|4|5|6|7;`
`export type SlotState = "mastered" | "emerging" | "implied" | "ready" | "remembered";`
`export interface SlotCandidate { depth: SlotDepth; state: SlotState; itemId: string | null; subjectId: string; subjectName: string; statement: string; observedAt: string | null; observedLocalDate: string | null; observedWeekday: string | null; withinLetterWeek: boolean; quote: string | null; quoteAdult: string | null; fromFrustratedSegment: boolean; transition: { from: "not_yet" | "emerging"; to: "emerging" | "mastered"; onLocalDate: string } | null; becauseOfStatements: string[]; rememberedFact: string | null; rememberedOn: string | null; isWorryRail: boolean; isSlowAnswer: boolean }`

THE STATE FENCE, the fix for the most damaging finding in the tranche: **no candidate at any depth may carry a `not_yet` answer.** `deriveAbilityMap` pushes a node for every explicit answer with a real `observedAt`, and the correction path writes exactly such a row (`source in ('correction','report_correction')`, supabase/migrations/20260711213330_agent_led_live_progress.sql:66-86). Under the old rule, a mother who said on 3 March "he can't borrow across a zero yet" got, in a quiet week, `Theo borrows across a zero in subtraction. You told me that on March 3, and it is still true.` It was not the peak, so the peak's `answer !== "not_yet"` guard never ran on it, and the narrative gate has no concept of answers. Depths 1, 4 and 7 draw only `mastered`; depth 1 may additionally draw `emerging` with its own template. `emerging` is never the peak. `not_yet` appears in this module in exactly one place: as the `from` side of a depth-2 transition, which is a sentence about something that CHANGED.

Depth meanings: 1 an ability reported this week (mastered or emerging, `withinLetterWeek` true); 2 a movement transition landing this week; 3 a newly implied ability from this week's confirmations (`observedAt` null, the date named is the confirming report's); 4 an already-lit mastered ability used again this week (lesson clause, worksheet row, planner check-off); 5 a ready-next with its receipts; 6 a durable remembered fact tied to a mastered ability in the same subject; 7 an earlier mastered ability with a non-null observedAt, restated with its date.

`export interface SlotSelectionInput { candidatesByDepth: Readonly<Record<SlotDepth, readonly SlotCandidate[]>>; previousItemIds: readonly string[]; previousQuietItemIds: readonly string[]; quietWeek: boolean; worrySubjectId: string | null; worryRailDue: boolean }`
`export interface SlotSelection { slots: [SlotCandidate, SlotCandidate, SlotCandidate]; fallbackDepth: SlotDepth; worryRailSlot: 1 | 2 | 3 | null; anyThisWeek: boolean }`
`export function selectLetterSlots(input: SlotSelectionInput): SlotSelection`
 a. Worry rail first, so it overrides the peak-picker's pull toward whatever is moving fastest. If worrySubjectId is set AND (worryRailDue OR any candidate in that subject exists), pick the shallowest candidate with `subjectId === worrySubjectId` in the depth order 2, 3, 4, 5, then 7. A depth-7 pick in the worry subject sets `isSlowAnswer: true`. If the subject has NO candidate at any depth the rail does not fire and the caller does NOT reset the cadence counter, so it fires the moment there is anything true; a manufactured worry sentence is never produced.
 b. **Rail position, pinned.** `worryRailSlot` is 2 when `isSlowAnswer`, otherwise 1 or 2, and NEVER 3. The old plan returned `1 | 2 | 3` with no rule fixing it, and render.ts emits non-peak slots in slot order, so the natural implementation put the honest slow answer on line one under the subject "Three things Sam did this week": a mother opens a celebration email and the first thing she reads is a deficit sentence about the subject keeping her awake. Spec 5A puts the rail in the letter to stop Homa changing the subject, not to lead with it. Never 3 so it is never adjacent to the closing.
 c. Fill remaining slots by walking depth 1 -> 7, each depth in its own order: 1-4 most recent observedAt first, 5 nearest the child's age first (already deriveAbilityMap's order, abilities.ts:232-238), 6 most recently learned first, 7 by distinct subject first then earliest observedAt (three restatements from one onboarding sitting become three subjects, not one).
 d. Exclusions: skip any candidate whose non-null itemId is in previousItemIds. When quietWeek, also skip previousQuietItemIds (the sameness fence).
 e. Cannot run dry: if fewer than 3 survive, relax in reverse order of application and ONLY at depth 7, quiet-week exclusion first, consecutive-letter exclusion second. Eligibility guarantees at least 3 dated MASTERED abilities and every one of those is a depth-7 candidate, so the relaxed pass always yields 3. The old proof was invalid because the floor counted a different population than depth 7 drew from.
 f. `assertThreeSlots` throws unless the result is length 3 AND no slot carries a `not_yet` answer AND `worryRailSlot !== 3` AND (`!isSlowAnswer` or `worryRailSlot === 2`). The sweep catches, records status 'failed', sends nothing. A two-item letter is a length change and the length never changes.
 g. `fallbackDepth` = max depth used. `anyThisWeek` = any slot with `withinLetterWeek`.

### `apps/web/lib/celebration/facts.ts` (create)

**Purpose.** The two payloads: what the model may see, and what only code may see. Exactly one child, verified quotes only.

THE SPLIT is the fix for the allow-list leak. `allowedNumbersFrom` derives the gate's whitelist from `JSON.stringify` of the facts payload (apps/web/lib/map/narrative-facts.ts:397-399), so putting `consecutiveDeepWeeks: 3` in the model's payload legalized the digit 3, and "These have been quiet for 3 weeks" then passed every check: no banned word, no em dash, no percentage, no denominator, and "weeks in a row" never appears so the streak rule missed it. Spec line 332 bans exactly that sentence. Item ids and raw ISO timestamps leak digits the same way and are equally not parent-facing.

`export interface LetterSlotFact` (MODEL-VISIBLE): { slot: 1|2|3; statement: string; subjectName: string; observedOn: string | null ('March 3'); observedWeekday: string | null ('Tuesday'); withinLetterWeek: boolean; quote: string | null; quoteAdult: string | null; transition: { from: string; to: string; onLocalDate: string } | null; becauseOfStatements: string[]; rememberedFact: string | null; rememberedOn: string | null; isWorryRail: boolean; isSlowAnswer: boolean }. No `depth`, no `itemId`, no `observedAt`, no `state`.
`export interface LetterFacts` (MODEL-VISIBLE): { childName: string; childPronouns: string; isFirstLetter: boolean; weekdayAnnouncement: string | null; quietWeek: boolean; anyThisWeek: boolean; slots: [LetterSlotFact, LetterSlotFact, LetterSlotFact]; worry: { subjectName: string; parentWords: string; namedOn: string } | null; offer: { kind: "ritual" | "dinner_question" | "cadence"; form: string; formLearnedOn: string | null } | null }
`export interface LetterControl` (CODE-ONLY, never serialized into a prompt): { slotItemIds: (string|null)[]; slotDepths: SlotDepth[]; slotStates: SlotState[]; slotFrustrated: boolean[]; fallbackDepth: SlotDepth; consecutiveDeepWeeks: number; isoYear: number; isoWeek: number; timeZone: string; worrySubjectId: string | null; offerKind: string | null; peakEligible: boolean[] }
`export function buildLetterFacts(input: { childName: string; selection: SlotSelection; grounding: PreviousLetterGrounding; pronounCorpus: readonly string[]; ... }): { facts: LetterFacts; control: LetterControl }`. `consecutiveDeepWeeks` stays in control only: the opening is selected in code, so the model never needs the number.
`export function letterGateContext(facts: LetterFacts, childName: string, siblingNames: readonly string[], pronounCorpus: readonly string[]): NarrativeGateContext`:
  allowedNumbers: `allowedNumbersFrom(facts)` on the MODEL payload only, so every digit the letter may print is a digit the letter needs.
  siblingNames: the family's OTHER children with any name case-insensitively equal to childName removed, or a family with two children sharing a name rejects every sentence (packages/core/src/map/narrative-gate.ts:83-90 is a word-boundary regex per sibling).
  **genderedPronounsAllowed: `GENDERED_PRONOUNS.test(pronounCorpus.join(" "))`** where the corpus is the child's FULL quote history (sources.ts `loadChildParentWords`) plus the stored worry words, NOT the three selected slot quotes. The old derivation made a girl's pronoun flip week to week with the slot lottery: a quiet week whose three depth-7 slots are map-walk rows with null quotes gendered her they/them, and the next week's one quoted slot said "she" again. Worse, when the single gendering quote was "she finally read it to Ben", hygiene nulled it for the sibling name, the model wrote "she" from the pronoun instruction, verify rule 3 failed the whole letter, and she got silence with no explanation. The report path never had this bug because it reads the whole parent-words block (apps/web/lib/map/narrative-facts.ts:408-414). Hygiene filters run only on quotes that reach the payload, never on the corpus that settles the pronoun.
  childName.
QUOTE HYGIENE, applied while building facts, before the model sees them. A slot's quote is nulled when: it is null on the evidence row (most walk rows carry none); it matches BANNED_WORDS or any DIAGNOSIS_SUBSTRINGS phrase; it contains a sibling name under the gate's own word-boundary test; it contains a second adult's display name; or it exceeds 240 chars. Never hand the model a quote it must not use.
Dates: every observedOn / observedWeekday / transition.onLocalDate is computed with `localDateKey(timeZone, new Date(observedAt))` (apps/web/lib/tasks/time.ts:93-102), never from the raw ISO string. Evidence stored Tuesday 23:30 local is Wednesday in UTC and the letter must say Tuesday.
Structural single-child guarantee: this module and its loader accept `childId: string`, never an array; there is no code path here that reads a second child's rows, and a test asserts the serialized model payload contains no sibling name and no sibling item id.

### `apps/web/lib/celebration/sources.ts` (create)

**Purpose.** The one-child loader: every candidate rung, family-scoped, drawn through the same resolved truth the Progress page shows.

Imports at top: `resolveEffectiveProgressEvidence` from '../child-progress/effective-evidence', `deriveAbilityMap` from '../child-progress/abilities', `localDateKey` from '../tasks/time', `mapDb`.
`export interface LetterSourcesInput { familyId: string; childId: string; timeZone: string; now: Date }`
`export async function loadLetterSources(input: LetterSourcesInput): Promise<LetterSources>` - every query carries `and family_id = $familyId and child_id = $childId`; familyId comes from the sweep's own server query, never from a model or client.
The spine: load `child_progress_evidence` + `child_progress_conflicts` for this child, run `resolveEffectiveProgressEvidence` (apps/web/lib/child-progress/effective-evidence.ts:249-345), then `deriveAbilityMap(effective, ageMonths)` (abilities.ts:114-250). ageMonths from `children.birth_month`, day always 01 by design (supabase/migrations/20260704033742_tenancy_v0.sql:27-29).
  Depth 1: nodes with state `mastered` or `emerging` whose observedAt falls inside the letter's local week.
  **Depth 2 (movement), now conflict-aware.** The old rule scanned raw rows including superseded ones and never looked at `child_progress_conflicts`, so a Monday `getting_there` plus a Tuesday `easily` plus a Wednesday correction that opened a conflict produced a letter saying "and by Tuesday it was working" while the abilities map went dark for that item and the Progress page showed nothing. `resolveEffectiveProgressEvidence` drops open-conflict items outright (`if (openConflictItems.has(itemId)) continue;`, effective-evidence.ts:296) and drops superseded rows (:284); every other rung inherits that and depth 2 must too. New derivation, per item:
    - Skip any item id in the returned `openConflicts`.
    - Let E be the item's EFFECTIVE row. Require `localDateKey(zone, E.observedAt)` inside the letter week and `E.answer` in ('easily','getting_there').
    - Build the item's history: all rows for the item ordered by (observed_at, created_at, ascii id), the same total order `isLaterEvidence` uses (effective-evidence.ts:175-198). Superseded rows STAY (supersession retains the earlier row, supabase/migrations/20260711213330_agent_led_live_progress.sql:108-109, which is why complete pairs exist in production today) but any row a RESOLVED conflict discarded is dropped, identified as whichever of `evidence_id_a`/`evidence_id_b` is not `resolved_evidence_id` (supabase/migrations/20260711213330_agent_led_live_progress.sql:461-478). Truncate the history at E.
    - Let P be the row immediately before E. Require P.answer strictly weaker than E.answer under not_yet < getting_there < easily. Emit `transition { from, to, onLocalDate }`.
  Depth 3: nodes with state `implied` whose confirming `easily` row landed this week. They carry `observedAt: null` by design (abilities.ts:52-53, :182-196), so the sentence names the confirming report's date and never an invented one.
  Depth 4: `mastered` item ids appearing this week in `lesson_reviews.insights` clause pairs, in `worksheets` rows (skill, created_at), or in planner check-offs.
  Depth 5: `subject.readyNext` with `becauseOfStatements` (abilities.ts:216-230).
  Depth 6: `family_memories` rows with `child_id = $childId`, `kind in ('fact','what_works')`, `superseded_at is null`, newest first, paired with a `mastered` node in the same subject. The row's `created_at` is the 'learned on' date the copy carries.
  Depth 7: `mastered` nodes with a non-null observedAt, distinct subjects first.
  Frustrated-segment flag: for a depth-1/2/4 candidate traceable to a lesson, join `lesson_segments.tone_notes` and set `fromFrustratedSegment` true only when a beat with `kind = 'frustrated'` is present. Tone is fail-soft and may be null (apps/web/lib/lessons/tone.ts:13-19); absent tone notes mean false, because treating unknown as frustrated silently starves the peak on every family whose tone lane failed.
  Worry: `readNamedWorry(familyId, childId)` (worry.ts).
`export async function loadChildParentWords(familyId: string, childId: string): Promise<string[]>` - every non-null `quote` on this child's EFFECTIVE evidence rows plus the stored worry memory's content. The pronoun corpus, and nothing else uses it.
`export async function datedConfirmedAbilityCount(familyId: string, childId: string): Promise<number>` - the derivation, not a SQL count: effective evidence -> deriveAbilityMap -> count nodes with state `mastered` and non-null observedAt.
`export async function loadLetterWindowSignals(now: Date): Promise<LetterCandidateSignals[]>` - the CHEAP pass: one query over non-sandbox, non-deleted families with an email, a time zone and at least one child, joined to `celebration_letter_recipients` (state 'opted_in'), returning per (child, recipient) rows with cadence, opt-out, mute, suppression hash, hold expiry, `alreadyClaimedThisWeek` (status in ('composing','sent') only), `lastOtherProactiveAt` (max `email_sends.created_at` where `kind like 'drip_%'`, deliberately excluding `friday_letter`), `lastLetterDeliveredAt` (max `celebration_letters.delivered_at` where status='sent', for the queue ordering), and the family's letter weekday/hour. `datedConfirmedAbilityCount` is left null here and filled per child only after Stage A passes, because the derivation is not expressible in this query and running it hourly for every child in the fleet is waste.

### `apps/web/lib/celebration/worry.ts` (create)

**Purpose.** The named-worry rail's memory: model proposes the subject, code verifies it against the catalog.

`export interface NamedWorry { subjectId: string; subjectName: string; parentWords: string; namedOn: string; memoryId: string }`
`export async function readNamedWorry(familyId: string, childId: string): Promise<NamedWorry | null>` - reads the newest `family_memories` row for this child with `superseded_at is null` and `worry_subject_id is not null` (the column added in this tranche's migration; it did not exist and the rail could not fire), then VERIFIES: the subject id resolves in `MAP_SUBJECTS` (packages/core/src/map/content.ts:188), the row belongs to this family and this child, and the returned `parentWords` is a verbatim substring of the stored `content`. Any failure returns null and the rail does not fire rather than firing on a guess. `namedOn` is `created_at` rendered in the family's zone.
`export const WORRY_RAIL_MIN_CADENCE = 4;`
`export function worryRailDue(sentLettersSinceWorryRail: number): boolean { return sentLettersSinceWorryRail >= WORRY_RAIL_MIN_CADENCE - 1; }` - counts SENT letters, never elapsed weeks, so a run of holds cannot silently burn the cadence. The constant is the single line a D6 ruling changes.

### `apps/web/agent/tools/remember.ts` (modify)

**Purpose.** Let Homa record which subject the mother named as her worry, as a verified catalog id beside her own words.

Add one optional field to `inputSchema` (currently content/kind/childId at :24-36): `worrySubjectId: z.string().optional().describe("Only when this fact is the parent naming the subject she worries about most for this child. The subject id from the map catalog.")`. Before either write path, verify with `MAP_SUBJECTS.some((subject) => subject.id === input.worrySubjectId)` (import at top from '@homa/core'), and drop the field silently when it does not resolve or when `childId` is absent, since a worry is always about one child. Pass it through `saveFamilyMemory` to the new `family_memories.worry_subject_id` column. Model proposes the subject, code decides whether it exists: the same shape as every other catalog-backed field in the product. `scanMemoryContent` still runs unchanged on the content.

### `apps/web/lib/celebration/compose.ts` (create)

**Purpose.** The one model call per child per week. Sentences and a peak pick, nothing else.

Imports at top: `generateObject` from 'ai', `z` from 'zod', `HOMA_MODEL` from '../../agent/model', `gatewayAttribution, recordModelUsage` from '../model-usage', `readFileSync` and `path` from node, the LetterFacts type.
`export const LETTER_COMPOSER_MODEL = HOMA_MODEL;`
`export const letterDraftSchema = z.object({ opening: z.string(), items: z.array(z.object({ slot: z.number().int().min(1).max(3), sentence: z.string() })).length(3), peakSlot: z.number().int().min(1).max(3), peakReason: z.string(), closing: z.string(), offer: z.string().nullable(), subject: z.string() });`
`export type LetterDraft = z.infer<typeof letterDraftSchema>;`
Deliberately NO `.max()` on any string: per AGENTS.md's third corollary a per-item length rule belongs in the validator, or one long sentence throws away two correct ones. Caps live in verify.ts.
`export async function composeFridayLetter(facts: LetterFacts, familyId: string): Promise<GenerationResult<LetterDraft>>` - the call shape of generateReportNarrative (apps/web/lib/map/narrative-generate.ts:53-114): system prompt read once from `path.join(process.cwd(), "agent", "letter-writer.md")` and cached; prompt is `["Write ${facts.childName}'s letter from these facts, computed by code.", "Every number and every date you write must appear in the facts. Any words you put in quotation marks must be copied exactly from a quote in the facts.", "<facts>" + JSON.stringify(facts) + "</facts>"].join("\n\n")`; `maxOutputTokens: 4000`; `maxRetries: 1`; `providerOptions: { gateway: { disallowPromptTraining: true, ...gatewayAttribution(familyId, "celebration_letter") } }`; then `recordModelUsage({ familyId, surface: "celebration_letter", model, modality: "text", inputTokens, outputTokens, durationMs })`.
`facts` here is the LetterFacts half only. Passing LetterControl into this function is a type error, which is the enforcement of the payload split.
Cost, stated up front rather than discovered in a bill: one composition per child per week; a four-child family is four calls a week.

### `apps/web/agent/letter-writer.md` (create)

**Purpose.** The versioned system prompt for the letter, on disk so the founder edits markdown, not code.

Mirrors apps/web/agent/report-writer.md's voice block and adds the letter's own laws in prose: a celebration is a receipt, never a verdict; every sentence names something that already happened and carries its date; write exactly one sentence per slot in the order given; name the act and the date and never describe the effort, the difficulty, or that the child kept going; never a total, never a percentage, never a fraction, never a count of abilities, never a period-over-period number, never a streak, never a number of days or weeks or months; only write the words 'this week' about a slot whose `withinLetterWeek` is true; never another child's name; no em dash anywhere; sentence case; use only the pronouns `childPronouns` permits; put words in quotation marks only when copying a `quote` field verbatim; a slot marked `isSlowAnswer` names what is under the child now, never what is coming, and is never the peak; pick the peak as the slot most worth holding onto and say why in one clause; restate the peak as the closing line; write at most one offer and only when the facts carry one; the subject line names the child. Ends with the reminder that a shorter true letter is always better than a fuller one, and that Homa is the keeper of the record, not its narrator.

### `apps/web/lib/celebration/verify.ts` (create)

**Purpose.** Everything code decides after the model proposes. No sentence reaches a parent without passing here.

`export const LETTER_LENGTH_CAPS = { opening: 220, item: 320, closing: 260, offer: 300, subject: 78 } as const;`
`export type PeakRepickReason = "missing_slot" | "not_this_week" | "not_mastered" | "no_date" | "frustrated_segment" | "worry_slow_answer";`
`export interface LetterVerdict { ok: boolean; rejected: Record<string, string>; rejectedPieces: string[]; peakSlot: 1|2|3|null; peakRepick: PeakRepickReason | null; sentences: [string, string, string]; opening: string; closing: string; offer: string | null; subject: string }`
`export function verifyLetterDraft(draft: LetterDraft, facts: LetterFacts, control: LetterControl, gate: NarrativeGateContext, childName: string): LetterVerdict`
 1. Slot cover. draft.items must carry slots 1, 2 and 3 exactly once, else `ok: false`: a missing slot is a length change and the length never changes.
 2. **Peak legality, tightened.** `peakSlot` must index a slot where ALL hold: `facts.slots[i].withinLetterWeek === true`; `facts.slots[i].observedOn !== null`; `control.slotStates[i] === "mastered" || control.slotDepths[i] === 3`; `control.slotFrustrated[i] === false`; `!(facts.slots[i].isWorryRail && facts.slots[i].isSlowAnswer)`. The `withinLetterWeek` and `observedOn` conditions are new and each closes a live wrong-result path: without the first, a quiet-week peak drawn from an October depth-7 restatement produced the closing "The thing to hold onto from this week is Tuesday" about something months old; without the second, a depth-3 implied ability (legal under the old rule, since its answer is null rather than `not_yet`) has `observedWeekday === null` and the fallback closing rendered the literal string "null" into a parent's inbox. On failure code re-picks deterministically: the shallowest legal slot, ties to the most recent observedOn, recording `peakRepick`. The model's peak pick is a preference, not a fact; discarding a verified letter over it trades a real receipt for silence. If NO slot is legal, `peakSlot` is null and render.ts uses the neutral close, which on a genuinely quiet week is always the case and is correct.
 3. Per-piece law. opening, the three sentences, closing, offer and subject each run `letterPieceProblem(text, cap, gate)`, which calls the newly exported `narrativePieceProblem` (packages/core/src/map/narrative-gate.ts:62-92: empty, over cap, BANNED_WORDS, EM_DASH, negative number, gendered pronoun when not allowed, DIAGNOSIS_SUBSTRINGS, sibling names, any digit run not in allowedNumbers) and then adds the letter-only laws:
    - `/%|\bpercent\b/i` -> 'percentage'
    - `/\b\d+\s*(?:of|out of)\s*\d+\b/i` or `/\b\d+\s*\/\s*\d+\b/` -> 'denominator'
    - `/\bstreak\b/i`, `/\bweeks? in a row\b/i` -> 'streak'
    - **`/\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\b/i` and `/\b(?:a few|several|a couple of|couple of)\s+(?:days|weeks|months)\b/i` -> 'elapsed time'.** NEW, and the direct catch for "These have been quiet for 3 weeks", which the old rule set let through on every axis. The approved copy "These have been quiet for a stretch" passes, and so does "a ten-minute way in" (no digit, no listed unit).
    - **`/\bthis week\b/i` -> 'this week with nothing from this week' when `facts.anyThisWeek === false`; and on the closing piece specifically, when the resolved `peakSlot` is null or `facts.slots[peakSlot-1].withinLetterWeek === false`.** Recency is now a typed property of the slot rather than an assumption baked into a string.
    - `/\bnothing happened\b/i`, `/\bno activity\b/i`, `/\bsince (?:we|you) last\b/i`, `/\bstill (?:waiting|nothing)\b/i`, `/\bit(?:'s| is| has been) \d+\b/i` -> 'accounting of the week'. Scoped so 'Reading did not move this week' and 'Story still counts past twenty' both pass.
    - `/\b(?:finally|at last)\b/i` -> 'finally' (spec R3 Never, and it reads as a verdict).
    - `/\bahead\b/i` -> 'ranked word'. Letter-scoped only: BANNED_WORDS bans 'behind' but not 'ahead' (packages/core/src/map/copy-laws.ts:12), and this does not pre-empt open decision D7, which is about a standing chip, not composed prose.
 4. Quote provenance. Every run of text inside straight or curly double quotes, in any piece, must appear whitespace-collapsed and case-folded as a substring of one `facts.slots[*].quote` or `facts.worry.parentWords`. Same discipline as verifyLessonClausePair's verbatim-substring check (apps/web/lib/lessons/pairs.ts:112-118). Verify provenance, not phrasing: no token-overlap score anywhere in this file.
 5. Offer count. At most one, and only when `facts.offer !== null`. A non-null draft.offer against a null facts.offer is dropped silently, not a whole-letter rejection.
 6. Subject. Must contain childName and be <= 78 chars, else replaced with `templateSubject(childName, facts, control.isoWeek)`.
 7. Per-piece fallback. A rejected item sentence falls back to `templateSentenceFor(slotFact, control)`. More than ONE rejected item sentence, or a rejected opening, sets `ok: false` for the whole letter, the same judgment narrative-gate.ts:127-130 makes about a half-fallback report.
On `ok: false` the sweep records status 'failed' with skip_reason 'gate_failed', emits `celebration.letter_gate_failed`, and sends nothing.

### `apps/web/lib/celebration/copy.ts` (create)

**Purpose.** Every parent-facing string in one file, with recency and date-presence as typed preconditions rather than assumptions.

Header comment states the laws: a receipt never a verdict; no string here may render a denominator, a percentage, a total, a streak, an elapsed count, or a comparison; and no string may assert 'this week' unless its caller has already proved `withinLetterWeek`.
Subjects, now two sets because the old ones were unconditional and a quiet week shipped "Three things Story did this week" over three October restatements:
 `export const LETTER_SUBJECTS_THIS_WEEK: readonly ((n: string) => string)[] = [ (n) => `Three things ${n} did this week`, (n) => `${n}'s week, in three parts`, (n) => `What ${n} showed you this week`, (n) => `Three from ${n}'s week` ];`
 `export const LETTER_SUBJECTS_QUIET: readonly ((n: string) => string)[] = [ (n) => `${n}'s week`, (n) => `How ${n}'s week looked`, (n) => `Three things still true for ${n}`, (n) => `A note about ${n}` ];`
 `export function templateSubject(childName: string, facts: { anyThisWeek: boolean }, isoWeek: number): string` - picks the set on `anyThisWeek`, then `set[isoWeek % set.length](childName)`, so four consecutive weeks never repeat a subject line.
Openings:
 `export const FIRST_LETTER_OPENING = "This is the first of these. It will get better as I know more, and everything in it came from you.";`
 `export function weekdayAnnouncement(weekdayName: string): string` -> `These come on ${weekdayName}, because that is when your week seems to land. Say the word and I will move it.` The promise is now honored: `set_celebration_letter_preference` writes the weekday with source 'parent'.
 `export const QUIET_WEEK_OPENING = "This week was quiet.";`
 `export const DEEP_STRETCH_OPENING = "These have been quiet for a stretch, and quiet stretches are normal.";`
 `export function ordinaryOpening(childName: string): string` -> `Here is ${childName}'s week.`
Closings, split so no string carries an untested recency claim:
 `export function templateClosingThisWeek(peak: LetterSlotFact): string` -> `The thing to hold onto from this week is ${peak.observedWeekday}. ${peak.statement}.` Caller must have `peak.withinLetterWeek === true` and `peak.observedWeekday !== null`; a dev-time invariant throws otherwise.
 `export function templateClosingStillTrue(peak: LetterSlotFact): string` -> `The thing to hold onto is still true: ${peak.statement}. You told me that on ${peak.observedOn}.` Requires `observedOn !== null`.
 `export const NEUTRAL_CLOSING = "That is the week. All of it came from you.";` Used whenever peakSlot is null.
Worry rail:
 `export function templateWorryMoved(input: { subjectName: string; namedOn: string; statement: string; readyNext: string }): string` -> `You told me in ${namedOn} that ${subjectName} is the one you think about. Here is where it is right now: ${statement}, and the thing sitting open next is ${readyNext}. It is moving slowly, and it is moving.`
 `export function templateWorrySlow(input: { subjectName: string; childName: string; under: readonly string[] }): string` -> with two: `${subjectName} did not move this week. What is under ${childName} is still under ${childName}: ${under[0]} and ${under[1]}. If you want, there is a ten-minute way into the next piece whenever you have it.` With one, the same sentence without the conjunction. `under` draws only from `mastered` nodes in the worry subject, so "still under him" is never a thing she said he could not do.
Quiet week:
 `export function templateQuietBody(childName: string, a: string, b: string): string` -> `This week was quiet. ${childName} still ${a} and still ${b}, and none of that went anywhere.`
Offers:
 `export const CADENCE_OFFER = "If you would rather these came monthly for a while, say the word.";` Kept, because the monthly mode and its tool now exist.
 `export function ritualOffer(input: { form: string; statement: string; childName: string }): string`
 `export function dinnerQuestionOffer(input: { childName: string; moment: string }): string` -> `If you want one, here is a question for the dinner table: "${moment}" Then just let ${childName} tell it, and ask what else they remember. Skipping it is completely fine.`
 `export const OFFER_STOP_LINE = "I will stop adding these little offers to the letters. They will keep to the moments something finishes.";`
Per-slot template fallbacks, one per depth and state:
 `export function templateSentenceFor(slot: LetterSlotFact, control: { depth: SlotDepth; state: SlotState }): string` - depth 1 mastered -> `${statement}. You told me that on ${observedOn}.`; depth 1 emerging -> `${childName} is starting to ${statement}. You told me that on ${observedOn}.`; depth 2 -> `${statement}, and by ${transition.onLocalDate} it was working.`; depth 3 -> `When you told me about ${confirming} on ${observedOn}, that settled ${statement} underneath it.`; depth 4 -> `${statement} turned up again on ${observedOn}.`; depth 5 -> `The thing sitting open next is ${statement}, because ${becauseOfStatements[0]} is already there.`; depth 6 -> `You mentioned ${rememberedFact} back on ${rememberedOn}, and ${statement} sits right beside it.`; depth 7 -> `${statement}. You told me that on ${observedOn}, and it is still true.` Depth 7's 'still true' is now safe because depth 7 draws mastered only.
Footer: `export const LETTER_FOOTER_NOTE = "Everything here came from what you told me. Reply to this email and Homa answers.";`
Outer note: reuse email.ts's compliance-reviewed default (apps/web/lib/map/email.ts:251); do not write a new one.
Every string and every template's output is asserted em-dash-free, BANNED_WORDS-free, and elapsed-time-free by copy.test.ts.

### `apps/web/lib/celebration/render.ts` (create)

**Purpose.** Turn the verified draft into the email's parts. No composition, no judgment.

`export interface RenderedLetter { subject: string; heading: string; bodyLines: string[]; footerNote: string; plainText: string }`
`export function renderLetter(verdict: LetterVerdict, facts: LetterFacts, control: LetterControl, childName: string): RenderedLetter`
 heading = verdict.opening (first-letter line, weekday announcement, quiet-week line, deep-stretch line, or ordinary opening, whichever facts selected in code).
 bodyLines = the three sentences in slot order with the peak's sentence LAST: `[...nonPeakInSlotOrder, peakSentence]`. Because `worryRailSlot` is pinned to 2 whenever the rail is the honest slow answer, a deficit sentence can never be line one and can never sit adjacent to the closing. Then the closing: `templateClosingThisWeek` when the peak is legal and within the week, `templateClosingStillTrue` when the model's closing was rejected and the peak has a date but is older, `NEUTRAL_CLOSING` when peakSlot is null. Then the offer, if any, as the final line, after the wins.
 No CTA button: the letter is a letter, not a funnel. `submitFridayLetter` passes no `cta`.
 plainText is the same lines joined with blank lines, truncated to 8000 for the conversation message content check (supabase/migrations/20260709121000_conversation_messages.sql:32-33).

### `apps/web/lib/celebration/store.ts` (create)

**Purpose.** Every durable read and write for the letter, on the server connection, with the recipient resolved once and the reply bound before the loop opens.

`export async function ensureDefaultRecipient(familyId: string, childId: string): Promise<LetterRecipient | null>` - THE FIX for recipient churn. If a row with `origin = 'default'` exists for this child, return it and NEVER re-derive. Otherwise resolve once, with a total order: the adult with the most `child_progress_evidence` rows for this child in the last 90 days, `where e.member_user_id is not null` and a current `family_members` row exists, `order by count(*) desc, min(e.created_at) asc, m.user_id asc`; email via `join auth.users u on u.id = m.user_id` on the server connection, the path family-invites uses (apps/web/lib/family-invites.ts:53-57). Falls back to `families.email` with `member_user_id = null`. Inserts with `on conflict (child_id) where origin = 'default' do nothing`, then re-reads. The old code re-derived on every tick from a `count desc` with no tiebreak: two adults tied at 12 rows each, Postgres free to return either, and the 4-hour window giving up to four ticks, meant tick one recorded weekly_cap for adult A's hash and tick two claimed cleanly under adult B's hash and sent. That is spec 5E's "skeptical co-parent receiving unrequested celebration" harm, produced by the very system D5 exists to prevent, and it also contradicted the plan's own claim that a second adult appears only by opt-in.
`export async function resolveLetterRecipients(familyId: string, childId: string): Promise<LetterRecipient[]>` - reads `celebration_letter_recipients` where `state = 'opted_in'`, and for rows with a non-null `member_user_id` re-verifies the `family_members` row in the same query (belt above the FK's braces), returning the current address from `auth.users`.
`export async function claimLetterWeek(input: { familyId: string; childId: string; recipientId: string; recipientEmailHash: string; isoYear: number; isoWeek: number }): Promise<string | null>` - `insert ... values (..., 'composing') on conflict do nothing returning id` against the PARTIAL index. A null return means another tick owns this week. Before claiming, count rows for this (child, recipient, week) with `status = 'failed'`; at >= 2 return null without inserting, so a persistent gateway outage costs two model calls a week, not four.
`export async function recordLetterSkipped(input: { ...same keys...; reason: LetterSkipReason }): Promise<string | null>` - plain insert with status 'skipped', returning the id. It no longer collides with the outbox and it no longer silences a week. Returns the inserted id so the sweep can emit an event only when a row was actually written.
`export async function markLetterSent(...)`, `export async function markLetterFailed(letterId, familyId, reason: "gate_failed" | "compose_timeout" | "send_failed")` - both `where id = $letterId and family_id = $familyId and status = 'composing'`.
`export async function previousLetterGrounding(childId: string, familyId: string): Promise<{ previousItemIds: string[]; previousQuietItemIds: string[]; consecutiveDeepWeeks: number; sentLettersSinceWorryRail: number; isFirstLetter: boolean }>` - reads SENT rows only, so a hold or a gate failure leaves no visible trace in the next letter's content.
`export async function reapStaleComposingLetters(now: Date): Promise<number>` - flips `composing` rows older than **30 minutes** to `'failed'` with skip_reason 'compose_timeout'. Not the 2 hours the tasks reaper uses (apps/web/lib/tasks/store.ts:1135): two hours is half the 4-hour delivery window and the retry would arrive at the edge or not at all. Because the outbox index is partial on ('composing','sent'), flipping to 'failed' releases the week for a retry AND leaves the failure on the record, which is why I do not delete the row.
`export async function openLetterOfferLoop(input: { familyId: string; letterId: string; recipientMemberUserId: string | null; recipientEmail: string; letterText: string }): Promise<{ deliveryId: string; attempt: DeliveryAttempt } | null>` - ONLY when the letter carries an offer, and now called BEFORE the send so the reply address can be signed:
  1. `createProactiveEpisode({ familyId })` (apps/web/lib/conversation-continuity/ledger.ts:203-212).
  2. Insert one `conversation_messages` row with `session_id = 'celebration-letter:' + letterId`, `sequence = 1`, `channel='email'`, `role='assistant'`, `visibility='family'`, `content = letterText.slice(0, 8000)`, `on conflict (session_id, sequence) do nothing returning id` (the unique at supabase/migrations/20260709121000_conversation_messages.sql:36 makes this idempotent for free).
  3. `beginDeliveryAttempt({ familyId, episodeId, messageId, taskRunId: null, memberUserId, channel: 'email', destination: recipientEmail })` (apps/web/lib/conversation-continuity/delivery-ledger.ts:159-170; task_run_id is nullable, supabase/migrations/20260711143707_conversation_continuity.sql:117). Returns the attempt so the sweep can sign the reply address with it.
`export async function completeLetterOfferLoop(input: { attempt: DeliveryAttempt; providerSubmissionId: string; retrieveProviderMessageId: () => Promise<string | null>; letterId: string }): Promise<string>` - `finishDeliveryAttempt(attempt, { delivered: true, providerSubmissionId })`, then `enrichDeliveryAttemptProviderMessageId` (delivery-ledger.ts:313-340) with the RFC id from the closure map/email returns (apps/web/lib/map/email.ts:293-295), then `openReplyLoop({ attempt, contract: { kind: 'yes_no', promptKey: 'friday-letter:' + letterId, expiresAfterMs: 72*60*60_000 } })` (delivery-ledger.ts:344-383). Both enrichment paths matter: without the signed reply address the explicit-delivery branch (reply-policy.ts:235-241) never fires, and without the RFC id the In-Reply-To branch (:243-252) never fires, leaving only the bare yes/no polarity heuristic (:291-320). A mother replying "we're pretty slammed this month, maybe later" classifies as "answered", the yes_no candidate is not eligible, `resolved_outcome` is never written, and the two-declines-and-stop rule promised at spec R6 line 124 can never fire.
`export async function letterOffersSuppressed(childId: string, familyId: string): Promise<boolean>` - true when this child's last three letter loops produced NO `resolved_outcome = 'accepted'`, counting an expired unresolved loop as "no accept". I do not record silence as a decline: deciding that an unanswered email means "no" is a judgment about what she meant, and code does not get to make that call. Counting the absence of an accept is a fact. When it flips true the next letter carries no offer and says OFFER_STOP_LINE once, recorded by `offer_stop_announced`.
`conversation.offer_fulfilled` stays morning-brief-scoped (apps/web/lib/conversation-continuity/offer-fulfillment.ts:71 requires `r.kind = 'morning_brief'` on a joined homa_task_runs row) and is DELIBERATELY not widened; see risks.
Also here: `loadSchoolWeekSignals(familyId, zone)` for school-week.ts, and `writeLetterPreference(...)` used by the agent tool.

### `apps/web/lib/celebration/sweep.ts` (create)

**Purpose.** The planner and the send loop. Rides /api/map/cron hourly, longest wait first.

`export const MAX_LETTERS_PER_RUN = 12;` with the arithmetic stated rather than inherited: the drip's 5 (apps/web/lib/drip/sweep.ts:52-60) was calibrated for a domain that had never sent proactive mail in July, and the drip's queue drains permanently because each kind is once-ever. The letter recurs forever and concentrates: `deriveLetterWeekday` returns Friday 09:00 unless a rival weekday beats Friday by 1.5x, so most families land in one (zone, hour) cohort. 5 per tick over a 3-hour window was 15 letters per cohort per week against a stated 25 multi-kid production families averaging over two children, so roughly a third of the fleet would have recorded `stale_window` at 12:00 and, under the old fixed `(familyCreatedAt, familyId)` ordering, it would have been the SAME newest families every week, forever, with the console showing a reason that reads as downtime. 12 per tick over the widened 4-hour window is 48 per cohort per week, and the ordering below removes the structural starvation independently of the ceiling.
`export interface LetterSendPlan { sends: PlannedLetter[]; eligible: number; capped: boolean; deferred: string[] }`
`export function planLetterSends(candidates: readonly LetterCandidateSignals[], isoWeek: number, now: Date, limit?: number): LetterSendPlan` - PURE:
  1. `chooseLetterSend` per candidate; keep the sends.
  2. Group by familyId.
  3. **Order families by longest wait: `lastLetterDeliveredAt` ascending with nulls FIRST, then familyId.** Not `familyCreatedAt`. `planDripSends` can use a fixed intent order (drip/sweep.ts:229-237) because a nudged family leaves the queue; a weekly beat's queue is the same families every week, so a fixed order is a permanent ranking and the tail never gets served.
  4. Inside a family, order children by created_at then id, then `rotateBySeed(children, isoWeek)`. No child is permanently first in the inbox.
  5. Take WHOLE families until the budget is spent. A family whose beat does not fit waits for the next tick; a family with more than MAX_LETTERS_PER_RUN children takes its own tick alone rather than being split. Splitting a beat across two days is the one failure that makes a mother count her children's letters.
  6. `eligible` reports the true queue size before the cap; `deferred` lists the child ids the cap held back.
`export interface LetterSweepResult { skipped: boolean; considered: number; eligible: number; sent: number; skippedLetters: number; failed: number; deferred: number; capped: boolean; reaped: number }`
`export async function runCelebrationLetterSweep(now?: Date): Promise<LetterSweepResult>`:
  reap stale composing rows; `loadLetterWindowSignals(now)`; run Stage A per candidate and derive `datedConfirmedAbilityCount` ONLY for those that passed it; plan; then per planned letter, in order: re-run `chooseLetterSend` against freshly read signals at SEND time (the drip's re-check discipline, sweep.ts:437-448, :464) so a hold or an opt-out that landed mid-tick still wins; `claimLetterWeek` (null means skip silently); `loadLetterSources`; `loadChildParentWords`; `selectLetterSlots`; `buildLetterFacts`; `composeFridayLetter`; `verifyLetterDraft`; on `ok: false` -> `markLetterFailed` + emit `celebration.letter_gate_failed` and continue; `renderLetter`; **when the letter carries an offer, `openLetterOfferLoop` FIRST and pass `replyTo: buildSignedReplyAddress(attempt.id, process.env.RESEND_INBOUND_SECRET)` into `submitFridayLetter`** (the dispatch-transport pattern, apps/web/lib/tasks/dispatch-transport.ts:117-119); `submitFridayLetter`; on status !== 'submitted' -> `markLetterFailed(..., 'send_failed')` and continue; `completeLetterOfferLoop` with the submission's `retrieveProviderMessageId`; `markLetterSent`; emit `celebration.letter_sent` and, when re-picked, `celebration.letter_peak_repicked`.
  Named-reason skips: `recordLetterSkipped` returns the inserted id, and `celebration.letter_skipped` is emitted ONLY when a row was actually written. Combined with Stage A running first, a permanently opted-out family now produces at most one row and one event per child per ISO week instead of 168.
  Burst deferral: a deferred child records nothing on an ordinary tick, because the next tick sends it. Only on the LAST tick of the window (`localHourOf(zone, now) === letterLocalHour + LETTER_DELIVERY_WINDOW_HOURS - 1`) does a still-deferred child record `burst_deferred`, so the console never conflates a ceiling with downtime.

### `apps/web/agent/tools/set_celebration_letter_preference.ts` (create)

**Purpose.** The write path behind the two sentences the letter says out loud. Without it the copy promises controls that do not exist.

NEW in this revision. `CADENCE_OFFER` ("If you would rather these came monthly for a while, say the word") and `weekdayAnnouncement` ("Say the word and I will move it") were shipped against nothing: there was no cadence column, no weekday writer, and the only email control in the product is the binary `journal_opt_out_at` (supabase/migrations/20260709230000_gateway_groundwork.sql:19, applied at apps/web/agent/channels/email.ts via optOutIntent). A mother three weeks into a deep stretch replying "yes please, monthly" would have got another weekly letter seven days later, from the one control Homa offered at the moment it admitted the letters were thin.
`defineTool` in the shape of apps/web/agent/tools/remember.ts:20-60 (imports at top: `defineTool` from 'eve/tools', `z`, `MissingFamilyContextError, resolveAgentAccess` from '../../lib/agent-db', the store writers).
description: "Change how often this family's weekly letters arrive, which day they land on, or turn one child's letters off. Use when a parent asks for these emails monthly, asks to move the day, or asks to stop them for one child."
inputSchema: `z.object({ cadence: z.enum(["weekly","monthly"]).optional(), weekday: z.number().int().min(1).max(5).optional().describe("1 Monday to 5 Friday"), childId: z.uuid().optional(), muted: z.boolean().optional() })`.
execute: `familyId` comes from `resolveAgentAccess(ctx.session.auth.current?.attributes)` and NEVER from the model. `cadence` and `weekday` write `families.celebration_letter_cadence` / `_weekday` with `_weekday_source = 'parent'`. `muted` requires `childId`, re-scoped inside the authenticated family, and flips `celebration_letter_recipients.state` for the row whose `member_user_id` is the session user; on the pinned SMS path (no user id) it flips the child's `origin = 'default'` row, and the result names which recipient changed so Homa can say it plainly. Returns `{ changed: true, cadence, weekday, mutedChildName }` or `{ changed: false, note }`. The tool result is the only truth about whether anything happened.
Register the description in the slash-menu parity source that `pnpm check:fleet-skills` reads.

### `apps/web/lib/map/email.ts` (modify)

**Purpose.** One new ledger kind and one new submitter, with a signable reply address.

1. Add `| "friday_letter"` to the `EmailLedgerKind` union (currently :38-52). The schema's `kind` is free text and this union IS its validation per the comment at :32-37; no migration.
2. New exported submitter after submitDripLoopBack (:736):
```
export async function submitFridayLetter(
  to: string,
  letter: { subject: string; heading: string; bodyLines: string[]; footerNote: string },
  ledger: { familyId: string; childId: string; isoYear: number; isoWeek: number; fallbackDepth: number; peakSlot: number | null; offerKind: string | null; quietWeek: boolean },
  replyTo?: string,
): Promise<HomaEmailSubmission>
```
Calls `submit({ to, subject, preview: bodyLines[0] ?? heading, heading, bodyLines, footerNote, replyTo, headers: unsubscribeHeaders(to), ledger: { kind: "friday_letter", familyId, meta: { child_id, iso_year, iso_week, fallback_depth, peak_slot, offer_kind, quiet_week } } })`. No `cta`. The `replyTo` passthrough is required, not cosmetic: `submit` defaults to the fixed `REPLY_TO` at :266 (`reply_to: [args.replyTo ?? REPLY_TO]`, REPLY_TO at :26), and with the fixed address the explicit-delivery reply branch cannot bind. `unsubscribeHeaders` (:652-661) is reused unchanged and the compliance-reviewed outer note (:251) stays.
3. Doc comment next to the union: the letter records its SEND here (the family's proactive-mail receipt) and separately records a `conversation_deliveries` row ONLY when it carries an offer, purely as the reply surface. That is not a second send receipt: the admin brief funnel joins homa_task_runs (apps/web/lib/admin/overview-data.ts:226-231) and a null task_run_id row cannot appear there.

### `apps/web/lib/drip/sweep.ts` (modify)

**Purpose.** Make the one-proactive-email-per-family-per-week fence real across both systems.

Rename `DripSignals.lastDripSentAt` to `lastProactiveSentAt` (interface :91, chooser :110-115, mapper ~:422) and widen the source subquery in `loadDripSignals` (:377-380) from `where es.family_id = f.id and es.kind like 'drip_%'` to `where es.family_id = f.id and (es.kind like 'drip_%' or es.kind = 'friday_letter')`. Comment: the cap has always been 'one proactive email per family per seven days'; until the Friday letter existed, 'drip_%' was the whole set of proactive mail, and it is not any more. Without this a family gets a letter on Friday and a setup nudge on Saturday. The drip keeps its rolling 168-hour window, which is correct on this side because every drip kind is additionally once-ever; only the letter needed the ISO-week formulation. `sentKinds` (:381-388) is left alone: it is the once-ever-per-kind guard and the letter is not a drip kind. This is the only change to a live sending system in the tranche and it can only ever make the drip quieter.

### `packages/core/src/map/narrative-gate.ts` (modify)

**Purpose.** Export the per-piece law so agent-composed email passes the exact same check, with zero duplicated law.

Rename the module-private `pieceProblem` (:62) to `narrativePieceProblem` and export it: `export function narrativePieceProblem(text: string | undefined, cap: number, context: NarrativeGateContext): string | null`. Body unchanged. `validateNarrative` (:94) and `validatePlanNarrative` (:135) call the exported name. Header comment gains one sentence: the same law now runs over agent-composed emails and printables, which is spec section 6 build-order item 1 done without a second copy of the rules. Also export it from `packages/core/src/index.ts` alongside validateNarrative. Behavior is identical, so `scripts/map-check.mts` (which drives the gate) must stay green unchanged.

### `packages/core/src/events.ts` (modify)

**Purpose.** Four typed events. No child name, no quote, no statement text in props.

Add next to the map.narrative_* entries (:407-424) with the same comment density:
`"celebration.letter_sent": z.object({ family_id: z.uuid(), child_id: z.uuid(), iso_week: z.number().int().min(1).max(53), fallback_depth: z.number().int().min(1).max(7), peak_slot: z.number().int().min(1).max(3).nullable(), worry_rail: z.boolean(), quiet_week: z.boolean(), offer_kind: z.enum(["ritual","dinner_question","cadence"]).nullable() })`
`"celebration.letter_skipped": z.object({ family_id: z.uuid(), child_id: z.uuid(), reason: z.enum(["hard_day_hold","closed_window","stale_window","burst_deferred","weekly_cap","too_new","too_few_dated_abilities","suppressed","opted_out","gate_failed","compose_timeout","send_failed","no_email","no_recipient"]) })`
`"celebration.letter_gate_failed": z.object({ family_id: z.uuid(), child_id: z.uuid(), rejected_pieces: z.array(z.string()).default([]) })`
`"celebration.letter_peak_repicked": z.object({ family_id: z.uuid(), child_id: z.uuid(), model_slot: z.number().int().min(1).max(3), code_slot: z.number().int().min(1).max(3).nullable(), reason: z.enum(["missing_slot","not_this_week","not_mastered","no_date","frustrated_segment","worry_slow_answer"]) })`
Run `pnpm check:events` (scripts/events-check.mts) for registry parity in both directions.

### `apps/web/app/api/map/cron/route.ts` (modify)

**Purpose.** Run the sweep hourly, report its counts on the heartbeat.

Top-level imports only: `celebrationLettersEnabled` from '../../../../lib/celebration/flag' and `runCelebrationLetterSweep, type LetterSweepResult` from '../../../../lib/celebration/sweep'. Declare `let letters: LetterSweepResult = { skipped: true, considered: 0, eligible: 0, sent: 0, skippedLetters: 0, failed: 0, deferred: 0, capped: false, reaped: 0 };` beside the existing `drip` initializer (:101-109), and call `if (celebrationLettersEnabled()) letters = await runCelebrationLetterSweep();` immediately after the drip block. Add `letters` to the response JSON and to `recordCronRun`. Extend the route's numbered doc comment (:36-62) with item 10 describing the letter beat and naming its flag.

### `apps/web/next.config.ts` (modify)

**Purpose.** Ship the letter's system prompt with the cron route's bundle.

Add `"./agent/letter-writer.md"` to the existing `outputFileTracingIncludes["/api/map/cron"]` array (currently `["./agent/memory-extractor.md"]` at :27-35). Same reason report-writer.md is listed for /api/map/score: compose.ts reads the prompt from disk at runtime via readFileSync, exactly as narrative-generate.ts:43-47 does.

### `apps/web/lib/email/suppression.ts` (modify)

**Purpose.** Name the scope honestly for a second caller.

Add `export async function suppressedHashesForProactiveMail(hashes: string[]): Promise<Set<string>> { return await suppressedHashesForDrip(hashes); }` with a comment: the 'drip' suppression scope means all proactive mail, and a Friday letter is proactive mail, so a parent who used the one-click unsubscribe on a nudge must never receive a letter. No migration: the scope check already allows 'drip' (supabase/migrations/20260720120000_email_suppressions.sql:16) and suppressedHashesForDrip already spans both blocking scopes (:79-94).

### `scripts/celebration-letter-postgres-test.mts` (create)

**Purpose.** The disposable-cluster harness for the store rules the pure tests cannot reach.

Copies the shape of scripts/child-progress-postgres-test.mts (creates and removes its own local cluster, needs no remote credentials), applies the tranche's migration plus its dependencies, and runs apps/web/lib/celebration/store.e2e.ts. It exists because the three most damaging findings in this tranche (the skip row silencing a week, the recipient churn minting a second letter, the hold compounding) are all index-and-upsert behavior that a pure unit test cannot express.

### `package.json` (modify)

**Purpose.** Runnable guards for the tranche.

Add `"check:celebration": "tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/celebration/week.test.ts apps/web/lib/celebration/window.test.ts apps/web/lib/celebration/school-week.test.ts apps/web/lib/celebration/eligibility.test.ts apps/web/lib/celebration/slots.test.ts apps/web/lib/celebration/facts.test.ts apps/web/lib/celebration/verify.test.ts apps/web/lib/celebration/copy.test.ts apps/web/lib/celebration/sweep.test.ts packages/core/src/map/narrative-gate.test.ts"` and `"celebration:e2e": "NODE_OPTIONS=--conditions=react-server tsx scripts/celebration-letter-postgres-test.mts"` next to the other check:* scripts (:10-16, :38-39). Add `check:celebration` to the CI workflow's guard list alongside check:map and check:events, and `celebration:e2e` alongside the ChildProgress E2E.

## Tests

### `apps/web/lib/celebration/week.test.ts`

- isoWeekOf derives from the family-local date, so 2026-01-01T04:00Z in America/Los_Angeles reports the 2025 ISO year
- isoWeekOf agrees for two instants that are the same family-local day but different UTC days
- isoWeekOf returns week 53 for a long ISO year and never returns 0 or 54
- localIsoWeekStart returns the UTC instant of Monday 00:00 family-local, and is strictly before a Friday 09:00 local send in the same week
- localIsoWeekStart across a spring-forward Sunday returns a real instant whose local hour is 0
- isFirstIsoWeekOfLocalMonth is true for the ISO week containing the local 1st and false for every other week of that month
- isFirstIsoWeekOfLocalMonth is true exactly once per month over twelve consecutive months
- rotateBySeed returns the input unchanged for 0 and 1 items
- rotateBySeed puts a different child first in consecutive ISO weeks and cycles through every child over N weeks
- rotateBySeed is stable for the same items and seed, and handles a seed larger than the item count and a negative seed

### `apps/web/lib/celebration/window.test.ts`

- withinProactiveWindow is false on Sunday at every hour
- withinProactiveWindow is false Saturday 18:00 local and true Saturday 17:59
- withinProactiveWindow is false Monday 06:59 local and true Monday 07:00
- letterWindowState returns closed_window for Saturday 18:00 even when letterWeekday is 6, proving the floor runs before the weekday test (the pure function is called with a value the families check constraint forbids, on purpose)
- letterWindowState returns closed_window for Sunday at the configured letter hour
- letterWindowState returns not_due on the wrong weekday inside the open window
- letterWindowState returns not_due one hour before the letter hour and due at the letter hour
- letterWindowState returns due at letterLocalHour + 3 and stale_window at letterLocalHour + 4

### `apps/web/lib/celebration/school-week.test.ts`

- a distribution with fewer than 8 total signals returns Friday with source default
- a distribution concentrated on Thursday at more than 1.5x Friday returns Thursday with source derived
- a Thursday peak that is only 1.2x Friday returns Friday
- a Saturday-heavy distribution returns Friday: the closed window means Saturday is never a candidate
- a Sunday-heavy distribution returns Friday
- an even distribution across Monday to Friday returns Friday
- parent-event counts and inbound-message counts are summed, not compared

### `apps/web/lib/celebration/eligibility.test.ts`

- EIGHT CONSECUTIVE WEEKLY TICKS over a fake clock at the same family-local hour produce EIGHT sends, not one (the regression test for the rolling-168-hour cap)
- a friday_letter sent at the same local hour exactly 7 days minus 15 seconds earlier does not cap, because the cap compares against the local ISO week start
- a drip nudge sent Tuesday of the current local ISO week records weekly_cap on Friday
- a drip nudge sent Saturday of the PREVIOUS local ISO week does not cap
- a sibling's letter sent 10 minutes ago in the same ISO week does NOT cap this child (one beat, N letters)
- a sandbox family is never in the audience and records no row
- a family with a null time_zone records no row
- a muted recipient records no row at all
- a tick on the wrong weekday returns a null reason and never evaluates opted_out, suppressed, too_new or too_few (the event-flood regression test)
- a permanently opted-out family produces at most one row and one event per child per ISO week across 168 simulated hourly ticks
- families.journal_opt_out_at set records opted_out on a due tick
- a suppressed address records suppressed on a due tick
- a family 6 days old records too_new on a due tick; at 7 days and 1 minute it is eligible
- a child with 2 dated mastered abilities records too_few_dated_abilities
- a child with 3 dated nodes where 1 is implied (observedAt null) records too_few_dated_abilities
- a child whose only dated nodes are not_yet records too_few_dated_abilities and is never eligible
- alreadyClaimedThisWeek reads only status in ('composing','sent') and returns a null reason
- a monthly-cadence family in a non-first ISO week returns a null reason and records nothing
- a monthly-cadence family in the ISO week containing the local 1st is eligible
- three hours past the letter hour is still due; four hours past records stale_window
- an active hold records hard_day_hold and adds no outbound message of any kind
- a hold that expired one minute ago does not suppress
- a null recipientEmail records no_email

### `apps/web/lib/celebration/slots.test.ts`

- a full week returns exactly three slots at depths 1, 1, 2 with fallbackDepth 2 and anyThisWeek true
- a quiet week with only depth-7 candidates returns exactly three slots and anyThisWeek false
- NO slot at any depth ever carries a not_yet answer, given a candidate pool where two thirds of the dated nodes are not_yet
- a corrected item (correction row, state not_yet) never appears at any depth
- an emerging node may fill a depth-1 slot and is flagged so verify can bar it from the peak
- an ability that filled a slot last week is skipped when deeper candidates exist
- when exclusions leave fewer than three, the quiet-week exclusion relaxes first and the consecutive-letter exclusion second, and the result is still three
- a child with exactly three dated mastered abilities, two of which filled last week's letter, still returns three slots
- depth-7 candidates prefer distinct subjects over three restatements from one onboarding sitting
- the worry rail takes the shallowest candidate in the worry subject, overriding a faster-moving subject
- the worry rail falls through depths 2, 3, 4, 5 to the depth-7 honest slow answer in that order
- an honest-slow-answer rail is pinned to slot 2 and is never slot 1
- a moving worry rail may be slot 1 or 2
- the worry rail is never slot 3, so it never sits adjacent to the closing
- a worry subject with no candidate at any depth does not fire the rail and does not consume the cadence
- worryRailDue true with candidates present always reserves a slot
- selectLetterSlots throws when it cannot produce three, and the caller records failed rather than sending two
- assertThreeSlots throws when a slot carries not_yet, when worryRailSlot is 3, and when a slow answer lands in slot 1
- fallbackDepth is the deepest rung used, not the shallowest

### `apps/web/lib/celebration/facts.test.ts`

- the serialized MODEL payload for a two-child family contains neither the sibling's name nor any sibling item id
- the serialized model payload contains no item id, no raw ISO timestamp, no depth and no consecutiveDeepWeeks
- allowedNumbersFrom(facts) does not contain the digits of fallbackDepth or consecutiveDeepWeeks when those are 5 and 3
- allowedNumbersFrom(facts) contains every date digit run the letter may print and nothing else
- genderedPronounsAllowed is computed from the full quote corpus and is IDENTICAL across two consecutive weeks whose selected slots differ
- a quote nulled for naming a sibling does not flip genderedPronounsAllowed to false
- a child with zero quotes anywhere in the corpus is they/them
- a quote containing a sibling name is nulled before the model sees it
- a quote containing a diagnosis substring is nulled before the model sees it
- a quote longer than 240 characters is nulled
- observedOn and observedWeekday are computed in the family's zone: evidence at Tuesday 23:30 America/New_York reports Tuesday, not Wednesday
- withinLetterWeek is true only for observedAt inside the family-local letter week
- a depth-3 implied slot has observedAt null, observedWeekday null, and observedOn set to the confirming report's date
- a slot with a null quote produces facts with quote null, never an empty string
- letterGateContext drops a sibling whose name equals the child's name

### `apps/web/lib/celebration/verify.test.ts`

- a draft missing slot 2 fails the whole letter
- a draft naming the same slot twice fails the whole letter
- a peak pointing at a slot with withinLetterWeek false is re-picked and reports not_this_week
- a quiet-week draft where NO slot is within the week yields peakSlot null and the neutral close
- a peak pointing at a depth-3 slot with a null observedWeekday still renders a closing that never contains the string null
- a peak pointing at an emerging slot is re-picked and reports not_mastered
- a peak pointing at a slot from a frustrated lesson segment is re-picked and reports frustrated_segment
- a peak pointing at the worry rail's honest slow answer is re-picked and reports worry_slow_answer
- a slot whose lesson has no tone notes at all is a legal peak (absent tone is not a frustrated beat)
- 'These have been quiet for 3 weeks' is rejected as elapsed time
- 'These have been quiet for a stretch, and quiet stretches are normal' passes
- 'a ten-minute way into the next piece' passes (no digit, no listed unit)
- a piece containing 'this week' when anyThisWeek is false is rejected
- a closing containing 'this week' when the peak slot is not within the week is rejected
- a closing containing 'this week' when the peak IS within the week passes
- an em dash anywhere rejects the piece
- the word behind rejects the piece; the word ahead rejects the piece
- a percentage rejects the piece; '3 of 7' rejects; '3/7' rejects
- the word streak and the phrase weeks in a row reject the piece
- 'nothing happened' rejects; 'Reading did not move this week' passes; 'Story still counts past twenty' passes
- the word finally rejects the piece
- a number not present in the facts rejects the piece
- a number that appears only inside a parent quote is allowed
- he or she rejects the piece when the corpus never genders the child
- a sibling's name rejects the piece
- a quoted string that is not a verbatim substring of any facts quote rejects the piece
- a quoted string differing only by whitespace and case verifies
- an offer proposed when facts.offer is null is dropped without failing the letter
- one rejected item sentence falls back to its template and the letter still sends
- two rejected item sentences fail the whole letter; a rejected opening fails the whole letter
- a subject line over 78 characters, or without the child's name, is replaced with the template subject

### `apps/web/lib/celebration/copy.test.ts`

- no exported string or template output contains an em dash
- no exported string or template output matches BANNED_WORDS
- no exported string contains a percent sign, a fraction, the word total, the word streak, or a digit followed by days/weeks/months/years
- a quiet week (anyThisWeek false) never selects a subject line containing the words 'this week'
- templateSubject cycles four distinct lines over four consecutive ISO weeks, in both the this-week and quiet sets
- templateClosingThisWeek throws when given a peak with withinLetterWeek false
- templateClosingThisWeek throws when given a peak with a null observedWeekday
- templateClosingStillTrue names a date and never contains 'this week'
- every template sentence for every depth names a date, and no template output contains the literal string 'null'
- templateWorrySlow with one 'under' statement renders a grammatical sentence and never uses the word behind
- the cadence offer and the offer stop line each appear exactly once in the module

### `apps/web/lib/celebration/sweep.test.ts`

- planLetterSends orders families by lastLetterDeliveredAt ascending with nulls first, so a family skipped last week is planned first this week
- over six simulated weeks with 22 eligible children and a ceiling of 12, every child receives at least five letters and no child receives zero
- planLetterSends is reproducible: two runs over the same input plan the same sends
- planLetterSends rotates child order by ISO week so no child is permanently first
- planLetterSends takes whole families: a family of 3 whose beat does not fit waits for the next tick rather than splitting
- a family with more children than the ceiling is planned alone in one tick
- eligible reports the true queue size before the cap; capped is true when the cap held sends back; deferred lists the held child ids
- a deferred child records nothing on a mid-window tick and records burst_deferred only on the final tick of the window
- a candidate rejected with a null reason produces no row and no event
- celebration.letter_skipped is emitted only when recordLetterSkipped actually inserted a row

### `apps/web/lib/celebration/store.e2e.ts`

- a too_few_dated_abilities row written Monday for ISO week W does NOT block claimLetterWeek on Friday of week W
- a too_new row written Monday does not block the family's first letter on Friday
- two overlapping claimLetterWeek calls for the same child, recipient and week: one returns an id, the other returns null
- a failed row and a later sent row coexist for the same child, recipient and week
- after two failed rows for the same week, claimLetterWeek returns null without inserting a third
- reapStaleComposingLetters flips a composing row older than 30 minutes to failed and a subsequent claim succeeds
- ensureDefaultRecipient returns the SAME recipient row on a second call even when the evidence counts have since flipped between two adults
- ensureDefaultRecipient breaks a 12-to-12 tie deterministically by earliest evidence created_at then user id, across ten repeated resolutions
- deleting a family_members row cascades the co-parent's celebration_letter_recipients row away, and resolveLetterRecipients stops returning him
- a recipient row whose member_user_id is null (families.email fallback) survives a family_members delete
- an opted-in second adult receives their own letter in the same ISO week as the default recipient
- recordProactiveHold at T then again at T+1h leaves expires_at at exactly T+73h, not T+144h
- recordProactiveHold preserves started_at from the first write
- openLetterOfferLoop is idempotent on (session_id, sequence) and does not mint a second conversation message

### `apps/web/lib/celebration/hold.test.ts`

- activeProactiveHolds returns only holds whose expires_at is in the future
- activeProactiveHolds fails open to an empty map only on a missing-table error and rethrows anything else
- heldWithinLastWeek is true for a hold that expired yesterday, so offers stay off in the week a hold ran
- no message text is written on any path

### `apps/web/lib/celebration/worry.test.ts`

- readNamedWorry returns null when worry_subject_id does not resolve in MAP_SUBJECTS
- readNamedWorry returns null when parentWords is not a verbatim substring of the stored content
- readNamedWorry returns null for a memory row belonging to another child in the same family
- worryRailDue counts sent letters, not elapsed weeks: three holds in a row do not burn the cadence
- the remember tool drops worrySubjectId when the id is not in the catalog and when childId is absent

### `packages/core/src/map/narrative-gate.test.ts`

- narrativePieceProblem is exported and returns the same verdicts the private function did for banned word, em dash, negative number, gendered pronoun, diagnosis phrase, sibling name and unknown number
- validateNarrative behavior is unchanged after the rename (a known-good narrative still passes, a red-team narrative still fails)
- an empty string returns empty and a string over the cap returns the over-cap reason

## Edge cases

- A weekly beat sent at the same family-local hour every week. `email_sends.created_at` is stamped at insert, after compose and the Resend POST, so the elapsed gap is always a few seconds SHORT of 168 hours. Any rolling-milliseconds cap kills the second letter and every letter after it. The cap is an ISO week identity test.
- A mother's correction, written as an evidence row with answer `not_yet`, source `correction`, and a real `observed_at`. It is a lit node in `deriveAbilityMap` with a date. Every slot rung filters on derived state, never on the presence of a date, so it can never be read back to her as a win.
- A child whose only three dated abilities are `not_yet`. Under a date-only floor she was eligible and received three fabrications. Under the mastered-with-date floor she is `too_few_dated_abilities` and receives nothing, which is correct.
- A transition whose later row the mother then disputed, opening a `child_progress_conflicts` row. The abilities map goes dark for that item and the Progress page shows nothing; the letter must too. Depth 2 skips every item id in `openConflicts` and pairs against the EFFECTIVE row, not the raw ledger.
- A resolved conflict where the discarded row is the earlier half of a pair. The discarded evidence id is dropped from the item's history before pairing, so the transition is never built from a row the family already resolved away.
- A named-reason skip written on Monday, before the letter was ever due, blocking Friday's send. The window gates now run first so no named reason is recorded outside the send window, and the outbox index is partial so a skip row cannot occupy the week.
- A family that replied STOP. Under the old ordering it emitted a skip event 168 times a week per child, roughly 6,700 rows a week fleet-wide, drowning the one signal spec 5G needs. Now at most one row and one event per child per ISO week, and only on the family's own weekday.
- Two adults on one family tied at exactly 12 evidence rows each. Postgres is free to return either on `count desc` with no secondary key, and four ticks a Friday meant one tick capping under adult A's hash and the next sending under adult B's. The default recipient is now resolved once, with a total order, and persisted.
- A co-parent removed from the family. His `auth.users` row survives and `family_members` cascades only from `families` and `auth.users`, so nothing deleted his recipient row. The composite FK to `family_members (user_id, family_id)` makes revoking membership revoke the letters, and email is unrecallable so this must be structural.
- A fallback recipient (families.email, no member row). `member_user_id` is null, MATCH SIMPLE skips the composite FK, and the row correctly survives every membership change.
- A quiet week whose three slots are all October restatements. The subject set switches on `anyThisWeek`, the closing switches to `templateClosingStillTrue` or the neutral line, and any piece containing 'this week' is rejected.
- A depth-3 implied ability picked as the peak. Its `observedWeekday` is null and the old fallback closing rendered the literal string 'null' into an inbox. Peak legality now requires a non-null `observedOn`.
- A girl whose mother has said 'she' for a year, in a week where all three selected quotes are null. The pronoun flag now comes from her full quote corpus, so it does not flip to they/them and back with the slot lottery.
- The one gendering quote is 'she finally read it to Ben'. Hygiene nulls it for the sibling name, but the corpus already settled the pronoun, so the model writes 'she' legally instead of failing the whole letter into unexplained silence.
- A fourth consecutive quiet week with `consecutiveDeepWeeks` at 3. That integer never enters the model payload, so `allowedNumbersFrom` never legalizes the digit, and the elapsed-time rule rejects 'quiet for 3 weeks' independently.
- Item ids and raw ISO timestamps in the payload. Both carry digits that are not parent-facing and both widened the gate's allow-list. Both live in `LetterControl` and never reach a prompt.
- A worry subject where nothing moved. The honest slow answer is the point, but it is pinned to slot 2, never slot 1, so a celebration email never opens with a deficit sentence about the subject keeping her awake, and never sits adjacent to the closing.
- A worry subject with fewer than two mastered nodes. `templateWorrySlow` renders the one-statement form rather than an ungrammatical sentence, and 'what is under him' never names something she said he could not do.
- A worry subject with no candidate at any depth. The rail does not fire and the cadence counter does not reset, so it fires the moment there is anything true. A manufactured worry sentence is worse than a late one.
- A mother replying 'we're pretty slammed this month, maybe later' to an offer. Without the signed reply address and the RFC message id, this classifies as 'answered', the loop is never resolved, and Homa attaches an offer every Friday forever. Both binding paths are wired before the loop opens.
- An unanswered offer loop that simply expires. Counted as 'no accept' toward the stop rule, never recorded as a decline: deciding that silence meant no is a judgment code does not get to make.
- A mother replying 'yes please, monthly' to the cadence offer. `families.celebration_letter_cadence` and `set_celebration_letter_preference` exist, so the reply becomes a real change instead of another weekly letter.
- A four-hour delivery window against a five-per-tick ceiling and a fleet concentrated on Friday 09:00. Under the old fixed `(familyCreatedAt, familyId)` ordering the same newest families were starved every week, forever, under a reason that reads as downtime. Longest-wait ordering, a ceiling of 12, and a distinct `burst_deferred` reason.
- The compose call throws mid-flight. The row stays composing; the reaper's cutoff is 30 minutes, not 2 hours, so the retry lands inside the 4-hour window rather than at its edge. Two failures in a week stop further attempts.
- Two overlapping cron ticks. The partial unique index is the outbox; `claimLetterWeek` returns null on the loser and no second email is sent.
- The `email_sends` ledger write fails (it is best-effort by law and swallows errors). The cap also reads `celebration_letters.delivered_at`, written on the non-best-effort path.
- A child deleted between plan and send. The composite children FK is on delete cascade, so `claimLetterWeek` fails and the letter is skipped rather than sent about a child who is gone.
- A DST spring-forward day where the configured letter hour does not exist locally. `families.celebration_letter_hour` is constrained to 7..16, outside the ambiguous window, and `localIsoWeekStart` resolves midnight with the same two-pass offset correction `nextLocalHourInstant` uses.
- Evidence stored at Tuesday 23:30 local is Wednesday in UTC. Every weekday and date label is computed with `localDateKey` in the family's zone.
- A child whose name equals a sibling's name, or is a common word (Story, May, Bell). The gate context drops any sibling name equal to childName; the sibling check is word-boundary and case-insensitive.
- A letter whose three items all sit in one subject. Allowed and honest; no subject-line template implies breadth.
- A remembered ritual form that is stale (poetry teatime stopped in March). Depth-6 facts carry `rememberedOn`, so the sentence names the date and the recall is correctable in one sentence.
- An offer proposed in a week where a hold ran in the previous seven days. `heldWithinLastWeek` suppresses it; a ritual offer landing three days after a mother said something painful is the worst timing this system can produce.

## Risks and rejected objections

- REJECTED, with reason: the objection that `reapStaleComposingLetters` must DELETE the stale row rather than update it. Once the outbox index is partial on `status in ('composing','sent')`, flipping a stale row to 'failed' removes it from the index and the retry claims cleanly, so the delete buys nothing. It costs the only durable record that a compose crashed, which is the row the founder console needs to distinguish a gateway outage from a family who was never eligible. I did accept the objection's other half: the 2-hour cutoff was two thirds of the delivery window and is now 30 minutes.
- REJECTED, with reason: the objection's proposed outbox key `(child_id, iso_year, iso_week)`. It fixes recipient churn by making a second recipient structurally impossible, which silently deletes the opted-in second adult's letter, the exact capability D5 exists to permit and spec R6 states outright. The churn is real and is fixed at its cause instead: the recipient is resolved once with a total order and persisted in `celebration_letter_recipients`, and the key uses that stable `recipient_id` rather than a freshly-derived email hash.
- REJECTED as worded, with reason: the objection that `letterOffersSuppressed` should count an unresolved loop older than its expiry as a DECLINE. Recording that an unanswered email meant 'no' is code deciding what a parent meant, which is the judgment side of the models-judge-code-verifies law and belongs to a model with verification, not to a timer. The effect the objection wants is right and is implemented under an honest name: the stop rule fires when the last three letter loops produced no `resolved_outcome = 'accepted'`, counting an expired loop as the absence of an accept, which is a fact rather than an inference.
- PARTIALLY REJECTED, with reason: the objection that the closed window be enforced for every proactive path via a `withinProactiveWindow` guard called from the task claim path in apps/web/lib/tasks/store.ts. The shared pure guard ships here (apps/web/lib/celebration/window.ts) and the letter uses it. Wiring it into the live task claim path changes when journal prompts and morning briefs are allowed to fire for every family in production, which is a behavior change to a live sending system with its own blast radius and its own verification; it does not belong as a side effect of the letter's ticket. This tranche enforces the closed window for the letter only, and that is a deliberate, named deferral rather than a claim that spec line 126 is satisfied.
- PARTIALLY REJECTED, with reason: the objection that each slot's `slot`/`depth` integers be replaced with positional array order and a string tag. `depth` is pure bookkeeping and is gone from the model payload. `slot` stays an integer, because the model's structured output must name a slot for the peak pick and code must verify slot cover against it; positional order cannot express 'the peak is the second one'. The residual leak (digits 1 to 3 in allowedNumbers) is closed directly by the new elapsed-time rule, which is what actually caught 'quiet for 3 weeks' in the objection's own scenario.
- The per-change dated chart history that spec R6 rung 2 and R4 assume does NOT exist. `progress-signal-capture-v2` is a founder ruling (docs/homa-planning/journeys/10-reconciliation.md:171) and the newest migration is supabase/migrations/20260720120000_email_suppressions.sql. Movement is derived here from the evidence ledger read through `resolveEffectiveProgressEvidence`, honoring open conflicts, supersession and resolved-conflict overrides exactly as the Progress page does. When the chart history lands, depth 2's source should MOVE to it rather than be duplicated.
- The distress classifier that writes `family_proactive_holds` is specified here but not built here. Until it ships the hold table is always empty and the hard-day hold is inert, which means a mother who said something painful on Wednesday still gets her Friday letter. These two should land in the same release, and the letter's flag should stay off until they do.
- `conversation_open_loops` is reused as the offer ledger but `conversation_offer_fulfillments` is NOT: its reservation query is hard-bound to `r.kind = 'morning_brief'` on a joined homa_task_runs row (apps/web/lib/conversation-continuity/offer-fulfillment.ts:71). The spec names `conversation.offer_fulfilled` explicitly. Widening that funnel touches a live brief query and should be its own decision.
- The letter writes a `conversation_deliveries` row with `task_run_id` null. I verified the column is nullable (supabase/migrations/20260711143707_conversation_continuity.sql:117) and that the admin brief funnel inner-joins homa_task_runs (apps/web/lib/admin/overview-data.ts:226-231) so null rows cannot appear there. I did NOT audit every other reader of `conversation_deliveries`; one that assumes a task run on email deliveries would see an unexpected row.
- Widening the drip's cap query (apps/web/lib/drip/sweep.ts:377-380) touches a live sending system. It can only make the drip quieter, but it changes who gets a nudge in any week a letter went out, and the founder console's drip queue preview will shrink accordingly.
- Renaming `pieceProblem` in packages/core/src/map/narrative-gate.ts is a zero-behavior-change rename, but the gate is exercised at build time by scripts/map-check.mts rather than by a unit test file, so `pnpm check:map` is the real regression signal and must run.
- I did NOT verify the DDL of the planner check-off storage or the clause-pair shape inside `lesson_reviews.insights`. Depth 4 in sources.ts depends on both and needs those columns confirmed before implementation. I did verify `child_progress_conflicts` (supabase/migrations/20260711213330_agent_led_live_progress.sql:461-500) and `child_progress_evidence` (:66-115).
- `MAX_LETTERS_PER_RUN = 12` and the widened 4-hour window are sized against the spec's stated 25 multi-kid production families, not against a measured fleet child count per (zone, hour) cohort. The longest-wait ordering makes starvation self-correcting rather than permanent, but the ceiling should be re-derived from a real query before the flag goes on.
- D5 (per-adult opt-in default) and D6 (worry-rail cadence) are implemented at their recommended values. D6 is a single exported constant. D5 is now structural in `celebration_letter_recipients` including the membership FK, so a reversal to auto-include both adults would need a backfill and a re-read of the revocation path.
- `set_celebration_letter_preference` and the `celebration_letter_cadence` column are new scope added in this revision because the letter's copy promised them. The mute path on the pinned SMS session flips the child's default recipient row rather than the calling adult's, since that session carries no user id; that is stated in the tool result but a founder may want it to refuse instead.
- Cost is one composition per child per week, stated rather than discovered: a four-child family is four calls a week, and the two-failure ceiling caps a bad week at two extra calls per child.
- The measurement instrument (spec 5G: per-child opens over weeks, mute rate, offer decline rate, fallback-depth share, kill conditions) is build-order item 9 and is not in this tranche. The events emitted here are its inputs, but nothing reads them yet, so the letter would ship with no way to see whether it is wallpaper.

## Verified facts (re-verify before building)

- apps/web/lib/child-progress/abilities.ts:97-106 stateForAnswer maps not_yet to state "not_yet"; :163-179 the reported-nodes loop pushes a node for EVERY explicit answer with `observedAt: entry.observedAt`; only the implied loop at :182-196 sets `observedAt: null` (documented at :52-53). So 'any node with a non-null observedAt' includes every not_yet and every correction row.
- apps/web/lib/child-progress/effective-evidence.ts:296 `if (openConflictItems.has(itemId)) continue;` drops open-conflict items entirely; :284 `candidate.evidence.supersededAt !== null` skips superseded rows; :298-329 makes a resolved conflict's chosen row win over anything earlier; :175-198 isLaterEvidence orders by observedAt, then createdAt, then ascii id.
- supabase/migrations/20260711213330_agent_led_live_progress.sql:66-115 child_progress_evidence: answer checked in ('easily','getting_there','not_yet'); source includes 'correction' and 'report_correction'; member_user_id `on delete set null`; quote capped at 500; observed_at not null default now(); supersedes_id and superseded_at at :108-110; the (id, child_id, family_id) identity unique at :113-115 and the children (id, family_id) index at :18-19.
- supabase/migrations/20260711213330_agent_led_live_progress.sql:461-500 child_progress_conflicts carries evidence_id_a, evidence_id_b, state in ('open','resolved'), resolved_answer, resolved_evidence_id, resolved_at, plus a composite child FK; the discarded row of a resolved pair is whichever of a/b is not resolved_evidence_id.
- supabase/migrations/20260704033742_tenancy_v0.sql:15-21 family_members is (family_id, user_id, role, created_at) with PRIMARY KEY (family_id, user_id) and no email column, so `foreign key (member_user_id, family_id) references public.family_members (user_id, family_id)` is available; :23-33 children carries name and birth_month with day always 01 per the comment at :27-29.
- supabase/migrations/20260706061222_family_memory.sql:57-69 family_memories has exactly id, family_id, child_id, kind, content (1..500), source, created_at, updated_at. `grep -rn worry` over apps/web/lib, apps/web/agent, packages and supabase/migrations returns one unrelated prose hit (materials-studio chant-and-rhyme-card.md:88) plus taxonomy content: there is no worry_subject_id column and no worry field anywhere.
- supabase/migrations/20260712210000_founder_console.sql:36-47 email_sends has `created_at timestamptz not null default now()`, stamped at insert; apps/web/lib/map/email.ts:174-199 recordEmailSend is best-effort and swallows failures.
- apps/web/lib/drip/sweep.ts:44 GLOBAL_CAP_MS is 7 days; :110-115 the chooser uses a strict `<` against `now - lastDripSentAt`; :377-380 the cap source is `max(es.created_at) ... where es.kind like 'drip_%'`; :381-388 sentKinds is the once-ever-per-kind guard and :437-448 dripAlreadySent is the final defensive re-check called at :464. The rolling window is safe there only because of those two additional once-ever guards.
- apps/web/lib/drip/sweep.ts:52-60 MAX_SENDS_PER_RUN is 5 with the burst reasoning ('the first live batch was 21 eligible families from a domain that had never sent proactive mail'); :208-243 planDripSends decides eligibility first, then orders by (kind priority, longest wait, family id), then truncates.
- apps/web/lib/map/email.ts:26 REPLY_TO is the fixed 'homa@mail.thankshoma.com'; :266 `reply_to: [args.replyTo ?? REPLY_TO]`; :293-295 a successful submit returns `retrieveProviderMessageId` as a closure over the Resend id; :251 is the compliance-reviewed outer note; :652-661 unsubscribeHeaders always includes mailto and adds one-click only when EMAIL_UNSUBSCRIBE_SECRET is set.
- apps/web/lib/tasks/dispatch-transport.ts:117-119 is the existing signed-reply pattern: `buildSignedReplyAddress(attempt.id, dependencies.inboundSecret)` passed as replyTo on every proactive email send.
- apps/web/lib/conversation-continuity/reply-policy.ts:235-241 binds an explicit delivery id, :243-252 binds on a normalized In-Reply-To against candidate.providerMessageId, and :291-320 is the bare polarity heuristic that is all that remains when neither is available; classifyReplyOutcome('yes_no', text) returning 'answered' makes a yes_no candidate ineligible.
- apps/web/lib/conversation-continuity/delivery-ledger.ts:159-170 beginDeliveryAttempt accepts `taskRunId: string | null`; :313-340 enrichDeliveryAttemptProviderMessageId exists and is exported; :344-383 openReplyLoop inserts the conversation_open_loops row keyed on delivery_id.
- apps/web/lib/conversation-continuity/offer-fulfillment.ts:60-75 the reservation query inner-joins homa_task_runs and requires `r.kind = 'morning_brief'`, so a letter delivery with a null task_run_id can never enter that funnel; apps/web/lib/admin/overview-data.ts:220-232 inner-joins homa_task_runs the same way.
- packages/core/src/map/narrative-gate.ts:62-92 pieceProblem is module-private and checks, in order: empty, over cap, BANNED_WORDS, EM_DASH, negative number, gendered pronoun when not allowed, DIAGNOSIS_SUBSTRINGS, sibling names by word-boundary regex, and any digit run not in allowedNumbers; :127-130 fails the whole generation when the note is rejected or more than 4 subject lines are.
- packages/core/src/map/copy-laws.ts:12 BANNED_WORDS is /\b(behind|delayed?|disorder|diagnos\w*|screening|assessment|percentile)\b/i and does not include 'ahead'; :14 EM_DASH; :16-24 GENDERED_PRONOUNS with the 'a boy named Story was written up as she' incident recorded.
- apps/web/lib/map/narrative-facts.ts:396-399 allowedNumbersFrom derives the allow-list from `JSON.stringify(facts).match(/\d+/g)`, so any integer anywhere in the payload becomes a permitted digit run; :404-414 genderedPronounsAllowedFrom tests the whole parent-words block (whatsWorking values plus helpWith), not a selection.
- apps/web/lib/map/narrative-generate.ts:43-47 the report system prompt is read from disk with readFileSync at path.join(process.cwd(), 'agent', 'report-writer.md') and cached; :53-114 is the generateObject call shape including disallowPromptTraining and gatewayAttribution.
- apps/web/lib/tasks/time.ts exports exactly nextLocalHourInstant (:12), nextTaskRunInstant (:74), localDateKey (:93) and localHourOf (:105). `zonedDateParts` is NOT exported from this module: it lives at apps/web/lib/time-zone.ts:16 and tasks/time.ts imports it at :1. The earlier draft cited it from the wrong file.
- apps/web/lib/tasks/store.ts:273-280 withinDeliveryWindow is `hour >= task.localHour && hour < task.localHour + window` with null windows always passing; :1135 the stale-run reaper cutoff is 2 hours.
- apps/web/lib/tasks/kinds.ts:56-59 carries the incident comment verbatim ('three real families got 11pm journal emails from leftover rows') with deliveryWindowHours 3 at :60.
- apps/web/vercel.json declares a single cron, `/api/map/cron` on `0 * * * *`, so the sweep runs hourly and a 4-hour window is at most four ticks.
- supabase/migrations/20260709230000_gateway_groundwork.sql:19 adds families.journal_opt_out_at, the only email cadence control that exists; 20260708233000_family_time_zone.sql:16 adds families.time_zone; 20260714210000_sandbox_families.sql:15 adds families.sandbox.
- supabase/migrations/20260709121000_conversation_messages.sql:32-33 content is checked between 1 and 8000 chars and :36 is unique (session_id, sequence); supabase/migrations/20260711143707_conversation_continuity.sql:117 conversation_deliveries.task_run_id is nullable.
- supabase/migrations/20260720120000_email_suppressions.sql:16 scope is checked in ('drip','all'); apps/web/lib/email/suppression.ts:79-94 suppressedHashesForDrip batches over both blocking scopes and fails open to an empty set.
- apps/web/agent/tools/remember.ts:20-36 is the inputSchema (content, kind, childId) this tranche extends; :38-60 shows the resolveAgentAccess / pinned-path shape the new preference tool copies. packages/core/src/map/content.ts:188 exports MAP_SUBJECTS, the catalog the worry subject id verifies against.
- package.json:10-16 defines check:child-progress, check:events, check:map and check:progress-ui; :38-39 wires child-progress:e2e to scripts/child-progress-postgres-test.mts, the disposable-cluster harness the new celebration:e2e copies.
- docs/homa-planning/plans/2026-07-22-celebration-system.md:126 requires the closed window 'enforced at the delivery layer'; the R6 structure block requires exactly three items, peak last, the named-worry rail, per-adult opt-in and the two existing fences; 5B line 332 bans 'no elapsed time, no count of quiet weeks'; 5E states the second-adult harm; 6 lists the Friday letter as build-order item 6 with items 1 to 5 as its prerequisites.
- The newest migration in supabase/migrations is 20260720120000_email_suppressions.sql; nothing implements progress-signal-capture-v2's per-change chart history, which docs/homa-planning/journeys/10-reconciliation.md:171 records as ruled 2026-07-21.

## Objections folded in (already reflected above)

### [FATAL] The weekly cap caps the letter against its own previous week's send, so after the first letter every subsequent week is either skipped or drifts an hour later until it dies. `chooseLetterSend` step 14 fires when `now - lastOtherProactiveAt < 7 days`, and `lastOtherProactiveAt` deliberately includes this family's `friday_letter` rows from PRIOR ISO weeks (the plan's own eligibility.test case: "a letter sent 6 days ago in the previous ISO week records weekly_cap"). A weekly beat sent at the same family-local hour is always 7 days minus epsilon apart, never 7 days plus.

**Evidence.** The cap arithmetic is copied from apps/web/lib/drip/sweep.ts:44 (`GLOBAL_CAP_MS = 7 * 24 * 60 * 60 * 1000`) and :111-112 (strict `<`), which is only safe there because every drip kind is additionally once-ever (sweep.ts:381-388 `sentKinds`, :440 `dripAlreadySent`). A recurring beat has no such second guard. Concrete: week N, the tick at 16:00 UTC (09:00 local) sends; `email_sends.created_at` defaults to `now()` at insert (supabase/migrations/20260712210000_founder_console.sql:43, written by recordEmailSend at apps/web/lib/map/email.ts:174-197) i.e. ~15s after the sweep's `now`, because compose + Resend POST run first. Week N+1, the 16:00 UTC tick has `now - created_at = 604800000 - 15000 < 7 days` -> `weekly_cap`. Because that named reason writes a skipped row through the same unique index (child_id, recipient_email_hash, iso_year, iso_week), `claimLetterWeek` at 17:00 hits `on conflict do nothing` and returns null. Result: exactly one letter per child, ever. Even if the skip row were not written, the letter slides to 10:00, then 11:00, then at 12:00 trips eligibility step 11 (`localHour >= letterLocalHour + LETTER_DELIVERY_WINDOW_HOURS`, 9+3) and records `stale_window`.

**Fix.** Cap on the ISO week identity, not an elapsed-milliseconds window: exclude every `friday_letter` row belonging to THIS child's own beat and compare `lastOtherProactiveAt` against the start of the current family-local ISO week rather than `now - 7d`. The drip cap and the letter cap are different questions and must not share one predicate. Add a sweep test that runs 8 consecutive weekly ticks over a fake clock and asserts 8 sends.

### [FATAL] Depth 7 and the three-ability eligibility floor both count `not_yet` and `getting_there` nodes as datable receipts, and the depth-7 template asserts they are still true. A parent who corrects Homa gets that exact correction read back to her the following Friday as a win.

**Evidence.** apps/web/lib/child-progress/abilities.ts:163-179 pushes a node for EVERY explicit answer with `observedAt: entry.observedAt`; `stateForAnswer` (:97-106) maps `not_yet` -> state "not_yet", and only the implied loop sets `observedAt: null` (:193). So "a node with a non-null observedAt" (the plan's sources.ts depth 7, and its eligibility fence 7 `datedAbilityCount`) includes every `not_yet` row. The correction path writes exactly such a row: `source in (... 'correction', 'report_correction' ...)` with `answer` in ('easily','getting_there','not_yet') (supabase/migrations/20260711213330_agent_led_live_progress.sql:66-86), which is spec section 5E's "He cannot actually do that" flow. Nothing in the plan filters it: verify.ts uses `answer` only for peak legality (check 2), and copy.ts renders depth 7 as `${statement}. You told me that on ${observedOn}, and it is still true.` Failing scenario: Wednesday the mother says "he cannot actually do that"; Friday's quiet-week letter says "Nora multiplies two-digit numbers. You told me that on 14 March, and it is still true." The plan's own claim that the fallback chain "cannot run dry" rests on this same set, so a child with three `not_yet` rows passes the floor and receives three fabrications.

**Fix.** Restrict the dated-ability floor and every depth-7 candidate to nodes whose state is `mastered` (and, if the spec wants it, `emerging` with its own honest phrasing). Re-derive the floor guarantee: if `masteredWithDate < 3` the letter does not fire. Add slots.test cases: a child whose only dated nodes are `not_yet` is ineligible; a corrected item never appears at any depth.

### [SERIOUS] The depth-2 movement rung reads the raw evidence ledger and explicitly includes superseded rows, bypassing the three mechanisms that decide what is currently true. It will celebrate a transition the parent has already retracted or disputed.

**Evidence.** apps/web/lib/child-progress/effective-evidence.ts:296 `if (openConflictItems.has(itemId)) continue;` drops any item under an open conflict from effective evidence, and :284 `if (candidate.evidence.supersededAt !== null) continue;` drops superseded rows; :298-329 makes a resolved conflict's chosen row win over anything earlier. Every other rung in the plan goes through `resolveEffectiveProgressEvidence` -> `deriveAbilityMap` and inherits all three. The plan's sources.ts depth 2 instead says: "Group non-superseded AND superseded rows by item_id ordered by observed_at, then created_at, then id ... emit a transition where consecutive answers go not_yet -> getting_there or getting_there -> easily." Failing scenario: Monday the mother reports `getting_there`, Tuesday `easily`; Wednesday she corrects it and the correction opens a `child_progress_conflicts` row (state 'open', migration 20260711213330_agent_led_live_progress.sql:461-469). The abilities map goes dark for that item, the Progress page shows nothing, and Friday's letter still says "and by Tuesday it was working" because the raw scan never looked at the conflicts table. Same for a superseded pair: the retracted row is the one the plan deliberately keeps.

**Fix.** Derive movement from the same resolved set everything else uses: load conflicts alongside evidence, exclude `openConflicts` item ids and any row with `superseded_at is not null`, and apply the resolved-conflict override before pairing. If the risk section's point stands that the per-change chart history is not built yet, that is an argument for deferring rung 2, not for a second and looser truth path.

### [SERIOUS] `recordProactiveHold` compounds instead of extending. The stated SQL adds a full 72 hours on top of whatever remains, so a mother having a hard week is silenced for weeks, not three days.

**Evidence.** The plan's hold.ts specifies `expires_at = greatest(coalesce(existing.expires_at, $now), $now) + interval '72 hours'`. The `+ interval '72 hours'` is applied AFTER the `greatest`, so with an existing expiry at now+71h a second distress message sets now+143h. Five messages over one bad week gives roughly 15 days of suppressed letters, ready-nexts and share offers. The plan's own hold.test case ("a second hold 1 hour later extends expires_at and never shortens it") passes on the buggy formula, so the test cannot catch it. This also silently breaks `heldWithinLastWeek` (`expires_at > $now - interval '7 days'`), whose "the week a hold ran" semantics assume a bounded 72-hour hold.

**Fix.** `expires_at = greatest(coalesce(existing.expires_at, $now), $now + interval '72 hours')` and keep `started_at` on first write. Replace the test with one that asserts an exact instant: hold at T, second hold at T+1h, expires_at is T+73h, not T+144h.

### [SERIOUS] The outbox unique index doubles as the skip and failure ledger, so any named-reason skip written earlier in the ISO week permanently silences that week. The plan's stated reaper recovery does not work.

**Evidence.** The migration creates one unique index `(child_id, recipient_email_hash, iso_year, iso_week)` with no status predicate, and both `claimLetterWeek` and `recordLetterSkipped` insert through it with `on conflict do nothing`; a null return is read as "another tick owns this week" and the sweep moves on with no event. The sweep also "records a skipped row for candidates the chooser rejected with a NAMED reason even when they were not planned", hourly. Failing scenario: Monday 02:00 local, a child has 2 dated abilities -> eligibility step 7 writes `too_few_dated_abilities` for ISO week W. Wednesday the mother reports three abilities. Friday 09:00 the chooser returns send:true, `claimLetterWeek` conflicts with Monday's row, returns null, and the child gets nothing, with no event to explain it. Same shape for `no_email` (she adds an address mid-week), `suppressed`/`opted_out` (she replies "start"), and `weekly_cap`. Separately, the plan's edge case asserts "the 2-hour reaper flips it to failed so the next tick can retry inside the same delivery window": `reapStaleComposingLetters` only UPDATEs status to 'failed' and leaves the row, so the retry insert still conflicts and returns null; and 2 hours of waiting already exceeds two thirds of the 3-hour LETTER_DELIVERY_WINDOW_HOURS.

**Fix.** Make the unique index partial on the states that must not repeat (`where status in ('composing','sent')`), and let skipped/failed rows accumulate as an append-only ledger with their own non-unique index. Then have the reaper DELETE, not update, the stale `composing` row (recording the failure as a separate skipped row), and shorten its cutoff below the delivery window. Add a store test: a `too_few_dated_abilities` row on Monday does not block a Friday claim.

### [SERIOUS] The default recipient is resolved fresh on every tick from a non-deterministic query with no tiebreak and is never persisted, so recipient churn sends two letters about one child in one week and can silently deliver unrequested celebration to the co-parent the opt-in law exists to protect.

**Evidence.** The plan's `resolveLetterRecipients` picks "the adult with the most `child_progress_evidence` rows for this child in the last 90 days whose `member_user_id` is non-null" with no stated tiebreak and no stored choice, and the outbox unique key includes `recipient_email_hash`, so a different adult is a different key and claims cleanly. Two adults on one family tie at 12 rows each: Postgres may return either on `order by count desc` with no secondary key, and the 3-hour window gives up to three ticks per Friday. Tick one records `weekly_cap` for adult A's hash, tick two resolves to adult B's hash, claims, and sends. That is exactly the harm spec section 5E "The second adult" and open decision D5 are about: "A skeptical co-parent receiving unrequested celebration about a child he thinks should be in school is a harm Homa would have caused." The plan asserts "A second adult appears only via a `celebration_letter_recipients` row with `state='opted_in'`", which the default resolver quietly contradicts. It also breaks the plan's own weekly-cap intent, since `lastOtherProactiveAt` excludes friday_letter rows from the current ISO week and so cannot catch the duplicate.

**Fix.** Persist the chosen recipient once, per (child, family), in `celebration_letter_recipients` with `state='opted_in'` at first resolution, and read from that table on every subsequent tick. Never re-derive. Give the first-time resolution a total order (`count desc, evidence.created_at asc, member_user_id asc`). Make the outbox key `(child_id, iso_year, iso_week)` so no recipient change can mint a second letter for the same child-week.

### [FATAL] The letter's own fallback copy asserts "this week" over content that is months old, and breaks outright when the peak is an implied ability. `templateClosing(peak)` is defined as "The thing to hold onto from this week is ${peak.observedWeekday}. ${peak.statement}." with no depth guard and no null guard, and `LETTER_SUBJECTS` are all unconditional ("Three things ${n} did this week", "Three from ${n}'s week") with no quiet-week variant. verify.ts checks percentages, denominators, streaks, "finally" and "ahead", but has no rule tying a "this week" claim to a date inside this week. This is the spec's one law inverted: the receipt names something that did not happen when it says it happened.

**Evidence.** Plan copy.ts (templateClosing, LETTER_SUBJECTS) + plan slots.ts step d, which routes a quiet week entirely to depth 7. Concrete family: the 5B mother, quiet week, three depth-7 restatements from an onboarding walk last October. Her subject line reads "Three things Story did this week" and the closing reads "The thing to hold onto from this week is Tuesday. Story counts past twenty." Nothing in that letter happened this week and no October date is printed, so "Tuesday" reads as two days ago. Second scenario: depth 3 (a newly implied ability) is a legal peak under verify.ts rule 2 (answer is null, not `not_yet`; fromFrustratedSegment false), and plan facts.ts states depth-3 candidates carry `observedAt: null`, so `observedWeekday` is null and the fallback closing renders "The thing to hold onto from this week is null." into a parent's inbox.

**Fix.** Make recency a typed property of the slot, not an assumption of the string. Add `withinLetterWeek: boolean` to LetterSlotFact, set from the same local-week window depth 1/2/4 use. Then: (a) split templateClosing into `templateClosingThisWeek(peak)` (only legal when peak.withinLetterWeek) and `templateClosingStillTrue(peak)` -> `The thing to hold onto is still true: ${peak.statement}. You told me that on ${peak.observedOn}.`; (b) require observedOn non-null for any closing that names a date, else NEUTRAL_CLOSING; (c) add a quiet-week subject set (`How ${n}'s week looked`, `${n}'s week`) selected on facts.quietWeek; (d) add a verify.ts piece rule: if a piece contains /\bthis week\b/i, at least one slot with withinLetterWeek must exist, and if the piece is the closing it must be the peak's own recency. Add tests: a quiet-week letter never prints "this week" as a claim about a depth-7 item; a depth-3 peak never renders a null weekday.

### [FATAL] Named-reason skip rows and the send claim share one unique index, so a skip recorded earlier in the same ISO week permanently blocks that week's letter. `recordLetterSkipped` inserts a row with the same (child_id, recipient_email_hash, iso_year, iso_week) key that `claimLetterWeek` inserts on, both `on conflict do nothing`, and the eligibility order evaluates `too_new` (6) and `too_few_dated_abilities` (7) BEFORE the weekday (9) and hour (10) gates, so those reasons fire on every hourly tick on every day of the week. The two reasons that legitimately change mid-week are exactly the two that get written on Monday.

**Evidence.** Plan migration `celebration_letters_week_idx on (child_id, recipient_email_hash, iso_year, iso_week)` (no status predicate) + plan store.ts claimLetterWeek/recordLetterSkipped + plan eligibility.ts order 6,7 before 8,9,10 + plan sweep.ts ("Also records a skipped row for candidates the chooser rejected with a NAMED reason even when they were not planned"). Concrete family: signs up Tuesday July 7. Monday July 13, 09:00 tick: 6 days old -> `too_new` row written for ISO week 29. Wednesday she journals and lights the child's third dated ability. Friday July 17, 09:00: chooseLetterSend returns send:true, claimLetterWeek conflicts with the Monday row, returns null, sweep reads that as "another tick owns this week" and sends nothing. Her first letter, the one whose copy says "This is the first of these", silently does not arrive, and /admin shows reason `too_new` for a family that is ten days old. Same mechanism for `too_few_dated_abilities` on any child who crosses the three-ability floor mid-week, and for `weekly_cap` (rule 14, strict `< 7 days`) whenever a burst-cap deferral pushed last week's send an hour later than this week's evaluation hour, which alternates the family into every-other-week silence.

**Fix.** Split the outbox key from the skip ledger. Make the unique index partial: `create unique index celebration_letters_week_idx on public.celebration_letters (child_id, recipient_email_hash, iso_year, iso_week) where status in ('composing','sent')`, and let skipped/failed rows accumulate freely (drop them from the uniqueness, keep them for the console). Separately, move checks 2,3,4,6,7 to AFTER the weekday and hour gates so no named reason is ever recorded on a day the letter was never due, and make `alreadyWrittenThisWeek` read only status in ('composing','sent'). Add eligibility tests: a too_new row written Monday does not block Friday's send; a too_few row written Monday does not block Friday after the third ability lands; weekly_cap uses a family-local day boundary rather than a rolling 168 hours.

### [SERIOUS] Two of the letter's parent-facing strings promise controls this tranche does not build. `CADENCE_OFFER` says "If you would rather these came monthly for a while, say the word" and `weekdayAnnouncement` says "Say the word and I will move it", but there is no monthly mode anywhere in the design (celebration_letter_weekday is constrained 1..5, there is no cadence column, and the only existing email cadence control in the product is the binary journal_opt_out_at) and there is no writer, tool, or UI for celebration_letter_weekday_source='parent'. The plan's own file list contains no agent tool and no route that can honor either sentence.

**Evidence.** Plan copy.ts (CADENCE_OFFER, weekdayAnnouncement) and plan migration (families.celebration_letter_weekday smallint check between 1 and 5; celebration_letter_weekday_source check in ('derived','parent') with no writer named in any file in the tranche). The only cadence control that exists: supabase/migrations/20260709230000_gateway_groundwork.sql:19 `journal_opt_out_at`, an all-or-nothing STOP applied at apps/web/agent/channels/email.ts:222 via optOutIntent. Concrete family: the 5B mother, three consecutive weeks at fallback depth 5 or greater, receives DEEP_STRETCH_OPENING plus CADENCE_OFFER. She replies "yes please, monthly". The reply becomes an agent turn with no tool to change anything; seven days later she gets another weekly letter. The one control the product offered a depleted mother, at the exact moment it admitted the letters were thin, does not work.

**Fix.** Either build the write path in this tranche or cut the strings. Minimum build: add `celebration_letter_cadence text not null default 'weekly' check in ('weekly','monthly')` to families in the same additive migration; add one narrow tool `set_celebration_letter_cadence({ childId?: string|null, cadence, weekday? })` that re-scopes inside the authenticated family and writes source='parent'; have eligibility skip a monthly family in any ISO week that is not the first of the month. If that is out of scope, delete CADENCE_OFFER and replace weekdayAnnouncement with a sentence naming a control that exists ("These come on Thursday. Reply STOP any time and they end."), and note in the plan that the cadence offer is blocked on that tool.

### [SERIOUS] `genderedPronounsAllowed` is derived from the three selected slot quotes, so a child's pronoun in her own letter flips week to week with the slot lottery, and a single hygiene-nulled quote can suppress the whole letter. The plan computes the flag from "the slot quotes plus worry.parentWords ONLY", and the same module nulls a quote when it names a sibling, contains a diagnosis substring, or exceeds 240 characters, and states that most walk rows carry no quote at all.

**Evidence.** Plan facts.ts (letterGateContext genderedPronounsAllowed derivation + QUOTE HYGIENE paragraph), against the gate it feeds: packages/core/src/map/narrative-gate.ts:70-72 rejects any piece containing he/him/his/she/her when the flag is false, and packages/core/src/map/copy-laws.ts:16-24 records why the law exists (a boy named Story written up as "she"). The report path this copies derives the flag from the whole parent-words block, not a three-item selection: apps/web/lib/map/narrative-facts.ts:408-414 reads whatsWorking plus helpWith. Concrete family: a girl whose mother has said "she" for a year, but whose depth-7 quiet-week slots are three map-walk rows with `quote` null. genderedPronounsAllowed is false, the letter is written in they/them, and the following week one quoted row lands in a slot and the letter says "she" again. Second scenario, the same family: the one quote that genders her is "she finally read it to Ben" (Ben is the sibling), which hygiene nulls; the model writes "she" in two sentences, verify.ts rule 7 fails the whole letter, `celebration.letter_gate_failed` fires, nothing is sent, and by design "the next letter says nothing about the gap". She gets silence and never learns why.

**Fix.** Derive the flag once per child from the child's full quote corpus, not from the three selected slots: add `loadChildParentWords(familyId, childId)` in sources.ts returning every non-null `quote` on this child's effective evidence rows plus any stored worry words, and compute `genderedPronounsAllowed = GENDERED_PRONOUNS.test(joined)` over that. Run the hygiene filters only on the quotes that reach the payload, never on the corpus that settles the pronoun. Add facts.test.ts cases: the flag is stable across two consecutive weeks whose slots differ; a quote nulled for naming a sibling does not flip the flag; a child with zero quotes anywhere is they/them.

### [SERIOUS] The model-visible facts payload carries the letter's own internal integers, so the gate's allow-list admits every digit from 1 to 7 in every letter, and verify.ts has no elapsed-time rule. LetterFacts includes `fallbackDepth: number` and `consecutiveDeepWeeks: number`, and each slot carries `slot: 1|2|3` and `depth: SlotDepth`. `allowedNumbersFrom` derives the whitelist from JSON.stringify of that payload, so those become permitted digits, and the plan's accounting deny list covers only "nothing happened", "no activity", "since we/you last", "still waiting/nothing" and "it's N".

**Evidence.** Plan facts.ts (LetterFacts fields) + plan compose.ts (prompt is `"<facts>" + JSON.stringify(facts)`) + plan verify.ts rule 3, against apps/web/lib/map/narrative-facts.ts:397-399 `allowedNumbersFrom` and packages/core/src/map/narrative-gate.ts:86-90, which is the only numeric control. Concrete family: the 5B mother, fourth consecutive quiet week, consecutiveDeepWeeks = 3. The model, handed that field, writes "These have been quiet for 3 weeks, and quiet stretches are normal." "3" is in allowedNumbers because consecutiveDeepWeeks put it there; no BANNED_WORD, no em dash, no percentage, no denominator, "weeks in a row" does not appear so the streak rule misses it, and no accounting phrase matches. It ships. Spec line 332 bans exactly this: "no elapsed time, no count of quiet weeks."

**Fix.** Do not hand the model its own bookkeeping. Split the payload: `LetterFacts` (model-visible, slot content only) and `LetterControl` (fallbackDepth, consecutiveDeepWeeks, depths, isoWeek), passing only the former to compose.ts and to allowedNumbersFrom; the opening selection already happens in code, so consecutiveDeepWeeks never needs to be in the prompt. Replace each slot's `slot`/`depth` integers with positional array order and a string tag. Then add a verify.ts piece rule for elapsed-time accounting: /\b\d+\s*(?:weeks?|months?|days?)\b/i and /\b(?:few|several|couple of)\s+weeks\b/i reject the piece. Add verify.test.ts cases: "quiet for 3 weeks" rejects; "These have been quiet for a stretch" (the approved copy) passes.

### [SERIOUS] The named-worry rail is selected before the other slots and the plan never pins its slot index, so the natural implementation puts the honest slow answer in slot 1. Render then emits it as the first body line, under a subject that promises three things the child did.

**Evidence.** Plan slots.ts step a ("Worry rail first") returns `worryRailSlot: 1 | 2 | 3` with no rule fixing the value; step b fills "remaining slots"; render.ts emits `[...nonPeakInSlotOrder, peakSentence]`, so a non-peak slot-1 rail is line one. Concrete family: the 5A mother whose named worry is reading, in a week where reading did not move. Subject: "Three things Sam did this week". First line after "Here is Sam's week.": "Reading did not move this week. What is under Sam is still under Sam." She opens a celebration email and the first item is a thing her son did not do, which is a verdict on the subject keeping her awake, delivered before any receipt. Spec 5A puts the rail in the letter to stop Homa changing the subject, not to lead with the deficit.

**Fix.** Pin the rail's position in slots.ts: `worryRailSlot` is 2 when the rail's candidate is the honest slow answer (depth 7 in the worry subject, or any candidate with `answer === 'not_yet'`), and may be 1 or 2 otherwise; never 3, so it is never adjacent to the closing. Assert it in `assertThreeSlots`. Add slots.test.ts cases: an honest-slow-answer rail is never slot 1; a moving rail may be slot 1; the rail is never slot 3.

### [SERIOUS] A declined letter offer will usually not be recorded, so the two-declines-and-stop rule can never fire. `openLetterOfferLoop` finishes the delivery attempt with the Resend submission id and sends the email through map/email's `submit()`, which falls back to the fixed reply address. That disables both deterministic reply-binding paths, leaving only the bare yes/no heuristic, and `letterOffersSuppressed` requires two recorded declines.

**Evidence.** apps/web/lib/map/email.ts:266 `reply_to: [args.replyTo ?? REPLY_TO]` with REPLY_TO fixed at :26, and the plan's submitFridayLetter passes no replyTo, so the explicit-delivery path is unavailable (the proactive pattern is apps/web/lib/tasks/dispatch-transport.ts:117-119, buildSignedReplyAddress(attempt.id)). The In-Reply-To path at apps/web/lib/conversation-continuity/reply-policy.ts:243-252 matches against `candidate.providerMessageId`, the RFC id, which map/email exposes only via the returned `retrieveProviderMessageId` closure (apps/web/lib/map/email.ts:293-295); the plan stores `providerSubmissionId` and never calls it or `enrichDeliveryAttemptProviderMessageId`. What is left is the polarity heuristic at reply-policy.ts:291-320. Concrete family: the mother who replies "we're pretty slammed this month, maybe later" to the dinner-question offer. classifyReplyOutcome returns "answered", the yes_no candidate is not eligible, `resolved_outcome` is never written, the decline is not counted. She writes a version of that sentence every Friday and Homa attaches an offer every Friday forever, and OFFER_STOP_LINE never renders. Spec R6 line 124 promises the opposite.

**Fix.** Bind the reply before the loop is opened. In sweep.ts, when the letter carries an offer, create the delivery attempt FIRST, pass `replyTo: buildSignedReplyAddress(attempt.id, process.env.RESEND_INBOUND_SECRET)` through submitFridayLetter into submit(), then finish the attempt and call `enrichDeliveryAttemptProviderMessageId` with the RFC id from `retrieveProviderMessageId()`. Add `replyTo?: string` to submitFridayLetter's signature. Also make `letterOffersSuppressed` fail safe: count an unresolved loop older than its 72-hour expiry as a decline rather than as nothing, so silence stops the offers instead of perpetuating them. Test: a prose decline resolves the loop; three unanswered loops suppress offers and render OFFER_STOP_LINE once.

### [FATAL] The three-item letter can celebrate an ability the mother explicitly said her child CANNOT do. `deriveAbilityMap` pushes a node for every explicit answer, including `not_yet`, with a non-null `observedAt` (apps/web/lib/child-progress/abilities.ts:162-178, state from :97-106). The plan defines depth-7 candidates as "any node with a non-null observedAt" (sources.ts detail) and defines the eligibility floor as "abilities with a NON-NULL observedAt" (eligibility.ts step 7). Nothing filters by state. `verifyLetterDraft` check 2 guards `answer !== "not_yet"` for the PEAK SLOT ONLY, and explicitly permits not_yet in the other two slots; the letter-writer prompt's "a slot whose answer is not_yet names what is under the child now" is prose, not code. This is also why the "cannot run dry" proof (slots.ts step d) is invalid: it counts a different population than depth 7 draws from, and the loader is claimed to compute `datedAbilityCount` inside one SQL signals query, which cannot run `deriveAbilityMap`'s graph closure at all.

**Evidence.** apps/web/lib/child-progress/abilities.ts:162-178 and :97-106. Scenario: on March 3 a mother reports "he can't borrow across a zero yet"; the row lands as answer `not_yet`, observed_at 2026-03-03. That is 1 of her 3 dated rows, so eligibility step 7 passes. In a quiet week depth 7 fills a slot with that node and `templateSentenceFor` (copy.ts, depth 7) renders: "Theo borrows across a zero in subtraction. You told me that on March 3, and it is still true." It is not the peak, so check 2 never runs on it. The narrative gate has no concept of answers, so `narrativePieceProblem` passes it. She receives a celebration of the exact thing she told Homa he cannot do. For a child with three `not_yet` rows and nothing else, all three slots are that sentence, every week.

**Fix.** Depth 7 (and depths 1 and 4) must draw only from nodes with `state === "mastered"` or `"emerging"`, never `not_yet`. Make `SlotCandidate.answer` non-nullable for depths 1-4 and 7 and have `assertThreeSlots` reject any slot whose answer is `not_yet` outside the worry rail's honest-slow-answer branch, which must use its own copy shape (`templateWorrySlow`) rather than `templateSentenceFor`. Change the eligibility floor to `datedConfirmedAbilityCount`, computed from `deriveAbilityMap` over resolved effective evidence per child, not from a SQL count of evidence rows, and state in the plan that the signals loader therefore runs the derivation per child rather than one flat query.

### [FATAL] `celebration_letter_recipients` binds `member_user_id` to `auth.users(id)` only. There is no FK, no composite key, and no check tying that user to `family_id`, and the plan names no writer and no re-scoping for it, while asserting "Per-child mute that cannot touch the other adult's rows is structural here, not a query convention." `family_members` PK is (family_id, user_id) (supabase/migrations/20260704033742_tenancy_v0.sql:15-21), so the composite FK the rest of the migration uses everywhere else was available and was not used here. `resolveLetterRecipients` then joins `auth.users` for the address and `submitFridayLetter` emails the child's first name, dated evidence, and the mother's verbatim quotes.

**Evidence.** Plan migration table 2 vs supabase/migrations/20260704033742_tenancy_v0.sql:15-21. Scenario needing no writer bug at all: a co-parent opts in, then leaves and his `family_members` row is deleted (a separation, a removed helper). `family_members` cascades only from `families` and `auth.users`; nothing deletes his `celebration_letter_recipients` row, and his `auth.users` row still exists. `resolveLetterRecipients` returns him every Friday forever. He keeps receiving weekly letters naming the child and quoting the mother verbatim after being removed from the family. Email is unrecallable. The plan's own departed-adult edge case only covers `child_progress_evidence.member_user_id on delete set null`, which fires on account deletion, not on revoked membership.

**Fix.** Add `foreign key (member_user_id, family_id) references public.family_members (user_id, family_id) on delete cascade` to `celebration_letter_recipients` (the PK on (family_id, user_id) satisfies the reference), so revoking membership structurally revokes the letter. Then have `resolveLetterRecipients` re-verify membership at send time in the same query rather than trusting the row, and name the opt-in writer (route or tool) with its explicit `familyId`-from-session re-scope.

### [SERIOUS] The named-worry rail cannot fire. `worry.ts` reads "the newest non-superseded `family_memories` row for this child that carries a stored `worry_subject_id` (written by the agent when she names it, via the existing remember path with the subject id as a structured field)." No such column exists, no such remember field exists, and the plan's migration adds neither. `readNamedWorry` therefore returns null on every call, `worrySubjectId` is always null, and `selectLetterSlots` step a never runs.

**Evidence.** `family_memories` full column set: supabase/migrations/20260706061222_family_memory.sql:57-69 (id, family_id, child_id, kind, content, source, created_at, updated_at). Every subsequent alter: 20260709210000_memory_supersession.sql:16-17 (superseded_at), 20260709212000_semantic_recall.sql:22-23 (embedding), 20260709120500_memory_sources_and_journal.sql:10-15 (source check), 20260713060000_founder_deep_view.sql:83-84 (session_id). `grep -rn worry` over apps/web/lib, apps/web/agent, packages, and supabase/migrations returns exactly one hit, unrelated prose in apps/web/agent/skills/materials-studio/references/recipes/chant-and-rhyme-card.md:88. Consequence: the letter ships with spec §5A's only mitigation dead, which is precisely the failure mode §5A names, the peak-picker handing her science and math every week while saying nothing about reading. It fails silently and no emitted event distinguishes "rail did not fire because nothing was true" from "rail can never fire".

**Fix.** Either add the storage in the same additive migration (`alter table public.family_memories add column if not exists worry_subject_id text` plus the tool field and its catalog verification against MAP_SUBJECTS), or cut the rail from this tranche and say so, rather than shipping `worry.ts`, `WORRY_RAIL_MIN_CADENCE`, `worryRailDue`, the `worry_rail`/`worry_subject_id` columns, and twelve slot tests against a source that does not exist.

### [SERIOUS] The closed window is unreachable dead code, and three of its tests cannot pass. `chooseLetterSend` step 9 returns a null reason whenever `weekday !== letterWeekday`, and the migration constrains `families.celebration_letter_weekday` to 1..5, so step 12 (weekday 6 and hour >= 18, weekday 0, weekday 1 and hour < 7) can never be reached in production. Separately, the spec requires this fence "enforced at the delivery layer so a badge, a lesson-ready notification, or a finishing agent job cannot walk through it"; a branch inside the letter's own chooser governs none of those.

**Evidence.** Plan eligibility.ts steps 9 and 12 vs plan migration item 4 (`between 1 and 5`), against spec docs/homa-planning/plans/2026-07-22-celebration-system.md:126. The three named tests fail as written. "Saturday 18:00 local records closed_window even when it is configured as the letter weekday" requires letterWeekday=6 to get past step 9; with weekday=6 and hour 18, step 11 fires first (18 >= 9+3) and returns "stale_window", not "closed_window". "Sunday any hour records closed_window" and "Monday 06:00 local records closed_window" both exit at step 9 with a null reason. A green `pnpm check:celebration` therefore requires either deleting the branch or rewriting the tests to assert something the code does not do.

**Fix.** Move the closed-window check ahead of the weekday check so it is a real floor, and state honestly that this tranche enforces it for the letter only. If the spec's delivery-layer fence is in scope, put it where every proactive path passes: a `withinProactiveWindow(zone, now)` guard in apps/web/lib/tasks/store.ts beside `withinDeliveryWindow` (:275-280), called by the task claim path and the letter alike. Otherwise name it as a deliberate deferral in `risks`.

### [SERIOUS] `planLetterSends` orders families by `(familyCreatedAt, familyId)`, a fixed order, then truncates at MAX_LETTERS_PER_RUN = 5 whole families, and the delivery window is 3 hours on an hourly cron. That caps the fleet at 15 letters per (time zone, letter hour) cohort per week, and because the ordering is fixed and the letter recurs forever, the same newest families are starved every week, permanently. This is not the drip's shape: `planDripSends` orders by intent then longest wait then id (apps/web/lib/drip/sweep.ts:229-237), and a drip family leaves the queue once nudged, so no family is structurally last twice.

**Evidence.** apps/web/lib/drip/sweep.ts:52-60 and :229-237; plan planLetterSends steps 3 and 5; plan eligibility step 11 with LETTER_DELIVERY_WINDOW_HOURS = 3; apps/web/vercel.json crons `"schedule": "0 * * * *"`. Scenario: `LETTER_DEFAULT_WEEKDAY`/`LETTER_DEFAULT_HOUR` are Friday 09:00 and `deriveLetterWeekday` returns the default unless a rival weekday beats Friday by 1.5x, so nearly every family lands on Friday 09:00 local. Spec §5C cites 25 multi-kid production families; ten US-Eastern families averaging 2.2 children is 22 letters against 15 slots. Ticks at 09:00, 10:00 and 11:00 send to the oldest 15; at 12:00 every remaining child records `stale_window` and receives nothing. Next Friday the ordering is identical, so the same seven children receive nothing again, and the week after, forever. The founder console shows `stale_window`, which reads as a downtime artifact rather than a permanent starvation.

**Fix.** Order the letter queue by longest wait first: `(lastSentLetterAt ascending, nulls first, then familyId)`, using the previous sent letter's `delivered_at` from `celebration_letters`, so a family skipped this week is first next week. Additionally, do not record `stale_window` when the cause is the burst ceiling rather than downtime; add a distinct `burst_deferred` skip reason so the two are not conflated, and raise the ceiling or widen the window once the arithmetic (fleet child count divided by zone cohorts) is stated in the plan.

### [SERIOUS] `chooseLetterSend` evaluates the permanent-state reasons (no_email, opted_out, suppressed, too_new, too_few_dated_abilities) at steps 2, 3, 4, 6 and 7, which run BEFORE the weekday gate at step 9. The sweep runs hourly over every family and "Also records a skipped row for candidates the chooser rejected with a NAMED reason even when they were not planned" and "Every skip with a named reason writes its row and emits `celebration.letter_skipped`." The row is deduped by `on conflict do nothing`; the event is not.

**Evidence.** Plan eligibility.ts step ordering vs plan sweep.ts, against apps/web/vercel.json (`"0 * * * *"`). Scenario: a family that replied STOP has `journal_opt_out_at` set permanently. Every hour of every day the chooser returns `opted_out`, so the sweep emits `celebration.letter_skipped` 24 times a day, 168 times a week, per child, forever. A child with two dated abilities emits `too_few_dated_abilities` at the same rate until a third arrives. Across ~40 permanently ineligible children that is roughly 6,700 events a week into the shared `events` table, which the founder console and the digest read. It also drowns the one signal spec §5G actually needs ("why did she get no letter"), and it burns an INSERT per child per hour against `celebration_letters` for nothing.

**Fix.** Split the reasons: return `{ send: false, reason: null }` for permanent states unless the current tick is inside the family's own letter window, so a named reason is only ever recorded once per child per ISO week. Concretely, move steps 9, 10 and 12 to the front of `chooseLetterSend` (a tick outside the window records nothing at all), and have the sweep emit `celebration.letter_skipped` only when `recordLetterSkipped` actually inserted a row, i.e. have it return the inserted id or null from the `on conflict do nothing ... returning id`.

