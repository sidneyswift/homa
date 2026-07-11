# Thank-you cards · one robot-handwritten card per family

> Status: BUILT 2026-07-11 (founder "do it" after the deep-research
> pass, same session). Code, migration, copy, and guards are all in;
> the feature is DARK behind THANK_YOU_CARDS_ENABLED and stays dark
> until the founder finishes the Handwrytten account steps in
> HUMAN-TODO. Nothing here should deploy before the July 13 conference
> deploy is out; the migration already sits in prod (additive, empty
> table) via MCP, per the deploy law.

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

## The card (final copy, gates passed)

> Hi {firstName},
>
> Thank you for trying Homa. Teaching your kids at home is generous
> work.
>
> You shared this address when you set up your family, so I wanted to
> send a real card. Homa is one text away whenever you want a hand.
>
> Warmly,
> Sidney, founder of Homa

Gate findings that shaped it: gratitude sized to "trying" (bigger
claims read as guilt in week one), the address sentence answers the
"how do they know where we live" flinch before it forms, "Homa is one
text away" names the product so the card never overpromises a person,
contractions because uncontracted phrasing reads as a copied script.

## What is NOT in scope (phase 2 candidates)

- The agent asking SMS-signup families for an address (opt-in).
- An address card in Settings (no post-onboarding edit UI exists).
- Custom Homa stationery via the customCards API, design-system art.
- Founder handwriting digitization.
- Milestone cards (first report, 100th day) as a tasks-framework kind.
- A do-not-mail flag surfaced in Settings; today support is manual
  (insert a skipped row for the family, which blocks the queue row).

## Founder switch order (mirrors HUMAN-TODO; steps 1-2 DONE 2026-07-11 1am)

1. DONE: account + API key (founder), return address saved via the
   address-book API (order placement requires one on file), card 186
   "Kraft Thank You" + font hwDavid "Casual David" chosen, five env
   vars set in Vercel production (key encrypted,
   HANDWRYTTEN_TEST_MODE="false" so the sweep may run when enabled).
   .env.local carries the same with test mode forced for dev.
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
