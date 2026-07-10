# Lead funnel plan: strangers who text or call become invited leads

> Founder ask 2026-07-10 morning: when someone texts or calls the Homa
> number with NO account, (1) save their number, (2) push them to sign
> up, (3) let Homa sign people up conversationally, "pleasant sales
> lady mode": helpful first, always steering to signup.
>
> Companion docs: gateway-plan.md (the adapters this rides on),
> 15-agentic-architecture.md §0 (the doctrine). Boxes check as tickets
> land.

## What already exists (recon 2026-07-10)

- Unknown texters already run as UNLINKED agent sessions with the
  sender's number stamped in auth attributes (agent/channels/telnyx.ts).
- Unknown callers already hit /api/voice/context, which sees the number
  and returns the "warm general companion" shape.
- The onboarding funnel already bridges phones: a lead who enters her
  number during signup gets her family_phones row automatically
  (lib/family-phone.ts source 'bridge') plus a link-notification text.
- The free report at thankshoma.com/onboarding IS signup; it needs no
  card. lead_families rows carry the web funnel; nothing carries a
  phone-first lead today.

## Phase A · capture + concierge (BUILD NOW)

### LF-1 · phone_leads table (migration #41)
- [x] `phone_leads`: phone_e164 unique (+1 shape check), first_channel
  ('sms','voice'), status ('new','engaged','invited','converted'),
  name, email, note, contact_count, last_contact_at, created_at.
  Deny-all RLS (server-only), isolation probes.
- [x] Conversion hook: when a phone links to a family (setFamilyPhone or
  bridgeLeadPhone), the matching phone_leads row flips to 'converted'.

### LF-2 · capture on every unknown contact
- [x] SMS: unlinked inbound in telnyx.ts upserts the lead
  (contact_count++, last_contact_at, status new->engaged on repeat).
  Fire-and-forget; never blocks the turn.
- [x] Voice: /api/voice/context unknown-caller path upserts the same
  way (first_channel 'voice').

### LF-3 · capture_lead tool (unlinked SMS sessions)
- [x] agent/tools/capture_lead.ts: saves name/email/note onto the
  phone_leads row and can mark status 'invited'. Keyed by the SESSION's
  phone number from auth attributes, never model input. Linked sessions
  and non-SMS channels get a polite refusal. Guards: zod email, length
  caps, scan-free plain fields.

### LF-4 · concierge mode over text
- [x] sms-mode.ts unlinked branch rewrite: answer her real question
  first (the reply IS the product demo), then ONE offer: the free
  progress report at thankshoma.com/onboarding, "about five minutes, no
  card", plus "use this same phone number when it asks and your texts
  link up automatically". Save details with capture_lead as they come
  up. If she declines, keep helping and drop the pitch. Never ask for
  payment details over text, ever.

### LF-5 · concierge mode over voice
- [x] Voice supplement (scripts/telnyx-provision.mts): unknown-caller
  section gets the same concierge shape plus the offer "I can text you
  the link right now".
- [x] send_signup_link webhook tool (apps/web/app/api/voice/tools/
  send-signup-link/route.ts + telnyx-shared.mts config): texts the
  onboarding link to the caller's own number via sendHomaSms, marks the
  lead 'invited'. Same TELNYX_WEBHOOK_SECRET posture as every voice
  tool. Wired into the general assistant's tool set; provisioning
  re-run required.

### LF-6 · events + guards
- [x] Registry: `lead.captured` {channel}, `lead.invited` {channel},
  `lead.converted` {channel}. No numbers, no content in props (MJ-08).
- [x] Full guard suite green; isolation probes for phone_leads.

### LF-7 · verification
- [x] Lib-level: upsert/invite/convert lifecycle against homa-prod with
  a synthetic number, cascade-cleaned.
- [x] Voice tool route: curl with the webhook secret (send disabled by
  env in the test), assert lead flips invited.
- [ ] Live: founder texts from a number Homa doesn't know (or pulls a
  family_phones row first), sees concierge mode + capture, finishes
  onboarding with that number, watches the row convert.

## Phase B · sign-up fully inside the conversation (RULING NEEDED)

Recommendation: DON'T build text-native account creation for v1. The
web onboarding IS signup, takes ~5 minutes, needs no card, and produces
the report: the exact magic moment that converts. Homa-by-text signup
would skip it and mint empty accounts. The sales lady's one job is
getting the tap. If conversion data later says the tap is the cliff,
the build is: collect email over text -> admin-create the auth user ->
email a magic link -> family + phone link server-side. Ticket it then.

## Phase C · payments in conversation (RULING NEEDED + billing milestone)

Homa never takes card numbers over SMS or voice. Card data would land
in Telnyx logs, call transcripts, conversation_messages, and model
context: instant PCI scope, and carriers filter card-number texts on
10DLC campaigns. The conversational flow that ships instead, when
billing goes live (LLC-backed Stripe activation, HUMAN-TODO): a
send_checkout_link tool that texts a Stripe Checkout URL (subscription
mode, Apple Pay one tap), plus the Stripe webhook that flips the
family's subscription state. Same warmth, zero compliance surface.
Blocked on: entity/Stripe activation, pricing ruling, webhook route.
