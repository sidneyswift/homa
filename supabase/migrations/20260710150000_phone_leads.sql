-- Migration #42: phone-first leads (lead-funnel-plan.md LF-1, founder
-- ask 2026-07-10 morning). A stranger who texts or calls the Homa
-- number leaves a lead row the moment she makes contact; the concierge
-- flow enriches it (name, email, invited) and the phone bridge flips it
-- converted when her number links to a real family.
--
-- Deny-all RLS on purpose: only server-side code (the SMS channel, the
-- voice context webhook, the capture_lead tool's guarded lib) touches
-- these rows. One row per number; the number is the identity.

create table if not exists public.phone_leads (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  first_channel text not null check (first_channel in ('sms', 'voice')),
  status text not null default 'new'
    check (status in ('new', 'engaged', 'invited', 'converted')),
  name text,
  email text,
  note text,
  contact_count integer not null default 1,
  last_contact_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint phone_leads_e164_shape check (phone_e164 ~ '^\+1\d{10}$'),
  constraint phone_leads_number_key unique (phone_e164),
  constraint phone_leads_email_lowercase check (email is null or email = lower(email))
);

alter table public.phone_leads enable row level security;
