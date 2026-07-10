-- Migration #39: gateway groundwork (docs/homa-planning/gateway-plan.md
-- GW-2, founder direction 2026-07-09 evening).
--
-- 1. journal_opt_out_at: the email side's STOP (Telnyx owns SMS STOP at
--    the platform level). Set by the inbound email adapter; the
--    dispatcher's seeding skips and disables opted-out families.
-- 2. conversation_messages.channel widens for the two new adapter
--    surfaces: 'email' (inbound replies) and 'dispatch' (proactive
--    agent-composed sends).
-- 3. agent_schedules: the dispatcher's rows (dynamic-scheduling pattern,
--    01-architecture §per-family scheduling). Deny-all RLS: only the
--    server-side dispatcher and seeding touch it; parents see OUTCOMES
--    (the prompt itself), never the bookkeeping.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

alter table public.families
  add column if not exists journal_opt_out_at timestamptz;

alter table public.conversation_messages
  drop constraint if exists conversation_messages_channel_check;
alter table public.conversation_messages
  add constraint conversation_messages_channel_check
  check (channel in ('web', 'sms', 'email', 'dispatch'));

create table if not exists public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('journal_prompt')),
  next_run_at timestamptz not null,
  lease_until timestamptz,
  last_run_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (family_id, kind)
);

create index if not exists agent_schedules_due_idx
  on public.agent_schedules (next_run_at)
  where enabled;

alter table public.agent_schedules enable row level security;
