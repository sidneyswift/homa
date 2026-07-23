-- Bounded-attempt state for auto-recovering accepted-but-unfulfilled offers.
-- When a parent accepts a morning-brief offer and the fulfillment turn
-- crashes (the 2026-07-20 Chan drop), the accepted offer has no
-- conversation_offer_fulfillments row. The hourly reaper re-runs the
-- fulfillment on the proactive dispatch rails; the fulfillment ledger's
-- (source_delivery_id) uniqueness makes redelivery impossible, and this
-- table bounds how many times a genuinely-stuck offer is retried so a
-- deterministically-failing fulfillment does not re-dispatch every hour
-- forever. Keyed by the offer's own delivery, one row per offer.
--
-- Server-only, same posture as conversation_offer_fulfillments: the parent
-- sees the resulting artifact, never this recovery bookkeeping.
create table if not exists public.conversation_offer_recovery (
  source_delivery_id uuid primary key
    references public.conversation_deliveries (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  attempts int not null default 0,
  last_attempt_at timestamptz,
  recovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_offer_recovery_family_idx
  on public.conversation_offer_recovery (family_id, created_at desc);

alter table public.conversation_offer_recovery enable row level security;
revoke all on table public.conversation_offer_recovery
  from public, anon, authenticated;
