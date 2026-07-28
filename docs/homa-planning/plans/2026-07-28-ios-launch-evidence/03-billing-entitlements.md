# Billing and entitlements today, and the iOS payment path

Reader report for the iOS App Store launch planning fleet. All paths relative to the repo root
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-chat-onboarding-testing-10c9c1` unless absolute.

## 1. Architecture in one paragraph

Homa has no server-created Stripe Checkout sessions and no separate subscriptions or entitlements table. Checkout is Stripe Payment Links (dashboard-created URLs in env vars); the entitlement is a handful of columns on `public.families`; access is computed by pure functions in `apps/web/lib/billing/wall.ts` at every gate; billing truth flows in through two paths (the browser redirect `GET /api/billing/confirm` and the Stripe webhook `POST /api/billing/webhook`) that both write the same families-row mirror. Everything fails open by design: a missing env var or a DB read error opens the doors, never locks a family out.

## 2. Stripe products and prices in code

- Checkout URLs: 12 `NEXT_PUBLIC_STRIPE_{LIVE|TEST}_PAYMENT_LINK_{|PLUS_|ELITE_}{MONTHLY|ANNUAL}_URL` env vars, read as literal accesses in `tierPaymentLinkBases()` (`apps/web/lib/billing/wall.ts:75-102`). LIVE falls through to TEST with `||`. If the regular tier's monthly link is missing the entire wall/gate downs itself (fail open); a missing plus/elite link just hides that tier. Declared in `apps/web/.env.example:213-224`.
- The family id rides as `client_reference_id` and email as `prefilled_email`, appended to the Payment Link URL (`wall.ts:128-135`, `checkoutUrl`).
- Tiers and display prices: `regular` "Homa" $19/mo $182/yr, `plus` "Homa Plus" $49/mo $470/yr, `elite` "Homa Max" $199/mo $1,910/yr, annual = 20% off monthly x 12 (`apps/web/components/billing/wall-copy.ts:119-140`, `TIER_NAMES`, `TIER_PRICES`). These numbers are display copy only; the charged price lives on the Payment Link in the Stripe dashboard, and the comment at `wall-copy.ts:24-29` says to change them together.
- The 7-day trial length is configured ON the Payment Links in the Stripe dashboard, not in code. Code assumes it in copy ("your 7 free days") and in the admin freshness window (`TRIAL_WINDOW_MS` = 8 days, `apps/web/lib/admin/billing-freshness.ts:26`).
- Product-to-tier mapping for read-back only: `TIER_PRODUCT_IDS` (`wall.ts:111-115`) holds live+test Stripe Product id pairs per tier (`prod_Uq02Zo8DUidRnH`/`prod_Uq01TGhJROfVQ5` regular, `prod_Uq3Syk3GadgBVg`/`prod_Uq3StPBgPdzwMX` plus, `prod_Ux4oRdW3a7ug6H`/`prod_Ux4pENEFJNpBt5` elite). `tierForStripeProduct()` defaults unrecognized ids to `regular` so an unmapped product can never over-grant (`wall.ts:120-126`).
- SDK: `stripe` `^22.3.0` (`apps/web/package.json:41`). Secret keys `STRIPE_LIVE_SECRET_KEY || STRIPE_TEST_SECRET_KEY` (`.env.example:91-92`), webhook secret `STRIPE_WEBHOOK_SECRET` (`.env.example:243`, webhook is dark until set).

## 3. Checkout, confirm, webhook

### Checkout
The tier picker (`apps/web/components/billing/tier-options.tsx`) renders plain `<a href>` links to the Payment Link URLs; there is no `stripe.checkout.sessions.create` anywhere in the codebase (verified by grep). A `checkout_started` analytics beacon fires through `POST /api/billing/beacon` (`apps/web/app/api/billing/beacon/route.ts`), which resolves family from auth, re-scopes any child id, and computes `walled` server-side.

### Confirm (the unlock path)
`GET /api/billing/confirm?session_id=...` (`apps/web/app/api/billing/confirm/route.ts`) is the Payment Link after-completion redirect:
1. `requireFamily()`; unauthenticated users bounce via `/signin?next=...`.
2. Retrieves the checkout session with the secret key, `expand: line_items.data.price.product, subscription`.
3. Rejects unless `session.status === "complete"` AND `session.client_reference_id === family.id` (tenancy law: a pasted confirmation URL cannot unlock another family, `route.ts:90-97`).
4. `startFamilyTrial(family.id, customerId, tier)` stamps `trial_started_at` once (idempotent `coalesce`), pins `stripe_customer_id`, and sets `plan_tier` to the tier just bought on every call (upgrades win; `wall.ts:555-580`). First stamp emits `billing.trial_started`.
5. Stamps the subscription mirror from the verified session itself via `recordFamilySubscription` (`wall.ts:463-489`), because the webhook's customer-id match misses a re-subscribing family whose fresh checkout minted a NEW Stripe customer (`route.ts:109-121`).
6. Redirects to `/app`, or to the child report `?welcome=1` if the short-lived `homa_trial_child` cookie names one of this family's children.

### Webhook (the safety net and lifecycle record)
`POST /api/billing/webhook` (`apps/web/app/api/billing/webhook/route.ts`), signature-verified, handles:
- `checkout.session.completed`: `startFamilyTrial(familyId, customerId)` with `tier = null` so a late webhook never downgrades a Plus/Max purchase recorded by confirm (`wall.ts:548-554`); also stamps the mirror by family id (`route.ts:84-101`).
- `customer.subscription.created|updated|deleted`: mirrors `stripe_subscription_id`, `stripe_subscription_status`, `stripe_price_id`, `stripe_current_period_end`, `billing_updated_at` onto the families row matched by `stripe_customer_id` (`route.ts:173-192`).
- `customer.subscription.trial_will_end` (fires 3 days before trial end): the Day 4 reminder email, verdict logic pure in `apps/web/lib/billing/trial-reminder.ts` (skips no-email, not-trialing, cancel-at-period-end, billing_exempt, already-sent), amounts and dates read from the Stripe payload never a local price table, dedup via a send ledger (`trialReminderAlreadySent`). Unknown send failures 500 so Stripe retries.
- Unknown families and event types are acknowledged, never retried.

### Portal
`GET /api/billing/portal` (`apps/web/app/api/billing/portal/route.ts`) creates a Stripe billing portal session for the family's own `stripe_customer_id` (cancel at period end, config `bpc_1TwzCzGnIMAiH0MJSR1Hwi8w`, `apps/web/lib/billing/portal.ts`). `familyHasBillingRelationship()` keys on `stripe_customer_id IS NOT NULL` (`portal.ts:34-36`), which matters for iOS: an Apple-paid family would read as having no billing relationship.

## 4. The entitlement model

### Tables
Everything is columns on `public.families`; there is no subscriptions table:
- `trial_started_at timestamptz`, `billing_exempt boolean default false`, `stripe_customer_id text` (`supabase/migrations/20260711200000_family_billing.sql`).
- `stripe_subscription_id`, `stripe_subscription_status`, `stripe_price_id`, `stripe_current_period_end`, `billing_updated_at` (`supabase/migrations/20260712210000_founder_console.sql:83-87`).
- `plan_tier text not null default 'regular' check in ('regular','plus','elite')` (`supabase/migrations/20260725040000_family_plan_tier.sql`).

### Two gates, one decision module
`apps/web/lib/billing/wall.ts` owns both:

1. **The door wall** (`HOMA_WALL_ENABLED`, live in prod since 2026-07-18): `familyWallCheckout(familyId)` returns null (open) or a `WallCheckout` of Payment Link URLs. Exemptions are ordered and pure (`wallExemption`, `wall.ts:176-188`): `billing_exempt` > `trial_started` > active onboarding. Wired at the action doors: plan consent, subject-lesson build/retry, lesson record, voice curriculum start, and the report lock (callers listed below).

2. **The account gate / signup paywall** (`HOMA_SIGNUP_PAYWALL_ENABLED`, FLIPPED ON in prod 2026-07-28 per memory): `accountAccessDecision(row, sinceMs)` (`wall.ts:352-365`) grants, in order:
   - `billing_exempt` (founder comp switch, outranks everything),
   - `grandfathered`: `families.created_at < HOMA_SIGNUP_PAYWALL_SINCE` (unparseable or unset SINCE = no grandfathering cutoff, i.e. gate everyone non-exempt; `signupPaywallSince()`, `wall.ts:328-337`),
   - `trial`: `trial_started_at` set AND mirrored `stripe_subscription_status` not in `LAPSED_SUBSCRIPTION_STATUSES = {canceled, unpaid, incomplete_expired, paused}` (`wall.ts:301-306`). `past_due` stays OPEN (dunning is Stripe's job), and `null` status reads as fine, never lapsed.
   There is deliberately NO onboarding exemption at the account gate. The account gate also outranks every door-wall exemption inside `familyWallCheckout` (`wall.ts:239-258`).

### Enforcement points
- `/app` admission: `apps/web/lib/app-data.ts:56` returns null for walled accounts, layout forwards to `/onboarding/trial`.
- `/onboarding` router: `apps/web/app/onboarding/page.tsx:70` sends `has_account` families through `/onboarding/trial`.
- The gate page itself: `apps/web/app/onboarding/trial/page.tsx` (server-decided every visit; entitled families redirect out; `lapsed` families get returning-member copy plus the portal link).
- JSON APIs: `/api/map/answer:55`, `/api/map/score:50`, `/api/map/children:27` all check `familyAccountCheckout`.
- **Chat turn admission** (`apps/web/agent/channels/eve.ts:178-205`): the gate holds at the eve channel because proxy page gating never sees it "and the mobile app mounts it directly". A walled family's turn gets `familyId` DELETED from session attributes (`accountWalled: "true"` added), so every family tool refuses deterministically, and the model is instructed to warmly point to thankshoma.com/onboarding.
- SMS signup: `textSignupPaywalled()` (`apps/web/lib/signup-session.ts:28-31`) hard-refuses text signup while the flag is on, steering to the web trial.

### What happens at trial end (issue #274)
**Nothing in Homa's code expires a trial.** The 7-day boundary is enforced only by Stripe charging the card; entitlement ends only when the webhook mirrors a lapsed status. Issue #274 (OPEN, `bug`, `P2`, title "Trial entitlement has no expiry of its own: access ends only when Stripe says so"):
- `accountAccessDecision` has no elapsed-time check; a family keeps access indefinitely unless `stripe_subscription_status` turns lapsed.
- The mirror is written only by the webhook; a dark webhook (wrong secret, endpoint disabled) means lapsed families keep access forever, silently.
- A time clock was deliberately NOT added: the `trialing -> active` transition arrives only via `customer.subscription.updated`, and if that one event is missed a clock would lock out a PAYING family, the worse failure. When filed, 0 of 206 families carried any Stripe data.
- Intended fix: a reconciliation cron that re-reads Stripe when the mirror looks stale, not a clock.
- Shipped mitigation: the admin billing-freshness panel (`apps/web/lib/admin/billing-freshness.ts`, commit cad6349c) surfaces stale payers (paying status but `stripe_current_period_end` more than 2 days past), trials older than 8 days with no subscription recorded, and a last-webhook-write heartbeat.

**Any iOS design inherits this exact gap for Apple**: an Apple-side mirror kept fresh only by App Store Server Notifications has the same dark-webhook failure mode, so the #274 reconciliation cron should be designed provider-generic from day one.

## 5. The wall and the four-open-subjects report lock

- `HOMA_REPORT_LOCK_ENABLED` requires `HOMA_WALL_ENABLED` (`reportLockEnabled()`, `wall.ts:38-41`). Both live in prod since 2026-07-18; kill test armed through 2026-08-01.
- Policy is pure and shared: `freeReportSubjects()` in `packages/core/src/map/report-lock.ts:44-61`. A walled family's report renders exactly `REPORT_LOCK_FREE_COUNT = 4` subjects open: the fixed core (`math`, `literacy`, `science`, `social_emotional`), slots backfilled from `strengthOrder` when a core subject is unmapped. Only mapped subjects lock; a report with 4 or fewer mapped subjects renders fully open. Founder-ruled fixed core, never strongest-four (anti-guilt law).
- Applied where reports render: `apps/web/app/app/[childId]/report/page.tsx:61-62,149-151` and the tokenized share view `apps/web/app/onboarding/r/[token]/page.tsx:177`. A shared-token viewer without this family's session gets locked rows and a sign-in line but never another family's checkout (`ReportLock.checkout: null`, `apps/web/lib/billing/wall-types.ts:48-51`).
- Note the sequencing: for families created after the SINCE cutoff the signup paywall means no report exists before a card, so the report lock now mostly serves pre-gate families (`wall.ts:14-18` comment).

## 6. Mobile today: zero payment code

- Grep for RevenueCat / StoreKit / IAP / in-app purchase across `apps/`, `packages/`, `docs/`: **no hits at all** (the only matches were `ariaPressed` and curriculum text). `apps/mobile/package.json` has no purchases SDK (no `react-native-purchases`, no `expo-in-app-purchases`).
- The mobile app talks to Supabase for auth and mounts the eve chat channel at `EXPO_PUBLIC_API_URL` directly (`apps/mobile/src/lib/env.ts`), so a walled family on iOS is gated at chat-turn admission (`eve.ts:184`) and the agent tells her to go to thankshoma.com/onboarding.
- Mobile's only billing-adjacent surface is `openWebOnboarding()` = `Linking.openURL(<apiUrl>/onboarding)` (`apps/mobile/src/lib/web-links.ts:10-12`), used from `src/app/(auth)/signin.tsx:228`, `(tabs)/chat.tsx:96`, `(tabs)/family.tsx:94`, `(tabs)/index.tsx:79`.
- **App Store risk, flag loudly**: with the signup paywall ON, a new iOS user's only path to a usable account is an external Safari link to a Stripe Payment Link, and the in-app agent verbally steers there. That is squarely Apple guideline 3.1.1 territory (digital-goods subscription purchased outside IAP, with in-app steering). The 2025 US external-purchase-link entitlement narrows this in the US storefront, but the current flow (agent prose plus `Linking.openURL` buttons with no entitlement, no required disclosure sheet) was not designed for it. Review should assume rejection risk until a deliberate choice is made: IAP, compliant external link (US only), or a fully quiet reader-app-style posture.

## 7. Designing the iOS payment path

### What an Apple purchase must produce
Stripe checkout today produces exactly three durable facts on `families`:
1. `trial_started_at` stamped once (the unlock; idempotent; fires `billing.trial_started`, registered in `packages/core/src/events.ts:1083`),
2. `plan_tier` set from the purchased product,
3. a subscription mirror whose status can later turn lapsed (what ends access).

An Apple IAP path must produce the same three, or `accountAccessDecision` cannot see it.

### Server pieces needed (minimal-change design)

1. **Schema (additive migration, safe to lead deploy per repo law):** add to `public.families`:
   - `apple_original_transaction_id text` (unique where not null; the Apple analog of `stripe_customer_id`, stable across renewals and restores),
   - `apple_subscription_status text` (normalize App Store states to the same vocabulary the LAPSED set uses, or keep Apple-native and map in code),
   - `apple_expires_at timestamptz` (the analog of `stripe_current_period_end`),
   - `apple_product_id text`, and reuse `billing_updated_at` as the shared heartbeat (or add `apple_billing_updated_at` so the admin freshness panel can tell providers apart).
   Do NOT overload the `stripe_*` columns: `recordFamilySubscription`, the webhook's customer-id match, `billing-freshness.ts`, and `familyHasBillingRelationship` all assume Stripe semantics.

2. **A gate-status endpoint for the iOS client.** Today there is no JSON answer to "is this account walled": the gate expresses itself as page redirects and eve-turn behavior. iOS needs `GET /api/billing/gate` returning `{open, lapsed, planTier}` from `familyAccountGate()` so the app knows whether to show the paywall at all. This is also the double-subscribe guard (below).

3. **A confirm analog: `POST /api/billing/apple/confirm`.** Authenticated with `requireFamily()`; the body carries the StoreKit 2 signed transaction JWS (or the RevenueCat CustomerInfo). The server verifies against Apple's App Store Server API (or RevenueCat's REST API), NEVER trusting client-decoded fields; maps `productId -> PlanTier` via an `APPLE_PRODUCT_TIER` map mirroring `TIER_PRODUCT_IDS`'s never-over-grant default; then calls the existing `startFamilyTrial(family.id, null, tier)` (it already tolerates a null Stripe customer id, `wall.ts:571`) and stamps the Apple mirror. Emit the same `billing.trial_started` event so funnels stay comparable (`pnpm check:events` guards registry parity).
   - Invariant carried over from confirm: set StoreKit's `appAccountToken` (or RevenueCat `app_user_id`) at purchase time to the Supabase user id, and verify it server-side against the authenticated session, exactly the role `client_reference_id` plays today (`confirm/route.ts:91`). The authenticated session is the authority; the token is the cross-check. `familyId` never comes from the request body (tenancy law, `AGENTS.md`).

4. **A webhook analog: `POST /api/billing/apple/webhook`** for App Store Server Notifications V2 (or RevenueCat webhooks): verify the signed payload, match the family by `apple_original_transaction_id`, mirror status and `expiresDate`. This is the only way renewals, cancellations, refunds, billing retry, and family-sharing revocations reach the DB, the exact role `customer.subscription.*` plays today. Idempotent updates, acknowledge unknown transactions, 500 only for retryable work, matching the Stripe webhook's posture.

5. **Extend `accountAccessDecision` to two providers.** The subtlety: today `null` status means fine, and lapsed means walled. With two providers the rule must be per-provider, not global, or a family with a lapsed Stripe sub who re-subscribed on iOS stays walled (the exact bug class `recordFamilySubscription` exists to prevent within Stripe, `wall.ts:451-462`). Correct shape: compute `stripeLapsed` and `appleLapsed` independently; the account is open on `trial` when `trial_started_at` is set AND at least one provider is non-lapsed, where a provider with no record at all counts as non-lapsed ONLY if the other provider has no record either (i.e., walled requires: every provider that has ever recorded a subscription for this family reads lapsed). Keep it a pure function with table-driven tests like `account-access.test.ts`.

6. **Portal and settings split.** `familyHasBillingRelationship` (`portal.ts:34`) must become provider-aware; Apple subscribers get a "Manage in the App Store" link (`https://apps.apple.com/account/subscriptions`), never the Stripe portal, and web settings must not offer Stripe cancel for an Apple sub. The trial reminder is Stripe-driven (`trial_will_end` webhook); Apple's own commerce emails partially cover the disclosure duty, but the Day 4 promise in `TRIAL_GATE_TIMELINE` copy would silently not apply to Apple trials unless a scheduled job replicates it.

