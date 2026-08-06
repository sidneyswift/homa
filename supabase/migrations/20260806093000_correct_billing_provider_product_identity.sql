-- The first provider-neutral billing backfill copied a Stripe price ID into
-- provider_product_id. Those identifiers describe different Stripe objects.
-- Clear only the value that can be proven to be the legacy compatibility
-- mirror. A verified Stripe Product ID can be recorded by a provider event.

update public.family_billing_subscriptions as subscription
set provider_product_id = null
from public.families as family
where subscription.family_id = family.id
  and subscription.provider = 'stripe'
  and subscription.provider_product_id = family.stripe_price_id;
