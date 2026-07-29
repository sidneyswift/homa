-- Apple in-app purchase entitlement mirror, the App Store analog of the
-- Stripe columns from 20260711200000_family_billing.sql and
-- 20260712210000_founder_console.sql. Deliberately separate columns, not
-- overloaded stripe_* ones: recordFamilySubscription, the webhook's
-- customer-id match, billing-freshness.ts, and familyHasBillingRelationship
-- all assume Stripe semantics. See docs/homa-planning/plans/
-- 2026-07-28-ios-app-store-launch.md ARC F and journeys/10-reconciliation.md
-- section 5 (ios-iap-priority, ios-iap-weekly-pricing, ios-iap-base-tier-only).
--
-- apple_original_transaction_id is the stable identity across renewals and
-- restores (Apple's analog of stripe_customer_id): unique where set, so two
-- families can never claim the same Apple subscription.

alter table public.families
  add column if not exists apple_original_transaction_id text,
  add column if not exists apple_subscription_status text,
  add column if not exists apple_expires_at timestamptz,
  add column if not exists apple_product_id text;

create unique index if not exists families_apple_original_transaction_id_key
  on public.families (apple_original_transaction_id)
  where apple_original_transaction_id is not null;
