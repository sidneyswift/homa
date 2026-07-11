# SMS family invitations

> Status: APPROVED FOR BUILD 2026-07-11. Founder direction: a linked
> parent may ask Homa to text another adult about a child's milestone.
> The recipient must accept from their own phone, then the original parent
> must confirm the full number with a code before Homa links it or shares
> child information.
>
> Ticket: MJ-21 owns this SMS invitation slice and the broader multi-adult
> roles work. The implementation and migrations are present in the repository.
> Remote migration state, Telnyx configuration, delivery, and authenticated
> production behavior remain unverified.

## Goal

A parent texting Homa can invite another adult into the same family's SMS
experience. Homa sends an anonymous invitation first. A recipient's yes only
asks the original parent to verify the full number. The phone becomes a route
into the family only after that coded parent confirmation.

## Product decisions

1. **Two people confirm before child information.** The first outbound text
   identifies only Homa and the access being offered. It contains no inviter
   name, family name, child name, milestone, conversation, or material.
2. **The recipient proves possession, not identity.** Only a literal yes from
   the invited phone records recipient acceptance. It grants no access.
3. **The original parent verifies the intended person.** Homa texts the full
   destination number and a unique six-digit code back to the authenticated
   source phone. Only `confirm NNNNNN` from that phone grants access.
4. **Phone access, not a web login.** Final parent confirmation adds a
   `family_phones` row.
   It does not create a Supabase Auth user or a `family_members` row. A web
   login still uses the existing email `/join` flow.
5. **One constrained destination exception.** The invitation tool may receive
   a US phone number from the model, but the server controls the first message
   exactly. The model cannot choose its contents, and child information stays
   pending until both people confirm.
6. **No number takeover.** A phone already linked to any family cannot be
   invited. A pending invitation from another family is not replaced.
7. **Seven-day window.** Invitations expire after seven days. A newer
   invitation from the same family supersedes the older pending row.
8. **Durable rate limits.** Database counts cap sends per family and per
   destination over 24 hours. In-memory function state is not trusted.
9. **One normal reply per inbound text.** Every response returns
   server-composed reply text to the agent. The agent sends that as its normal
   reply, so confirmation does not create duplicate tool texts.

## Data model

Add `public.family_sms_invites`:

- `id uuid`
- `family_id uuid`, cascading with the family
- `invited_by uuid`, nullable audit value
- `inviter_name text`, nullable display snapshot
- `phone_e164 text`, US E.164 only
- `child_id uuid`, nullable and `on delete set null`
- `learning_update text`, capped
- `request_key text`, unique replay key derived from Eve session and turn
- `provider_message_id text`, set only after confirmed Telnyx submission
- `inviter_phone_e164 text`, authenticated source phone
- `confirmation_code_hash text`, unique per inviter across invitation history
- provider ids and timestamps for the parent prompt and final update
- `status text`: `sending`, `pending`, `recipient_accepted`, `accepted`,
  `declined`, `superseded`, `expired`, or `failed`
- `created_at`, `expires_at`, and `responded_at`

A partial unique index allows only one active `sending`, `pending`, or
`recipient_accepted` row per phone. RLS is enabled with no policies, and all
privileges are revoked from `anon` and `authenticated`. Supabase's current security guidance confirms that grants
control whether a Data API role can reach a table while RLS controls which
rows it can reach, so Homa keeps both defenses.

Add `public.family_phone_access_epochs`, also deny-all. A trigger rotates its
UUID whenever a `family_phones` row is inserted or deleted. The Telnyx channel
hashes this generation into Eve's continuation token, so removing, moving, or
re-adding a phone cannot resume model history from an earlier access cycle.

## Runtime flow

### Existing parent

1. The linked SMS instruction may offer once after a genuinely celebratory
   milestone: sharing is optional and never asked on every observation.
2. The parent supplies the other adult's number.
3. `invite_family_member_by_sms` normalizes the destination, derives
   `familyId` and the source number from SMS auth, re-scopes `childId` inside
   that family, scans the update for prompt injection, checks ownership and
   durable limits, writes the pending row, and sends server-owned copy.
   The source phone must belong to a real signed-in `family_members` row, so
   phone-only invitees cannot invite more people.
4. The row stays non-actionable as `sending` until Telnyx accepts the
   submission. A failed send marks it `failed`; no live invitation remains.

### Invited adult

1. The Telnyx channel checks whether an otherwise-unlinked number has a
   pending or newly expired family invitation.
2. Invite recipients are not recorded as marketing leads and do not receive
   the first-contact card.
3. Channel auth receives the invitation state and exact invite id, never the
   invited family's id. The response service can change only that row.
4. SMS instructions answer questions plainly. A literal yes or clear no calls
   `respond_to_family_sms_invite`.
5. The response tool derives the phone from channel auth. A yes changes only
   to `recipient_accepted`, generates a non-reusable confirmation code, and
   texts the original parent the full number. No child data leaves the row.
6. The parent's exact coded reply is resolved by family id, source phone,
   invite id, and the database-stored code hash. `cancel` ends the invitation.
