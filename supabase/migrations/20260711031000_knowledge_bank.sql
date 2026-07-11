-- Migration #50: knowledge_bank, the fleet-wide research corpus
-- (plans/2026-07-10-education-knowledge-architecture.md Layer 2, built
-- by plans/2026-07-10-homa-tasks-and-nightly-research.md HT-2 with
-- three additive columns: run_id, content_hash, flagged_reason).
--
-- Every row is general education knowledge (a method profile, a subject
-- delta, a study): NEVER family or child data. Writes go only through
-- lib/knowledge/gate.ts (citation-resolve + sanitize + caps, D-ht-5);
-- reads are server-side (the morning brief composer). Deny-all RLS:
-- families never query it directly; Layers 4/5 of the education plan
-- (context injection, skill resolver) arrive as their own work.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.knowledge_bank (
  id uuid primary key default gen_random_uuid(),
  topic_type text not null check (topic_type in (
    'method_philosophy', 'method_format', 'subject', 'study', 'other'
  )),
  topic_key text not null check (topic_key ~ '^[a-z0-9_-]{2,60}$'),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 500),
  content text not null check (char_length(content) between 1 and 8000),
  source_tier smallint check (source_tier between 1 and 4),
  citations jsonb not null default '[]',
  confidence text check (confidence in ('high', 'medium', 'low')),
  contributed_by text not null default 'seed'
    check (contributed_by in ('seed', 'agent_research', 'founder')),
  status text not null default 'active'
    check (status in ('active', 'flagged', 'superseded')),
  superseded_by uuid references public.knowledge_bank (id),
  freshness_ttl_days int not null default 180
    check (freshness_ttl_days between 1 and 3650),
  last_verified_at timestamptz not null default now(),
  run_id uuid references public.homa_task_runs (id) on delete set null,
  content_hash text,
  flagged_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_bank_topic_idx
  on public.knowledge_bank (topic_type, topic_key, status);
create index if not exists knowledge_bank_run_idx
  on public.knowledge_bank (run_id);

alter table public.knowledge_bank enable row level security;
