# Multi-parent v0 + founder account merge

> Status: APPROVED PLAN (founder decisions 2026-07-10 late night, question
> card in chat). Scope ruling: this pulls a v0 slice of NT-4 (multi-adult
> roles, journeys/05 AS-01/FR-01) forward from GA, because the founders
> themselves are a two-parent family split across two accounts and the
> merge is impossible to do honestly without it. The full invited-adult
> product (invites, roles, per-adult audit) stays a separate later phase.
> PRD 13 §scope ("one login per family") is superseded for this slice by
> founder ruling; logged in build-log.

## The situation

Sidney (sidney@recoupable.com) and Alessa (alessallanes@gmail.com) are one
family with one child, Story. Signup has no join path (attachAuthUser
always creates or folds into the caller's OWN family; create_my_family
raises if a membership exists), so they ended up with two complete,
separately-grown families:

| | The Llanes family (Alessa) | The Swift family (Sidney) |
|---|---|---|
| family id | c18d5def-0d55-4f93-a2e2-b4fe5a0a5ee0 | fd7002da-d290-4e54-b9e8-f868989b6de2 |
| auth user | 5b1393f0-3dbd-4463-a866-87fd71fccf82 | 63efdada-20b5-42d3-bab1-71bac03892be |
| phone (family_phones) | +19545405255 | +19549903497 |
| Story child id | def67e8f-13cb-4917-8be9-11fce3ef749f | c2fc6d39-7c00-4394-acf3-29ada8af2b23 |
| child_answers | 49 | 34 |
| child_plans | 4 (math, month, music, self_care) | 1 (literacy) |
| conversation_messages | 14 (8 web, 6 sms) | 42 (10 web, 32 sms) |
| family_memories | 4 | 4 |
| materials | 3 | 7 |
| call_transcripts | 2 | 3 |
| events / model_usage | 6 / 30 | 15 / 90 |

A third account exists: alessa@thankshoma.com (family
f1b86629-90b5-45bb-bb94-a983f4585053, its own Story with 41 answers, no
phone, no messages). Founder ruling: delete it.

## Founder decisions (2026-07-10 late night)

- **D-mp-1 · order:** Phase 1 (multi-parent v0 slice) ships first, then
  the data merge, then the full invite-flow product as its own phase.
- **D-mp-2 · surviving family:** Alessa's row (older, richer child data),
  renamed to "The Swift family".
- **D-mp-3 · canonical Story:** Alessa's child row. Answers merge with
  latest-answered-at wins on the 8 conflicting question_ids. Sidney's
  literacy plan moves over (no subject overlap). Alessa's report row
  stays; reports regenerate from merged answers anyway.
- **D-mp-4 · birth month:** November 2022 (normalized to 2022-11-01 to
  match the app's day-01 convention).
- **D-mp-5 · account email:** families.email stays alessallanes@gmail.com
  (journal delivery is SMS-first to every linked number after Phase 1;
  email is the fallback). Inbound email from either parent's sign-in
  address must reach the family (Phase 1 work).
- **D-mp-6 · thankshoma test account:** deleted (family row + auth user).
- **D-mp-7 · roles:** both members are role 'parent'. partner/helper
  semantics stay NT-4.

## Phase 1 · multi-parent v0 (code + additive schema, ships first)

The smallest slice that makes one family with two adults fully work on
every live channel. No invite UI yet (the merge is done by hand; invites
are Phase 3).

### Schema (migration A, additive, may lead the deploy)

- `family_members.display_name text` (null OK). Backfill during merge.
- `family_phones.member_user_id uuid references auth.users on delete set
  null` (null OK): which adult carries this number. Backfill from
  `added_by` where it matches a real auth user.
- Widen family_members SELECT policy from `user_id = auth.uid()` to
  `is_family_member(family_id)`: members can see their family's roster
  (needed for context rendering under caller RLS, and any future roster
  UI). Anon stays denied; isolation check unchanged.

### Schema (migration B, applied only AFTER the code deploy is READY)

- `alter table family_phones drop constraint family_phones_one_per_family;`
  The old code upserts `on conflict on constraint
  family_phones_one_per_family`, so dropping first would error live
  writes: code that no longer names the constraint deploys first
  (deploy law, AGENTS.md). `family_phones_number_key` (unique phone_e164)
  stays: a number still routes to exactly one family.

### Code

- `lib/family-phone.ts`: list-shaped API. `getFamilyPhones`,
  `addFamilyPhone` (plain insert; unique violation on phone_e164 means
  taken), `removeFamilyPhone(familyId, phone)`, `findFamilyIdByPhone`
  unchanged, `findFamilyMemberByPhone` (family + member display name for
  channel identity). `getFamilyPhone` stays as "first linked number" for
  single-value callers (report prefill, voice call target default).
- `/app/settings` texting card: lists every linked number with a remove
  action, plus an add field. Claim-a-taken-number flow unchanged.
- Journal/brief/custom task delivery (`lib/tasks/store.ts`,
  `agent/channels/dispatch.ts`): claim query returns ALL linked numbers;
  SMS delivery sends to each; delivered when at least one send succeeds.
- Inbound email (`lib/email-inbound.ts`): match `families.email` OR any
  member's auth email (join family_members to auth.users on the server
  connection). Journal opt-out reply keeps working for both parents.
