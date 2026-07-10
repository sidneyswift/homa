-- Migration #47: verified phone claims (sms-onboarding-plan U2/U7,
-- founder go 2026-07-10 afternoon). Typing a number proves nothing, so
-- pointing it at a family requires possession: a 6-digit code texted to
-- the number, entered on the web, hashed at rest, 10 minutes, 5
-- attempts. Deny-all RLS: only the server lib mints and consumes.

create table if not exists public.phone_claim_codes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint phone_claim_codes_e164_shape check (phone_e164 ~ '^\+1\d{10}$')
);

create index if not exists phone_claim_codes_lookup_idx
  on public.phone_claim_codes (family_id, phone_e164, created_at desc);

alter table public.phone_claim_codes enable row level security;
