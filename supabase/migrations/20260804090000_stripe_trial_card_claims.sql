-- A Stripe card fingerprint is a provider-owned, opaque equality signal. It
-- prevents two active Homa trial families from scheduling future charges on
-- the same exact card, without inferring identity from family-entered data.
-- Server-only: a family must never learn whether any other family shares it.

create table if not exists public.stripe_trial_card_claims (
  card_fingerprint text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_trial_card_claims_family_idx
  on public.stripe_trial_card_claims (family_id);

alter table public.stripe_trial_card_claims enable row level security;
revoke all on table public.stripe_trial_card_claims from anon, authenticated;