### Double-subscribe risk and reconciliation
- **Prevention, iOS side:** the app must call the gate endpoint before ever showing purchase UI; an entitled family (Stripe active, grandfathered, or exempt) sees no paywall. This mirrors how `/onboarding/trial` redirects entitled families away on web (`trial/page.tsx:47`).
- **Prevention, web side:** comes free once `accountAccessDecision` is two-provider, because every web gate already redirects entitled families away from checkout.
- **Residual races** (both flows open at once on two devices) are acceptable at current scale; the recovery is a refund through whichever portal, and the admin freshness panel should count families with BOTH a non-lapsed Stripe status and a non-lapsed Apple status as a visible anomaly (one query, same pattern as `stalePayers`).
- **Reconciliation:** build the #274 cron provider-generic: for stale Stripe mirrors query the Stripe API; for stale Apple mirrors query the App Store Server API `subscriptions` endpoint by `originalTransactionId`. Same law: reconciliation may never wall a family whose provider says active or trialing.

### RevenueCat vs bare StoreKit 2
- **Bare StoreKit 2 + App Store Server API** fits this codebase's grain: hand-rolled, no new vendor, two new routes that structurally mirror the two Stripe routes, roughly the same amount of code as `confirm` + `webhook`. Requires managing Apple's JWS verification and the server API keys.
- **RevenueCat** would give receipt validation, restore handling, and a single webhook for less client code, and could even ingest the existing Stripe subscriptions to become the one entitlement source. But that last step double-writes the mirror unless the hand-rolled Stripe webhook writes are retired, which is NOT minimal change; and a partial adoption (RevenueCat for Apple only) still needs every server piece above, just with RevenueCat's webhook shapes instead of Apple's. Given the repo already owns a working Stripe pipeline and the founder rulings prize deterministic self-owned billing writes, bare StoreKit 2 is the smaller diff; RevenueCat pays off mainly if Android or heavy paywall experimentation is coming.