7. `confirm` inserts `family_phones`, emits the final events, and texts the
   saved update to the recipient. The next inbound text loads family context.
8. Every inbound SMS uses a continuation token hashed from its current access
   generation. Linked, invited, and unlinked turns cannot share model history
   across an access change.

## Copy, reader and editor gates complete

The copy gates established that the invitation must define Homa, stay
anonymous, put the privacy boundary before the access list, and name every
confirmation and delivery state plainly.

Persistent server copy lives in
`apps/web/lib/family-sms-invite-copy.ts`. Its tests lock the key promises:
the first text is anonymous, recipient yes still exposes nothing, the parent
prompt displays the full number and bound code, and only the final message
contains the child update.

The instruction fallback uses the same terms and answers the recipient's
actual question before offering yes or no.

## Implementation plan

### Task 1: Add failing policy and copy tests

**Files**

- Create `apps/web/lib/family-sms-invite-copy.test.ts`
- Create `apps/web/lib/family-sms-invite-copy.ts` only after the test fails

**Proof**

- The initial invitation API cannot receive a child name or update.
- Invitation copy explains access and consent.
- Accepted copy contains the child update and disconnect guidance.
- Decline and expiry copy state that no phone access was added.
- Whitespace normalization cannot produce multi-line injected SMS copy.

Run the test with:

`pnpm exec tsx --test apps/web/lib/family-sms-invite-copy.test.ts`

The first run must fail because the production module does not exist. The
second run must pass after the smallest implementation.

### Task 2: Add the deny-all invitation table

**Files**

- Create a migration with `supabase migration new family_sms_invites`, then
  preserve this repository's monotonic migration order.
- Modify `scripts/isolation-check.mjs`

**Proof**

- Anonymous and authenticated Data API roles cannot read or insert rows.
- The every-public-table isolation coverage check includes the new table.

### Task 3: Implement invitation persistence

**Files**

- Create `apps/web/lib/family-sms-invites.ts`
- Create `apps/web/lib/family-sms-invite-response.ts`
- Create `apps/web/lib/family-sms-invite-confirmation.ts`
- Create `apps/web/lib/family-sms-invite-policy.ts`

**Behavior**

- Re-scope every child id to the auth-derived family.
- Keep one active invitation per phone.
- Refuse linked numbers and pending invitations from another family.
- Enforce family and destination send limits with database counts.
- Mark failed sends.
- Record recipient acceptance without linking or revealing child data.
- Bind a unique coded parent confirmation to the source phone and invite.
- Add the phone only inside the final parent-confirmation transaction.
- Emit `family.invite_sent`, `family.invite_accepted`, and
  `sms.family_linked` without phone numbers or message content.

### Task 4: Add the three agent tools

**Files**

- Create `apps/web/agent/tools/invite_family_member_by_sms.ts`
- Create `apps/web/agent/tools/respond_to_family_sms_invite.ts`
- Create `apps/web/agent/tools/confirm_family_sms_invite.ts`

The first tool is available only to a linked SMS member. The response and
confirmation tools have no model inputs. Channel auth supplies each exact
decision, phone, invite, and confirmation-code hash.

### Task 5: Route invited recipients correctly

**Files**

- Modify `apps/web/agent/channels/telnyx.ts`
- Modify `apps/web/agent/instructions/sms-mode.ts`

The channel stamps `familySmsInviteState` without exposing `familyId`, skips
lead capture for invitees, and preserves normal linked and stranger flows.
The instruction branch keeps replies short, answers questions, and calls the
response tool only for a clear accept or decline.

### Task 6: Register events and verify the full agent build

**Files**

- Modify `apps/web/lib/family-invites.ts`
- Modify `packages/core/src/events.ts`
- Append implementation notes to this plan

`family.invite_sent` and `family.invite_accepted` gain a required `channel`
property with `email` and `sms` values. No event carries a phone number,
child name, or learning update.

Run:

- `pnpm exec tsx --test apps/web/lib/family-sms-invite-copy.test.ts`
- `pnpm check:events`
- `pnpm check:isolation`
- `pnpm --filter web typecheck`
- `pnpm --filter web lint`
- `pnpm --filter web exec eve build`
- `pnpm --filter web build`

## Implementation notes

- 2026-07-11, **Plan-confirmed:** The approved implementation sends no child
  information before the recipient and original parent both confirm.
- 2026-07-11, **Discovery:** An SMS acceptance cannot honestly create a web
  login because the app has no verified email and no service-role Auth admin
  path. The conservative implementation grants phone-based family access and
  leaves web membership to the existing email `/join` flow.
- 2026-07-11, **Discovery:** The existing `family_phones.source = 'bridge'`
  value already represents a verified phone entering an existing family.
  Reusing it avoids a deployment-order dependency on a check-constraint
  migration. The separate family invite events retain product-level
  attribution.
- 2026-07-11, **Plan-confirmed:** The privacy copy, send policy, channel
  consent, session access epoch, signup guard, and Telnyx failure
  classification were built test-first. Their tests failed on the missing
  behavior before implementation, then passed with 26 focused cases.
