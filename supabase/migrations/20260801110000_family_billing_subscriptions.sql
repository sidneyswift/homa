-- One provider-neutral subscription ledger for Homa membership. Stripe,
-- App Store, and future Google Play subscriptions all resolve into the same
-- tier and term, so a family can use every Homa surface without a duplicate
-- purchase. The provider-specific families columns stay as compatibility
-- mirrors while all readers move to this ledger.

create table if not exists public.family_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'apple', 'google')),
  provider_subscription_id text not null,
  provider_customer_id text,
  provider_product_id text,
  plan_tier text not null default 'regular'
    check (plan_tier in ('regular', 'plus', 'elite')),
  billing_period text check (billing_period in ('monthly', 'annual')),
  status text not null,
  current_period_end timestamptz,
  last_observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index if not exists family_billing_subscriptions_family_observed_idx
  on public.family_billing_subscriptions (family_id, last_observed_at desc);

create index if not exists family_billing_subscriptions_provider_customer_idx
  on public.family_billing_subscriptions (provider, provider_customer_id)
  where provider_customer_id is not null;

alter table public.family_billing_subscriptions enable row level security;
revoke all on table public.family_billing_subscriptions from anon, authenticated;

-- Preserve every already-recorded paid family. Term is intentionally null for
-- historic mirrors because a product or price id alone is not authoritative
-- enough to infer the renewal cadence.
insert into public.family_billing_subscriptions (
  family_id, provider, provider_subscription_id, provider_customer_id,
  provider_product_id, plan_tier, billing_period, status,
  current_period_end, last_observed_at
)
select
  id, 'stripe', stripe_subscription_id, stripe_customer_id, stripe_price_id,
  plan_tier, null, coalesce(stripe_subscription_status, 'active'),
  stripe_current_period_end, coalesce(billing_updated_at, now())
from public.families
where stripe_subscription_id is not null
on conflict (provider, provider_subscription_id) do update
  set provider_customer_id = excluded.provider_customer_id,
      provider_product_id = excluded.provider_product_id,
      plan_tier = excluded.plan_tier,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      last_observed_at = excluded.last_observed_at,
      updated_at = now();

insert into public.family_billing_subscriptions (
  family_id, provider, provider_subscription_id, provider_customer_id,
  provider_product_id, plan_tier, billing_period, status,
  current_period_end, last_observed_at
)
select
  id, 'apple', apple_original_transaction_id, null, apple_product_id,
  plan_tier, null, coalesce(apple_subscription_status, 'active'),
  apple_expires_at, coalesce(billing_updated_at, now())
from public.families
where apple_original_transaction_id is not null
on conflict (provider, provider_subscription_id) do update
  set provider_product_id = excluded.provider_product_id,
      plan_tier = excluded.plan_tier,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      last_observed_at = excluded.last_observed_at,
      updated_at = now();
