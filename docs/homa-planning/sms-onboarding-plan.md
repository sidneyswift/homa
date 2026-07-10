# SMS onboarding plan: Homa performs signup on the channel

> Founder ruling 2026-07-10 ~11am, overruling lead-funnel-plan Phase B:
> "The tap is not the goal... I'd rather Homa meet them where they are,
> so she should just perform the onboarding there." Text the questions,
> get the responses, fill out the cards, know what is still needed, and
> safely update the account tables. This plan builds exactly that.
> Payments stay a texted Stripe Checkout link when billing goes live
> (lead-funnel-plan Phase C ruling stands; no card numbers on-channel).

## Design facts (from the onboarding contract recon, 2026-07-10)

- One world: the web flow writes `families` / `children` /
  `child_answers` / `child_reports` from the first tap. The SMS flow
  reuses the SAME store functions; nothing forks.
- Scoring requires only `families.email` set, NOT an auth user. A
  password never exists over SMS; when she later signs in on the web
  with that email, `attachAuthUser`'s fold-together attaches her auth
  user to the family Homa built by text.
- Minimum to a report: family basics, one child (24-203 months), 16
  base answers (one per domain, ladder rungs only after "easily"),
  email. The report link is permanent possession-auth.
- The phone IS the session identity: once `family_phones` is written,
  every later text resolves to the family (linked session, full
  context). Mid-signup, tools resolve the family server-side from the
  session's own phone number, never from model input.

## Tickets

### SO-1 · Server lib: lib/sms-onboarding.ts
- [x] `ensureSignupFamily(phoneE164)`: finds the in-progress signup
  family for this phone or creates one (`startAnonymousFamily`
  semantics, `source='sms'`) and links the phone (`setFamilyPhone`,
  which also flips the phone_lead converted).
- [x] `nextChecklistItem(childId)`: server port of the web queue
  (planQuestions + easily-ladder) returning the next bank item id +
  statement, or null when that child's checklist is complete.
- [x] `setFamilyEmailSafe(familyId, email)`: zod-validated, lowercased;
  when the email already belongs to ANOTHER family, refuse with the
  "sign in on the web and link this number" message (no folding
  without auth).
- [x] `signupProgress(familyId)`: what is still needed (family basics?
  kids? answers per kid? email?), so the agent always knows the next
  thing to ask and the founder's "tell me what I need to get" is a
  tool result, not a guess.

### SO-2 · Tools (SMS sessions; each result carries the next step)
- [x] `begin_text_signup`: creates/finds the signup family from the
  session phone; result = progress + first thing to ask.
- [x] `signup_set_family(parentName, familyName?, usState?)`:
  `saveFamilySetup` (address optional by schema; never asked on SMS).
- [x] `signup_add_child(name, birthMonth)`: `addChild`; result includes
  the child's first checklist question (or pending-band note for
  under-2s).
- [x] `signup_record_answer(childId, itemId, answer)`: `saveAnswer`
  with the enum (easily | getting_there | not_yet | not_sure | skip);
  the model maps the parent's natural phrasing to the enum and asks
  ONE clarifying question when genuinely unsure. Result = next item
  or "checklist complete".
- [x] `signup_set_email(email)`: `setFamilyEmailSafe`.
- [x] `signup_finish(childId)`: `createReport` + texts nothing itself;
  result carries the permanent report URL for the agent's own reply.
  Also emits the completion event.
- [x] All six: refuse on non-SMS channels; family resolution is
  attributes.familyId, else `findFamilyIdByPhone(session phone)`;
  never model-supplied ids for the FAMILY (child ids are validated
  in-family by the store).

### SO-3 · Instructions (sms-mode.ts signup section)
- [x] Unlinked branch gains the flow: on a yes to the offer, run the
  intake conversationally: name and state, kids and ages, then the
  checklist one question per text in plain parent language, mapping
  answers to the enum. Batch nothing; one question per bubble. Skip
  and not-sure are always honored. Email near the end ("where should
  the report go?"), then finish and text the link.
- [x] Mid-signup resumes: a linked family with no report and an open
  checklist continues where it left off (signupProgress drives it).

### SO-4 · Groundwork (migration #45 + events)
- [x] `families.source` check gains `'sms'`.
- [x] Events: `map.started` gains source 'sms' via existing prop;
  registry adds `signup.sms_completed` {kids, questions_answered}
  (counts only, MJ-08 clean).

### SO-5 · Verification (dev agent E2E, synthetic conversation)
- [x] Verified at two layers against homa-prod (2026-07-10): the lib
  lifecycle (18 checks) and the six tools driven end to end by their
  own results with an SMS-shaped session (11 checks): family + phone
  link + lead conversion + basics + child + 23-27 adaptive answers +
  email guards + scored report with permanent link, zero residue.
  Inbound-webhook signing makes a full fake-SMS turn impossible
  locally; the live conversational pass is the founder's first real
  text (or Alessa's).
- [x] Guard suite green; no new isolation surface (no new tables).

### SO-6 · Bookkeeping
- [x] build-log entry: founder overruled Phase B; what shipped.
- [x] lead-funnel-plan.md Phase B section updated to point here.

## What this does NOT include (standing rulings)
- No card numbers over SMS or voice, ever; the billing-era close is a
  texted Stripe Checkout link plus webhook-driven subscription state
  (lead-funnel-plan Phase C, blocked on entity + pricing).
- Voice-native signup: the voice line keeps texting the link (or now,
  starting the text signup); running the full checklist by voice is a
  separate decision for another day.