- 2026-07-11, **Discovery:** The invited adult's first turn has no family id
  by design. The Telnyx channel stamps only the invite state and exact invite
  id, and the generic family-context fallback stands down for that turn. This
  keeps the invite explanation from fighting the normal unlinked signup pitch.
- 2026-07-11, **Deviation:** The initial plan named one persistence module.
  The response transaction made that file 416 lines. It was split into
  `family-sms-invites.ts` for creation and channel state, and
  `family-sms-invite-response.ts` for acceptance and decline. Both modules
  keep one responsibility and the agent tools import only the side they use.
- 2026-07-11, **Discovery:** `supabase migration new` created the required
  scaffold but the installed CLI hung during its update check. The empty
  scaffold was stopped safely, then the migration was placed at
  `20260711210000` so it sorts after the repository's existing
  `20260711200000` migration.
- 2026-07-11, **Discovery:** Eve's installed Chat SDK bridge uses the
  serialized Telnyx thread id as its continuation token. Auth attributes
  change per turn, but that alone does not clear model history. Homa now
  suffixes the thread with a hashed access generation and strips the suffix
  inside the Telnyx adapter before provider calls.
- 2026-07-11, **Deviation:** The first implementation let every linked phone
  initiate another invitation. Review showed that a phone-only invitee would
  then gain recursive delegation and could be mislabeled with the primary
  parent's name. Invitation creation now requires a phone attributed to a
  real `family_members` row, and the offer is injected only for that caller.
- 2026-07-11, **Plan-confirmed:** Invitation rows now start as `sending` and
  become actionable only after a successful Telnyx submission. A later send
  attempt lazily marks a `sending` row older than ten minutes as failed; no
  cron is needed because sending rows are invisible to recipient routing and
  the next attempt self-heals the only blocked action.
- 2026-07-11, **Discovery:** Invite instructions alone could not prevent the
  model from choosing text-signup tools. `resolveSignupSession` and
  `capture_lead` now reject invitation auth state in code, and the signup
  guard has a red-green regression test.
- 2026-07-11, **Todo for human:** The new table intentionally uses the same
  direct, server-only pinned-channel database path as the rest of SMS. The
  repository's planned M1-02 `SET LOCAL` principal migration remains the
  system-wide point for replacing that interim path; this feature does not
  invent a second authorization model.
- 2026-07-11, **Deviation:** Model instructions were not a strong enough
  consent boundary. The Telnyx channel now classifies only literal yes or a
  clear decline, with no attachment. The response tool has
  an empty input schema and receives the decision, phone, and exact invite
  id only from authenticated channel attributes.
- 2026-07-11, **Discovery:** Rotating the Eve session after
  `begin_text_signup` also removes the previous checklist question.
  Memberless SMS-signup families are now detected explicitly,
  `begin_text_signup` returns the exact next item ids and statements, and
  SMS instructions rehydrate that state before applying the current reply.
- 2026-07-11, **Plan-confirmed:** Invitation submission is replay-safe.
  A SHA-256 request key derived from Eve session and turn identity is unique
  in Postgres. Telnyx submission stores its provider message id; 408, 429,
  5xx, malformed success responses, and transport failures stay uncertain
  and non-actionable instead of being marked definitively failed.
- 2026-07-11, **Discovery:** The base invitation migration was applied to
  homa-prod by another active session before submission hardening finished.
  A schema comparison found the missing request key and provider message
  columns. Follow-up migration
  `20260711220000_family_sms_invite_submission_hardening.sql` was applied
  additively and verified with zero null request keys.
- 2026-07-11, **Plan-confirmed:** Final verification passed: 26 focused
  tests, web typecheck, web lint, event parity, Eve build, Next production
  build, and the full anonymous plus authenticated isolation guard against
  homa-prod. The final read-only code review reported no actionable findings.
- 2026-07-11, **Security correction:** Phone possession is not intended-person
  identity. A mistyped number's owner could truthfully reply yes. Recipient
  yes now grants nothing; Homa sends the original authenticated parent the
  full number and a coded confirm-or-cancel request.
- 2026-07-11, **Plan-confirmed:** Parent confirmation is model-independent.
  The channel accepts only an exact six-digit coded action and binds family
  id, source phone, invite id, and the database-returned code hash into the
  confirmation tool's auth attributes.
- 2026-07-11, **Discovery:** A finite confirmation code can cross-bind if it
  is reused. Codes are now six digits, unique per inviter across all retained
  invite rows, retried on collision, and checked again inside the final
  transaction.
- 2026-07-11, **Plan-confirmed:** The revised two-person copy passed the
  reader gate, then the editor gate. Before both confirmations, every message
  stays anonymous and contains no child or family detail.
- 2026-07-11, **Plan-confirmed:** Migration
  `20260711230000_family_sms_invite_dual_confirmation.sql` was applied to
  homa-prod and verified. The active-state index includes
  `recipient_accepted`; six-digit confirmation hashes are unique per inviter
  across invitation history.
- 2026-07-11, **Plan-confirmed:** Final dual-confirmation verification
  supersedes the earlier 26-test note: 32 focused tests, web typecheck, web
  lint, event parity, isolation, Eve build, and Next production build pass.
  The final read-only review found no actionable issues.
