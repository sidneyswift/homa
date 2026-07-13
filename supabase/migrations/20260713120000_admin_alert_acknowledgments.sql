-- Migration #81: admin_alert_acknowledgments, the founder console's
-- "mark handled" record (founder ask 2026-07-13: alerts that were
-- already dealt with kept sitting on /admin with no way to check them
-- off). Additive only, safe to lead the deploy.
--
-- One row per alert the founder marked handled. source + source_id
-- point at the row the alert was built from (homa_task_runs,
-- conversation_deliveries, or email_sends). No foreign keys on
-- purpose: the target table varies by source, and a cascade-deleted
-- source row just leaves a harmless orphan here that no query ever
-- joins back to. Acknowledging hides the alert strip row and the
-- trouble-list line; the overview tiles keep counting the underlying
-- failures either way, handled is not erased.
--
-- Tenancy: deny-all (enable RLS, no policies) plus revoked privileges,
-- matching email_sends and cron_runs. Only the server connection reads
-- or writes, and the /admin server action behind it sits behind the
-- founder gate.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.admin_alert_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  source text not null
    check (source in ('task_run', 'delivery', 'email_send')),
  source_id uuid not null,
  acknowledged_by text not null
    check (char_length(acknowledged_by) between 3 and 320),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

alter table public.admin_alert_acknowledgments enable row level security;
-- Deny-all: no policies on purpose. Server-only table.
revoke all on table public.admin_alert_acknowledgments from anon, authenticated;
