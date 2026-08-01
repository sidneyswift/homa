# Unified cross-platform billing

Status: BUILT IN CODE, NOT COMMERCIALLY ACTIVATED

## Founder ruling

A family buys one Homa membership, not a web membership or a phone
membership. A Stripe subscription, an App Store subscription, and a future
Google Play subscription unlock the same Homa surfaces for that family. The
payment provider owns collection and cancellation for its own purchase, while
Homa owns access, plan tier, and product telemetry across every surface.

The public catalog is one set of six offers:

| Homa plan | Monthly | Annual, 20% off twelve monthly payments |
| --- | ---: | ---: |
| Homa | $19 | $182 |
| Homa Plus | $49 | $470 |
| Homa Max | $199 | $1,910 |

Weekly language is presentation math only. For example, $19 monthly can read
as about $4.38 a week, billed monthly. There is no weekly SKU, no weekly
receipt, and no weekly entitlement. This prevents a web customer and an iOS
customer from buying apparently different products for the same plan.

## Collection rails

- Web: Stripe Checkout and Stripe's customer portal.
- iOS: StoreKit auto-renewable subscriptions and Apple subscription
  management.
- Android, reserved but not yet built: Google Play Billing and Google Play
  subscription management.

The native app must not embed a Stripe card form or send a parent to web
checkout to unlock digital Homa access. StoreKit is the iOS purchase path.
Existing Stripe subscribers simply sign into the native app and never see the
StoreKit paywall. Existing Apple subscribers sign into web and never see a
Stripe action gate.

## Canonical entitlement model

`family_billing_subscriptions` is the provider-neutral subscription ledger.
Its stable identity is `(provider, provider_subscription_id)`, and every row
is scoped to one `family_id`. It records:

- provider: `stripe`, `apple`, or future `google`
- the immutable provider product id
- Homa plan tier and renewal term
- normalized status, renewal end, and last verified observation

The historical `families.stripe_*` and `families.apple_*` columns remain
compatibility mirrors during rollout. New verified Stripe and Apple events
write both places. The migration backfills existing mirrors without guessing a
renewal term from historic price ids. Reads use the ledger when it exists and
fall back to mirrors only while the additive migration is unavailable.

No client chooses a family, a tier, or an entitlement. Stripe webhooks and
Apple signed transactions are verified server-side, then their immutable
product ids map through `packages/core/src/billing-catalog.ts`.

## App Store Connect configuration required before sale

The existing subscription group can remain. Do not create the temporary
`com.thankshoma.homa.regular.weekly` product. Create these six products in the
group instead:

| App Store product id | Homa plan | Term |
| --- | --- | --- |
| `com.thankshoma.homa.regular.monthly` | Homa | monthly |
| `com.thankshoma.homa.regular.annual` | Homa | annual |
| `com.thankshoma.homa.plus.monthly` | Homa Plus | monthly |
| `com.thankshoma.homa.plus.annual` | Homa Plus | annual |
| `com.thankshoma.homa.elite.monthly` | Homa Max | monthly |
| `com.thankshoma.homa.elite.annual` | Homa Max | annual |

Monthly and annual products for the same plan share an App Store subscription
level. Homa Plus sits above Homa, and Homa Max sits above Homa Plus. Configure
the seven-day introductory offer and the intended prices in App Store Connect.
The first group must be submitted with the new app version that contains this
paywall.

## Release order and acceptance

1. Apply the additive ledger migration before deploying code that depends on
   it.
2. Deploy the server and shared catalog. Verify a legacy Stripe subscriber
   appears in the backfilled ledger and continues to open web and mobile.
3. Build a new iOS archive containing the six-product StoreKit paywall. OTA
   delivery alone is not sufficient for the first App Review submission.
4. Configure the six App Store products, App Store Server Notifications V2,
   and Sandbox Testers.
5. In Sandbox, buy one monthly and one annual test subscription on separate
   families, restore each, and verify the same Homa plan on native and web.
6. Cancel and renew each case. Confirm iOS settings opens Apple's management
   screen, while a Stripe family is sent to Homa's web account page.
7. Before Android ships, register the same six ids and add a Google Play
   verifier plus Real-time Developer Notifications adapter. No Android
   entitlement is granted merely because a Google product id was reserved.

## Evidence in this implementation

- Shared catalog: `packages/core/src/billing-catalog.ts`
- Canonical ledger: `apps/web/lib/billing/entitlements.ts`
- Additive backfill: `supabase/migrations/20260801110000_family_billing_subscriptions.sql`
- Native StoreKit plan and term selection: `apps/mobile/src/components/billing-gate.tsx`
- Provider-appropriate management routing: `apps/mobile/src/app/settings.tsx`
