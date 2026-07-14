# Thank-you cards · one robot-handwritten card per family

> Status: LIVE 2026-07-11 5pm (founder "send it" after the read-aloud
> ruling). The first three cards are ordered and paid, order ids in
> the build-log entry of the same date, which also records the two
> bugs the first live sweep surfaced and their same-hour fixes (an
> optimistic-lock recording bug and the payment processor's
> duplicate-charge window; SEND_BATCH_LIMIT is now 1 per hourly run).
> The conference cohort starts flowing automatically ~July 15 (48h
> after July 13 signups), capped at 150/month. The note is the
> co-founders' version signed "Warmly, / Alessa & Carolyng /
> thankshoma.com"; the stationery is custom card 349914.

## What this is

When a mom finishes web onboarding, Homa mails her a real greeting
card: robot-written with an actual pen, her name on the envelope,
signed by the founder. One card per family, ever. The gesture rides on
a fact the research pass surfaced: the create-your-family step already
collects and requires a full mailing address, so the main signup path
is mailable today with zero product changes.

## Research summary (2026-07-10 canvas: thank-you-card-automation)

- Vendor market has three tiers: real-pen robots (Handwrytten,
  Simply Noted), printed handwriting fonts (Thanks.io), plain print
  APIs (Lob). Real pen is the only tier that matches the gesture.
- **Handwrytten** chosen: $3.75/card retail pay-as-you-go plus USPS
  postage ($0.82 from July 12), no monthly fee, official TypeScript
  SDK on npm ("handwrytten"), SOC 2 Type II, custom stationery and
  founder-handwriting digitization available later. Simply Noted gets
  cheaper at volume ($2.48 to 3.58 all-in) but wants prepaid credit
  packs; revisit past ~150 cards/month.
- Vendor-published benchmarks (directional, not audited): handwritten
  envelopes open near 99%, response rates run several times printed
  mail. The card asks for nothing anyway; it is a retention and
  word-of-mouth gesture, not a funnel step.

## Decisions (from the research recommendations, founder-approved via "do it")

- **D-tyc-1 · vendor**: Handwrytten, real pen, pay-as-you-go.
- **D-tyc-2 · audience**: every family with a completed web
  onboarding (profile_completed_at set), a full US address, and an
  email on file. SMS-only families have no address and wait for
  phase 2 (the agent asking conversationally, opt-in).
- **D-tyc-3 · timing**: 48 quiet hours after family setup, so the
  card lands in week one without reacting to an abandoned signup.
- **D-tyc-4 · one per family, ever**: enforced by a unique
  constraint, not job logic.
- **D-tyc-5 · signature**: "Warmly, Sidney, founder of Homa". The
  reader gate found an unidentified first name is where trust
  wobbles; the founder read-aloud in HUMAN-TODO is the last word.
- **D-tyc-6 · no address appends, ever**: if Homa does not have the
  address, Homa asks her. Data-broker lookups are a hard no for a
  family product.
- **D-tyc-7 · primary parent only (founder ruling 2026-07-14,
  `card-per-family-primary-parent`)**: the card keys on the family,
  never the account. One per family ever, addressed to the primary
  parent whose signup created the family. A later adult's account
  (join link, SMS invite, or any other membership) never mints,
  renames, or re-times one; the family identity fields the recipient
  snapshot reads are write-once after onboarding completes.

## How it works

One new module chain, all server-only:

- `supabase/migrations/20260711170000_thank_you_cards.sql`: the
  outbox table. Recipient snapshot at queue time, status
  queued/sending/sent/mailed/failed/skipped, attempts counter,
  vendor order id. Deny-all RLS (mailing addresses live here);
  unique family_id is the once-ever guarantee. Applied to homa-prod
  via MCP 2026-07-11 (additive may lead).
- `apps/web/lib/cards/thank-you.ts`: the sweep, called from the
  hourly `/api/map/cron`. Three idempotent passes: enqueue eligible
  families, send queued rows (claim with `for update skip locked`,
  attempts stamped before spending, 10 per run, monthly cap, three
  strikes then parked as failed), confirm sent rows to mailed by
  polling the order.
- `apps/web/lib/cards/handwrytten.ts`: thin SDK wrapper. Uses the
  basket flow because only basket/send accepts test_mode; clears the
  basket on failure so a stranded item can never double-send.
- `apps/web/lib/cards/message.ts`: the card copy (passed both copy
  gates 2026-07-11, reader then editor) and the wishes line.
- `packages/core/src/events.ts`: `card.thank_you_sent`, family_id
  only, no PII in props (MJ-08).
- Guards extended: isolation-check covers thank_you_cards (read +
  insert probes); events check green; typecheck, lint, web build
  green.

Dark until ALL of: `THANK_YOU_CARDS_ENABLED="true"`,
`HANDWRYTTEN_API_KEY`, `HANDWRYTTEN_CARD_ID`, `HANDWRYTTEN_FONT`.
`THANK_YOU_CARDS_MONTHLY_CAP` (default 150) is the spend brake:
at retail that caps exposure near $685/month plus postage.

