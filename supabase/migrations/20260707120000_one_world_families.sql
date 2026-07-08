-- Migration #24: one world (founder ruling 2026-07-07 evening: architect
-- the database as simple as possible BEFORE launch). The funnel columns
-- fold INTO families/children/child_reports, so onboarding writes the
-- product tables from the first tap and the lead world, bridge, and
-- mirror can retire. Pre-signup access stays server-mediated exactly as
-- before (resume cookie hash on the family row, deny-by-default RLS:
-- a family with no member row is reachable by nobody but the server).
-- Applied to homa-prod 2026-07-07 (with a one-time backfill of the two
-- real families from their lead rows, report tokens preserved).

alter table public.families
  add column email text check (email is null or email = lower(email)),
  add column first_name text,
  add column last_name text,
  add column phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+1\d{10}$'),
  add column source text not null default 'organic'
    check (source in ('conference', 'referral', 'organic', 'social', 'other')),
  add column utm jsonb not null default '{}'::jsonb,
  add column status text not null default 'open'
    check (status in ('open', 'complete', 'claimed', 'deleted')),
  add column resume_token_hash text,
  add column link_token_hash text,
  add column reminder_sent_at timestamptz,
  add column context jsonb not null default '{}'::jsonb,
  add column updated_at timestamptz not null default now();

create index families_resume_token_idx on public.families (resume_token_hash)
  where resume_token_hash is not null;
create index families_link_token_idx on public.families (link_token_hash)
  where link_token_hash is not null;
create index families_email_idx on public.families (email) where email is not null;

alter table public.children
  add column context jsonb not null default '{}'::jsonb,
  add column pending_band boolean not null default false,
  add column band_ready_emailed_at timestamptz;

alter table public.child_reports
  add column token text unique,
  add column emailed_at timestamptz,
  add column viewed_at timestamptz,
  add column revoked_at timestamptz;
