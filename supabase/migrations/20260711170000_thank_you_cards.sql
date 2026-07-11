-- Migration #54: thank-you cards (plans/2026-07-11-thank-you-cards.md, founder "do it"
-- 2026-07-11). One physical handwritten card per family, ever, written
-- by a robot with a real pen (Handwrytten) after web onboarding
-- completes and 48 quiet hours pass.
--
-- thank_you_cards is the outbox. The hourly cron enqueues eligible
-- families in one pass and spends money in a second pass, so a row
-- always exists before an order does. The unique family_id IS the
-- idempotency guarantee: one card per family, enforced by the schema,
-- not by job timing. Recipient fields are a snapshot taken at queue
-- time, so a later address edit never redirects a card already being
-- written.
--
-- Isolation posture: deny-all RLS, exactly like family_phones and
-- phone_leads. The table holds mailing addresses, so no Data API role
-- has any policy; the server connection (lib/map/db.ts) is the only
-- door. Additive-only, safe to lead the deploy (deploy law).
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.thank_you_cards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families (id) on delete cascade,
  -- Recipient snapshot at queue time (the families row can change later).
  recipient_first_name text not null,
  recipient_last_name text not null default '',
  address_line text not null,
  address_city text not null,
  us_state text not null,
  address_zip text not null,
  -- The exact words the pen writes, kept for the audit trail.
  message text not null,
  status text not null default 'queued'
    constraint thank_you_cards_status_check
    check (status in ('queued', 'sending', 'sent', 'mailed', 'failed', 'skipped')),
  vendor text not null default 'handwrytten',
  vendor_order_id text,
  attempts smallint not null default 0,
  error text,
  processing_started_at timestamptz,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  mailed_at timestamptz
);

alter table public.thank_you_cards
  add column if not exists processing_started_at timestamptz;

alter table public.thank_you_cards
  drop constraint if exists thank_you_cards_status_check;

alter table public.thank_you_cards
  add constraint thank_you_cards_status_check
  check (status in ('queued', 'sending', 'sent', 'mailed', 'failed', 'skipped'));

-- The three statuses the cron scans for; finished rows fall out.
drop index if exists thank_you_cards_active_idx;
create index if not exists thank_you_cards_active_idx
  on public.thank_you_cards (status, queued_at)
  where status in ('queued', 'sending', 'sent');

alter table public.thank_you_cards enable row level security;
-- Deny-all: no policies on purpose. Server-only table.
revoke all on table public.thank_you_cards from anon, authenticated;
