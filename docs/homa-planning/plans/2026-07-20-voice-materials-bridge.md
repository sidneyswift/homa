# Voice materials bridge · technical decision and implementation plan

> **Status:** Phase 0 SHIPPED 2026-07-21 (see the recovery note below);
> Phases 1 and 2 remain NOT YET AUTHORIZED and need founder sign-off on the
> open decisions in §7 (D2, D4, D5, D6) before any code.
>
> **Recovery note (2026-07-21):** this plan and its Phase 0 files were
> written 2026-07-20 in the `diagnose-and-fix-fa9deb` worktree and never
> committed; the session's memory recorded "Phase 0 BUILT" while nothing
> had shipped, leaving the 2026-07-19 fabrication class live in production
> for two extra days. Found during the signal-capture audit's D6
> reconciliation and shipped the same session. §7 D1 is resolved
> differently than written: no founder paste is needed, because
> `scripts/telnyx-provision.mts` push-syncs the general assistant's
> instructions (the curriculum line already worked this way), so the
> boundary file now rides the provisioning script and was pushed to the
> live assistant after merge.
>
> **Goal:** Let a parent on a phone call get a real worksheet made, delivered,
> and (when she asks) added to her binder, without inventing new per-channel
> tools. And, independently and immediately, stop the voice assistant from
> telling parents it did those things when it cannot.
>
> **Why now:** On 2026-07-19 a real family's phone call had Homa claim "I've
> added the syllable activity to Amalia's binder" and "I've sent the filled
> syllables worksheet with visuals to your email." Neither happened: the voice
> channel has no binder tool and its only email tool sends plain text with no
> attachment. A second call two hours earlier correctly said "I can't." That
> inconsistency is a tool-honesty-law violation live in production. See §1.
>
> **Authority:** `BUILD.md`, `AGENTS.md`, and the founder-ruling register
> remain higher authority. This plan does not claim deployment of Phases 1-2.

## 1. The observed failure

Family `304f0003-…` (Carolyng, real / non-sandbox). Two general-line phone
calls, both 2026-07-19, `call_transcripts` channel `phone_call`:

- **13:38 call (fabricated).** Parent: "make sure the worksheet is filled …
  include both English and Spanish words" then "Can you add it to my binder?"
  Homa: "I've sent the filled syllables worksheet … to your email. It includes
  visuals" and "Noted! I've added the syllable activity to Amalia's binder …".
  Verified against prod: **zero** materials titled anything like "syllab" exist
  for this family, ever. No worksheet was created, none finalized, and the
  email tool cannot carry an attachment.
- **20:33 call (honest).** Parent: "make me a printout and put it in my
  binder?" Homa: "Since we're on a call right now, I can't make a printout or
  add it to your binder directly. But I can email you the activity details."

Same capability, opposite claims. The parent's own summary ("couldn't send to
binder, could only email") is the charitable read; the real defect is that the
model sometimes narrates success it did not achieve.

## 2. Why this happens (root cause)

The phone channel is **not** the eve agent. Web chat and SMS run eve with the
full tool set, including `create_printable` (`apps/web/agent/tools/create_printable.ts`)
and `mark_material_final` (`apps/web/agent/tools/mark_material_final.ts`). A
phone call runs a separate **Telnyx voice assistant** whose entire live tool
set is four HTTP webhooks under `apps/web/app/api/voice/tools/`
(`send-email`, `send-signup-link`, `log-hours`, `remember`). Its only
content-delivery tool, `send-email`, calls `sendAgentComposedEmail(email,
subject, text.split("\n"))` with no attachment parameter. Its system prompt
lives Telnyx-side and does not state what it cannot do, so a helpful model
fills the gap with fabricated success.

Note: on **text (SMS)** and **web**, creation, email, and binder already work.
The 07-17 binder rows for this same family are `channel='sms'`, built by
`create_printable` and promoted by `mark_material_final`. **The only channel
missing these capabilities is phone.**

## 3. The binding constraint

`create_printable` renders HTML to PDF, generates per-page JPEG previews,
uploads to Blob, and runs a vision QC review: seconds to tens of seconds. A
Telnyx voice webhook must answer inside ~5s (`apps/web/app/api/voice/context/route.ts:24`).
**You cannot make a worksheet synchronously during a live call.** This single
fact rules out exposing `create_printable` as a voice webhook, and it shapes
the whole design toward async fulfillment.

## 4. Design principle (from `AGENTS.md` layering law)

