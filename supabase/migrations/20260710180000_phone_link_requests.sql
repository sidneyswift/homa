-- Migration #46: phone-link confirmations (sms-onboarding-plan,
-- unknowns pass 2026-07-10 U3). When a text-signup email turns out to
-- belong to an EXISTING family, Homa emails that account a one-time
-- link; clicking it proves inbox possession, folds the text stub into
-- the real family, and links the number. Deny-all RLS: only the mint
-- (signup email path) and consume (link-phone route) touch it.

create table if not exists public.phone_link_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  phone_e164 text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint phone_link_requests_e164_shape check (phone_e164 ~ '^\+1\d{10}$')
);

alter table public.phone_link_requests enable row level security;
