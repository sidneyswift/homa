-- Email suppression list (onboarding-drip compliance, funnel work
-- 2026-07-20). The durable record of who must not receive proactive mail,
-- so the drip (and later any lifecycle email) never contacts an address
-- that unsubscribed, hard-bounced, or complained.
--
-- Keyed by the sha256 hex of the lowercased address, the same to_hash
-- email_sends already stores, so no raw address is kept here. Scope draws
-- the line between marketing and transactional:
--   'drip' : stop proactive nudges only (unsubscribe link, "stop" reply).
--            A parent who asked for their report still gets that report.
--   'all'  : stop every send to this address (hard bounce, spam complaint).
--            Deliverability protection, never overridden by a nudge.
-- The drip checks ('drip','all'); a future transactional guard checks 'all'.
create table if not exists public.email_suppressions (
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  scope text not null check (scope in ('drip', 'all')),
  reason text not null check (char_length(reason) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (email_hash, scope)
);

create index if not exists email_suppressions_created_idx
  on public.email_suppressions (created_at desc);

alter table public.email_suppressions enable row level security;
-- Deny-all: no policies on purpose. Server-only table, written by the
-- unsubscribe route, the Resend bounce/complaint webhook, and the inbound
-- "stop" handler, read by the drip sweep. The same posture as email_sends.
revoke all on table public.email_suppressions from anon, authenticated;