Do **not** build `email × {text, phone}` and `binder × {text, phone}` as four
tools. Build channel-neutral primitives (they already exist and already branch
on `attributes.channel`) and give each channel a thin way to invoke them,
async where the channel cannot wait. "From any channel" is achieved by keeping
the primitives generic plus a per-channel invocation shim, not by copying
tools. The judgment (recipe choice, difficulty, keep-or-not, QC) stays in the
`materials-studio` skill; the new deterministic leaf is the smallest possible
enqueue.

## 5. Plan

### Phase 0: Honesty (ships immediately, independent of Phases 1-2)

Truth-first, so that until the bridge exists Homa sets a correct expectation,
and after it exists the expectation ("I'll text it to you shortly") is true.

1. **Version a general-line voice instructions file** at
   `apps/web/agent/general-call-instructions.md`, mirroring the existing
   `apps/web/agent/curriculum-call-instructions.md`. It states the real
   boundary in plain language: on a call Homa cannot render a worksheet, cannot
   attach files to email, and cannot add anything to the binder in the moment;
   she can send a short plain-text email, and (Phase 1) offer to make the real
   printable and text it right after. This file is the source of truth the
   founder pastes into the Telnyx general-line assistant.
2. **Founder applies the prompt** to the Telnyx general-line assistant (and the
   curriculum assistant) from that file. This is the only step this repo cannot
   deploy itself; it is why Phase 0 is "fix + founder action," not "fix +
   Vercel deploy." Flag in §7 D1.
3. **Harden the `send-email` tool result** (`apps/web/app/api/voice/tools/send-email/route.ts`).
   Replace the bare `{ success: true }` with a boundary reminder in the result
   the model reads back, e.g. "Sent as a plain-text email. There is no
   attachment or worksheet file, and you cannot add anything to the binder on a
   call. Tell her exactly that." This directly counters the email-worksheet
   claim, which does follow a tool call, and is fully shippable in-repo now.

### Phase 1: Async voice → materials bridge

**Mechanism corrected 2026-07-20 after reading the code.** The first draft of
this plan proposed the dispatch proactive rails. That is wrong, for two
disqualifying reasons found in `lib/tasks/` and `create_printable.ts`:

- **Dispatch delivery is text-only.** `deliverLiveDispatchTask` bottoms out in
  `sendSms(phone, text)` (`lib/conversation-continuity/task-delivery.ts:45-54,136`)
  with no media argument. The dispatch lane cannot carry a worksheet PDF.
- **Dispatch cannot represent a one-off.** `buildTaskMessage`
  (`lib/tasks/dispatch-input.ts:162-179`) is an exhaustive switch over three
  kinds and throws otherwise; `loadFamilyTaskForRun` requires an
  `agent_schedules` row; and the `custom` kind is a *recurring* schedule
  (`lib/tasks/custom.ts:99-152`), so a one-shot would leave a repeating task
  behind.
- Additionally, `create_printable`'s MMS branch keys on
  `channel === "sms" && attributes.phoneNumber` (`create_printable.ts:719-735`),
  and `buildDispatchAuth` (`dispatch-input.ts:258-277`) sets neither. In a
  dispatch session the tool silently skips delivery and tells the model the
  card "is already visible in chat", which is false there.

**Use the `materials-lab` pattern instead** (`apps/web/agent/channels/materials-lab.ts`).
It already runs `materials-studio` one-off for a real family, with its own run
table (`materials_studio_runs`, already in prod), its own auth, and a
`CRON_SECRET`-gated `POST /eve/v1/materials-lab/run` route that calls `send()`.
Its only non-goal is delivery (`lib/materials/studio-brief.ts:66-68` tells the
session not to message anyone), which is exactly the one thing we add. Build a
sibling channel rather than loosening materials-lab, so the admin bench stays
sandbox-safe.

Flow:

1. **New thin voice webhook** `POST /api/voice/tools/request-material`. Same
   posture as every voice tool: `family_id`/`child_id` come from the call's
   dynamic variables in the URL via `readVoiceFamilyId`/`readVoiceChildId`,
   never from the model; keyed-URL auth via `hasVoiceWebhookSecret`; per-family
   daily rate limit. Body carries the parent's request in words plus a `keep`
   flag ("add it to my binder" → `keep: true`). It POSTs to the bridge route
   with `Bearer ${CRON_SECRET}` (the `app/app/tasks/actions.ts:224-252`
   pattern) and returns immediately: `send()` resolves when the durable session
   *starts*, not when it finishes, which fits the ~5s Telnyx budget.
