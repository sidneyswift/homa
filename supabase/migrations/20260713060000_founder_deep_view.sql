-- Migration #79: the founder deep view's capture layer
-- (plans/2026-07-13-founder-deep-view-directions.html, question 1
-- answered "full capture now" by the founder's build-1-2-3 instruction).
--
-- What Homa does not write down she cannot show later: tool calls,
-- injected context, memory provenance, and material generation inputs
-- were recorded nowhere durable (Eve's own traces expire in Vercel
-- Workflow storage after ~7 days and are not SQL-queryable). Four
-- additive pieces close that:
--
--   1. agent_tool_calls: one row per model tool call (name, sanitized
--      args, result summary), written by agent/hooks/record-tool-calls.ts
--      on eve's actions.requested / action.result stream events.
--   2. session_context_snapshots: the dynamic instruction blocks a
--      session actually carried (family + progress + continuity),
--      deduped per session by content hash, written best-effort from
--      agent/instructions/family-context.ts.
--   3. family_memories.session_id: which conversation taught her this.
--   4. materials.generation: the create_printable input metadata and
--      review verdict beside the output it produced.
--
-- Tenancy: both new tables are deny-all (enable RLS, no policies) plus
-- revoked privileges, matching model_usage and the founder-console
-- tables; only server code writes and only the founder console reads.
-- family_id cascades on family deletion because rows carry family
-- content (same posture as conversation_messages), unlike model_usage's
-- set-null cost accounting.
--
-- Additive only; safe to apply ahead of the code deploy. Idempotent on
-- purpose: lands via MCP before the GitHub integration replays this file.

create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  session_id text not null,
  turn_id text,
  step_index integer,
  call_id text not null,
  channel text,
  tool text not null,
  args jsonb,
  status text not null default 'requested'
    check (status in ('requested', 'completed', 'failed', 'rejected')),
  result jsonb,
  is_error boolean,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists agent_tool_calls_session_call_idx
  on public.agent_tool_calls (session_id, call_id);
create index if not exists agent_tool_calls_family_created_idx
  on public.agent_tool_calls (family_id, created_at desc);
create index if not exists agent_tool_calls_created_idx
  on public.agent_tool_calls (created_at desc);

alter table public.agent_tool_calls enable row level security;
-- Deny-all: no policies on purpose. Server-only table.
revoke all on table public.agent_tool_calls from anon, authenticated;

create table if not exists public.session_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  session_id text not null,
  turn_id text,
  channel text,
  content text not null check (char_length(content) <= 60000),
  content_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists session_context_snapshots_dedupe_idx
  on public.session_context_snapshots (session_id, content_hash);
create index if not exists session_context_snapshots_family_idx
  on public.session_context_snapshots (family_id, created_at desc);

alter table public.session_context_snapshots enable row level security;
-- Deny-all: no policies on purpose. Server-only table.
revoke all on table public.session_context_snapshots from anon, authenticated;

-- Provenance stamps. Nullable on purpose: pre-existing rows and paths
-- without a session (voice call extraction) simply lack the link.
alter table public.family_memories
  add column if not exists session_id text;

alter table public.materials
  add column if not exists generation jsonb;