- Channel identity in agent context:
  - SMS/voice: the sender's number resolves member_user_id, so the agent
    is told "you are texting with Sidney" when known.
  - Web: eve auth walk reads the caller's own membership display_name
    into session attributes.
  - `lib/family-context.ts` render: family line lists all parent display
    names when the roster has more than one, and a per-turn line names
    the adult on this channel when known.
- Web greeting (`/app` layout): the signed-in member's display_name wins
  over the family-level parent_display_name, which stays as fallback.
- `attachAuthUser` stamps display_name (first name) on the membership it
  inserts, so new signups get per-member names from day one.

### Explicitly NOT in Phase 1

- No invite flow, no roles UI, no permission scopes (Phase 3 / NT-4).
- No per-member avatar (families.parent_avatar_url stays single; known
  gap, listed for Phase 3).
- Mobile app keeps family-level greeting (parity ticket M1-17 posture).
- create_my_family guard stays: one family per user remains the law.

## Phase 2 · the merge (one transaction, after Phase 1 is READY)

Winner W = c18d5def (Alessa's row), loser L = fd7002da (Sidney's row),
canonical child C = def67e8f, duplicate child D = c2fc6d39.

Pre-step: snapshot every row of both families (all family- and
child-scoped tables) to a local untracked JSON file, and confirm counts.

In one transaction:

1. Child data, D into C:
   - child_answers: upsert D's rows onto C, `on conflict (child_id,
     question_id)` keep the later answered_at.
   - child_plans: repoint D's literacy plan to C (no subject overlap).
   - child_reports: keep C's (D's dies with D).
   - family_memories, materials: `set child_id = C where child_id = D`.
   - hours_log, call_transcripts: no D references (verified), clause
     included anyway for safety.
   - Normalize C birth_month to 2022-11-01. Profile: C's is richer, keep.
   - Delete child D (cascades its remaining child-keyed rows).
2. Family-scoped rows, L into W: conversation_messages, family_memories,
   materials, call_transcripts, learning_reviews, events, model_usage,
   homa_task_runs, hours_log, family_skills, child_curriculum_calls.
3. agent_schedules: delete L's rows (W already holds journal_prompt; the
   builtin unique index forbids two).
4. family_members: repoint Sidney's membership to W; set display_name
   'Sidney' and 'Alessa'; both role 'parent'.
5. family_phones: repoint +19549903497 to W (needs migration B applied);
   stamp member_user_id on both numbers.
6. families W: name 'The Swift family'; email stays
   alessallanes@gmail.com; delete row L (verified empty first).
7. thankshoma: delete family f1b86629, then its auth user.

Post-checks: W row counts equal the pre-merge sums; each auth user has
exactly one membership; both numbers resolve W via findFamilyIdByPhone;
both parents sign in and see the same family; SMS from each phone lands
in W's conversation_messages.

Rollback story: the snapshot file plus Supabase PITR. The transaction
either commits whole or not at all.

## Phase 3 · the invite-flow product (separate plan, NT-4 shape)

Not built now; recorded so the v0 slice points at it: family_invites
table (email, token hash, role, invited_by, expires), settings "invite a
co-parent" card, attachAuthUser honoring a pending invite BEFORE its
create-or-fold behavior, account.secondary_user_added event
(journeys/06), per-member avatars, partner/helper permission scopes,
journal privacy default (NT-4). Copy through the reader + editor gates.

## Implementation notes

(Running log, per the implementation-notes discipline: deviations from
this plan land here with the conservative call taken.)

- 2026-07-11 · Plan-confirmed: migration #49 (display_name,
  member_user_id, roster read policy) applied to prod ahead of the
  deploy; #50 (constraint drop) written and held for post-READY.
- 2026-07-11 · Deviation: the plan named setFamilyPhone's named-conflict
  upsert as the only code that breaks when #50 drops the constraint.
  The code revealed a second one: attachAuthUser (lib/map/store.ts)
  inserts family_phones with "on conflict (family_id) do nothing",
  which ERRORS once no unique constraint matches that arbiter.
  Conservative choice: bare "on conflict do nothing" (also absorbs the
  pre-#50 window). Revisit: none needed.
- 2026-07-11 · Discovery: confirmPhoneClaim's real-family branch cleared
  the holder's whole family_phones row set (delete by family_id) when
  moving a number. Multi-number makes that a data-loss bug; it now
  removes only the claimed number.
- 2026-07-11 · Discovery: the working tree carried the prior session's
  unshipped tasks-framework + turn-recovery work (tested, build-log'd,
  migrations already applied to prod). The Phase 1 changes interleave
  with it in shared files (dispatch, telnyx, chat clients), so both
  ship in one push rather than pretending they are separable.
- 2026-07-11 · Todo for human: per-member avatars and the mobile app's
  member-aware greeting stay family-level (Phase 3 / M1-17 parity
  list); blocks nothing.