### Pricing and product setup facts the PM needs
- Apple products must be created for the tiers sold on iOS ($19/$49/$199 monthly, optional annual at the ruled 20% discount) with a 7-day free-trial introductory offer so the "your 7 free days" copy vocabulary (`wall-copy.ts`) stays true verbatim.
- `tierForStripeProduct`'s never-over-grant default must be replicated: an unknown Apple product id maps to `regular`.
- Apple's commission changes unit economics on the $199 Max tier most; worth a founder pricing ruling before products are filed.
- All paywall copy on iOS falls under the recorded claims laws (no testimonials/ratings/counts; charge terms in visual proximity to the button per ROSCA/CA ARL, see memory `homa-paywall-claims-laws`), and Apple's own subscription sheet handles part of that disclosure.

## 8. Existing IAP/RevenueCat/App Store code

None. Verified by grep across `apps/`, `packages/`, and `docs/` for `revenuecat`, `storekit`, `in-app purchase`, `react-native-purchases`, `expo-in-app-purchases`: zero relevant hits. The mobile release memory (PR #72, build fb45d812) covers SIWA + Google sign-in only. Every server piece in section 7 is greenfield.

## 9. Flag and env inventory (billing)

| Var | Role | Where read |
|---|---|---|
| `HOMA_WALL_ENABLED` | door wall master flag (ON in prod since 07-18) | `wall.ts:26-29` |
| `HOMA_REPORT_LOCK_ENABLED` | four-open-subjects report lock, requires wall (ON since 07-18) | `wall.ts:38-41` |
| `HOMA_SIGNUP_PAYWALL_ENABLED` | account gate (ON in prod 2026-07-28) | `wall.ts:58-61`, duplicated in `signup-session.ts:28-31` |
| `HOMA_SIGNUP_PAYWALL_SINCE` | grandfather cutoff instant; unset = gate everyone non-exempt; unparseable = ignored | `wall.ts:328-337` |
| `NEXT_PUBLIC_STRIPE_{LIVE,TEST}_PAYMENT_LINK_*_URL` | the 12 checkout URLs | `wall.ts:75-102` |
| `STRIPE_LIVE_SECRET_KEY` / `STRIPE_TEST_SECRET_KEY` | confirm, webhook, portal (`\|\|` fallback) | `confirm/route.ts:79`, `webhook/route.ts:46`, `portal.ts:20` |
| `STRIPE_WEBHOOK_SECRET` | webhook dark until set | `webhook/route.ts:43` |

Beware the two recorded traps when probing prod: `vercel env pull` blanks Sensitive values (an empty value is not evidence a flag is off), and turbo strict-env once filtered `HOMA_*` flags out of builds entirely (memory `turbo-strict-env-build-trap`).