2. **New bridge channel** `apps/web/agent/channels/materials-bridge.ts`
   exposing `POST /eve/v1/materials-bridge/run`. It resolves the family's number
   through `getFamilyPhones(familyId)` (`lib/family-phone.ts:33-41`, the only
   sanctioned reader of `family_phones`) and starts the session with
   attributes `{ channel: "sms", phoneNumber, familyId }`.
   **This is the whole delivery trick:** giving the background session the real
   SMS identity makes `create_printable`'s existing MMS path fire unchanged, so
   the preview and PDF text themselves to the parent with no new delivery code
   and no change to the tool.
3. **Binder finalize** is a flag on the request, not a new tool: when
   `keep: true` and QC passes, the session calls the unchanged
   `mark_material_final` (it refuses only for `subject_lesson`, so this is fine).

No changes to `create_printable` or `mark_material_final`. New surface is one
voice webhook, one channel, and one brief builder.

### Phase 2: Generalize (optional, only if a second channel needs it)

Write the bridge channel-neutrally so the email adapter or a future channel can
enqueue the same materials run. Do not build this speculatively; it lands only
when a real second channel needs it (YAGNI, matching the filesystem-first
ruling's posture).

## 6. Data, tenancy, safety

- **Provenance.** `materials.channel` is check-constrained to
  `('web','sms','email','dispatch')`. Because the bridge session runs with
  `channel: "sms"` (§5 Phase 1 step 2), the row records `sms`, which is
  truthful: the material really is created and delivered over SMS. **No
  migration is needed**, which is the recommended answer to D3. If voice-origin
  analytics are wanted later, prefer a `tags` entry over widening the check.
- **Tenancy.** `familyId` is derived from the call's dynamic variables and
  re-scoped server-side; the model never supplies it. `create_printable` and
  `mark_material_final` already re-scope every id inside the authenticated
  family.
- **QC gate.** Finalize only after the existing vision QC passes, so the binder
  never gains a material that failed review (guards the `materials-review-false-pass`
  class already tracked).
- **Idempotency + rate limits.** One in-flight materials request per family at a
  time; a daily cap like the other voice tools; a stable idempotency key so a
  repeated tool call on one call does not enqueue twice.
- **Delivery honesty.** The enqueue returns a promise-shaped result the model
  reads back; actual "sent" state comes only from the dispatch delivery, never
  from the model asserting it.

## 7. Open founder decisions

- **D1.** Phase 0 prompt application: founder pastes the versioned instructions
  into the Telnyx general-line (and curriculum) assistant. Confirm you will do
  this, since the repo cannot deploy Telnyx config.
- **D2.** Scope: do we build Phase 1 now, or ship Phase 0 only and leave phone
  worksheet-making as an explicit "text me and I'll make it" hand-off?
- **D3.** Provenance: **resolved by the corrected mechanism.** The bridge runs
  as `sms`, so materials record `sms` and **no migration is required**. Raise
  this again only if voice-origin analytics become a real need.
- **D4.** Auto-finalize: when a parent says "add it to my binder" on a call,
  finalize automatically once QC passes, or deliver as a draft and let her keep
  it from the text/app?
- **D5.** Delivery surface: SMS/MMS only (recommended, reuses the existing
  PDF-as-link path), or also email a link?
- **D6.** Flag + rollout family: gate Phase 1 behind a new env flag and verify
  end-to-end on Carolyng's `+homatest` sandbox family before enabling for all?

## 8. Rollout and verification

- **Phase 0** ships first: the tool-result change deploys via Vercel; the prompt
  change is founder-applied. Verify by a test call on a `+homatest` family that
  Homa now declines the binder ask honestly and offers the text hand-off.
- **Phase 1** behind a flag. Deploy code, confirm Vercel READY, then apply any
  additive migration (D3), then enable the flag for the sandbox family, place a
  test call, and confirm: a real printable arrives by text, the binder gains it
  only when `keep` was set and QC passed, and the transcript makes no claim the
  system did not fulfill. Widen after the sandbox pass.

## 9. Testing per layer

- **Unit/integration:** the `request-material` webhook (auth, family-from-URL,
  rate limit, idempotency, keep flag) and the `send-email` result copy.
- **Skill behavioral eval:** materials-studio produces one deliverable printable
  from a voice-shaped request.
- **Routing:** the voice assistant offers the hand-off for a printable ask and
  never claims an in-call binder write (adversarial-negative fixture drawn from
  the 13:38 transcript).
- **End-to-end:** the disposable path from webhook to SMS delivery to binder
  finalize on a sandbox family.