Test mode (amended 2026-07-11 1am, after the key went live): a test
order still marks a family's once-ever row as sent while mailing
nothing, so the sweep REFUSES to run unless `HANDWRYTTEN_TEST_MODE` is
exactly `"false"` AND the vendor account itself is in live mode
(Handwrytten has its own account-level test switch on their
Integrations page, invisible to env vars; the sweep checks the live
account record via auth/getUser). Test-mode orders are reserved for
`apps/web/scripts/handwrytten-smoke.mts`, which forces the flag and
cannot place a real order; per-order test flags are only honored when
the ACCOUNT is in test mode ("test mode error" otherwise).

## The card (current copy, revision 4)

The note went through four founder-directed revisions on 2026-07-11,
each gated or ruled (the full trail lives in message.ts's comment and
the build log): rev 1 gated baseline, rev 2 "make it heartfelt", rev 3
the co-founders' "We" version signed "Warmly, / Alessa & Carolyng /
thankshoma.com" (this is what the first three cards carry), rev 4
minutes after that batch went to the robots: no colons on the surface,
and the address-explanation clause removed ("they obviously know they
gave their address", a conscious override of the reader gate's
privacy-flinch finding). Current text, mailing from the conference
cohort onward:

> Hi {firstName},
>
> Thank you for trying Homa.
>
> You took on your family's whole education. Most people won't see
> how much love that takes. We see it. We homeschool our own kids.
> We built Homa so you never have to do it alone.
>
> Whenever you want a hand, text Homa at (346) 758-8011. We hope she
> helps your family as much as she's helped our own.
>
> Warmly,
> Alessa & Carolyng
> thankshoma.com

Standing gate findings baked into the text: testimony over
fake-familiarity ("We see it. We homeschool our own kids." makes
"most people won't see" read as two named women speaking from
experience); "your family's whole education" stays family-size
neutral (a wrong "kids" plural in real ink is where the hand stops
feeling like a hand); the texting number is printed because the card
lives on a fridge; Homa is named then "she", one pronoun; gratitude
sized to "trying"; "want a hand" is the one metaphor; contractions
throughout; sentence case everywhere.

## What is NOT in scope (phase 2 candidates)

- The agent asking SMS-signup families for an address (opt-in).
- An address card in Settings (no post-onboarding edit UI exists).
- DONE 2026-07-11 afternoon: custom Homa stationery. Card id 349914,
  "Homa thank you (script v4)", the third design pass in one
  afternoon, each under a founder ruling:
  v2 (bold two-tone headline, lockup + tagline back) fell to "a
  genuine thank-you card, not promotional material; the tagline is
  out". v3 (quiet single-ink sans, tiny colophon back) fell to "looks
  cheap; no logo on the front; make the Thank you look amazing; full
  logo and wordmark on the back". v4 final art: the front is ruled
  cream notebook paper with the soft clay margin rule, a large
  flowing "Thank you" in clay script (Dancing Script, a
  stationery-craft exception recorded in the build log; the system
  has no lush script and Fredoka/Caveat are role-locked) with two
  gold sparkle doodles riding the final swash, and NO logo anywhere
  on the front. The back is the full lockup, house + bounced Fredoka
  wordmark, centered, nothing else. An EB Garamond italic alternate
  front is preserved beside the sources
  (docs/homa-design/explorations/thank-you-card/, pipeline
  apps/web/scripts/handwrytten-brand-card.mts). The uxui mailbox
  read's fixes carried through all passes (margin rule at 35%
  opacity, no misparsing domain on paper).
- Founder handwriting digitization.
- Milestone cards (first report, 100th day) as a tasks-framework kind.
- A do-not-mail flag surfaced in Settings; today support is manual
  (insert a skipped row for the family, which blocks the queue row).

## Founder switch order (mirrors HUMAN-TODO; steps 1-2 DONE 2026-07-11 1am)

1. DONE: account + API key (founder), return address saved via the
   address-book API (order placement requires one on file), font
   hwDavid "Casual David" chosen, five env vars set in Vercel
   production (key encrypted, HANDWRYTTEN_TEST_MODE="false" so the
   sweep may run when enabled). .env.local carries the same with test
   mode forced for dev. Stationery upgraded same day from catalog card
   186 to the custom Homa card, final id 349914 (see phase-2 list).
2. DONE: smoke script (`apps/web/scripts/handwrytten-smoke.mts`)
   verified the key, the 446-card catalog, fonts, and the basket flow
   against the live API. A full test-mode order additionally needs the
   account-level test switch (founder dashboard, optional; the first
   live batch is 3 known addresses, one of them the founder's own).
3. LEFT (HUMAN-TODO): billing check (confirm a credit card on file),
   the copy read-aloud, then after the July 13 conference deploy the
   one switch: `THANK_YOU_CARDS_ENABLED=true` in prod + redeploy.
   Three eligible families queue immediately; everyone else follows
   48h after onboarding.
