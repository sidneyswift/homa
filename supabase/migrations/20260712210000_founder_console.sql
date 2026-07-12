-- Migration #73: founder console groundwork (MJ-14 founder dashboard v0;
-- direction lab docs/homa-planning/plans/2026-07-12-founder-dashboard-directions.html,
-- founder instruction 2026-07-12: "do it all"). Additive only, safe to
-- lead the deploy.
--
-- 1. email_sends: the map-flow email ledger. Every transactional email
--    the map flow submits to Resend (report links, resume links, the one
--    24h reminder, retests, band-ready notes, co-parent invites, and the
--    founder digest) gets one row at submit time; the Resend webhook
--    (/api/email/webhook) upgrades rows to delivered/bounced/complained.
--    Task emails (journal, brief, custom) are NOT recorded here: the
--    dispatch channel already owns their receipts in
--    conversation_deliveries, and one send must never count twice.
--    kind stays free text validated by the TypeScript union in
--    apps/web/lib/map/email.ts (the one write path), the model_usage
--    posture, so a new email kind never needs a migration.
--    No raw addresses: to_hash is sha256(lower(address)), the same
--    posture as conversation_deliveries.destination_hash.
--
-- 2. cron_runs: the hourly cron's heartbeat (/api/map/cron writes one
--    row per tick). A dead cron finally looks different from a quiet
--    one: the founder console alarms when the newest row is stale.
--
-- 3. families subscription columns: filled by the Stripe webhook
--    (/api/billing/webhook) so billing truth lives in Postgres, not
--    only in the Stripe dashboard. Nullable and unused by product reads;
--    the wall keeps its trial_started_at/billing_exempt contract.
--
-- Tenancy: both new tables are deny-all (enable RLS, no policies) plus
-- revoked privileges, matching model_usage and thank_you_cards. Only the
-- server connection reads or writes them.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete set null,
  kind text not null check (char_length(kind) between 1 and 40),
  to_hash text not null check (to_hash ~ '^[a-f0-9]{64}$'),
  status text not null
    check (status in ('submitted', 'rejected', 'unknown', 'delivered', 'bounced', 'complained')),
  provider_message_id text,
  error text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_sends_created_idx
  on public.email_sends (created_at desc);
create index if not exists email_sends_family_idx
  on public.email_sends (family_id, created_at desc);
create index if not exists email_sends_kind_created_idx
  on public.email_sends (kind, created_at desc);
-- The webhook's lookup key. Not unique: Resend retries webhooks and a
-- provider id could in theory be reused across environments.
create index if not exists email_sends_provider_idx
  on public.email_sends (provider_message_id)
  where provider_message_id is not null;

alter table public.email_sends enable row level security;
-- Deny-all: no policies on purpose. Server-only table.
revoke all on table public.email_sends from anon, authenticated;

create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null check (char_length(job) between 1 and 40),
  ok boolean not null,
  counts jsonb not null default '{}',
  error text,
  ran_at timestamptz not null default now()
);

create index if not exists cron_runs_job_ran_idx
  on public.cron_runs (job, ran_at desc);

alter table public.cron_runs enable row level security;
-- Deny-all: no policies on purpose. Server-only table.
revoke all on table public.cron_runs from anon, authenticated;

alter table public.families
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists billing_updated_at timestamptz;
