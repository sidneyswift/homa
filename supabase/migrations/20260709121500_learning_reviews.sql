-- Migration #35: learning_reviews, the post-turn review's claim + audit
-- rows (agentic ladder item 8, M2-13; docs/homa-planning/
-- 15-agentic-architecture.md §5).
--
-- One row per review run over one session's messages up to a sequence
-- number. The unique key IS the single-flight claim: two concurrent
-- triggers for the same window insert once, and the loser stands down.
-- result holds the extraction outcome (what was saved and skipped) for
-- the audit trail; the memories themselves land in family_memories with
-- source 'review' and surface on /home with undo.
--
-- Deny-all by design (RLS on, zero policies): only the server-only
-- connection reads or writes. Parents see the OUTCOME through the
-- memories card, never this bookkeeping table.

-- Idempotent on purpose: this landed via MCP before the GitHub
-- integration replays the file (same posture as migration #27).
create table if not exists public.learning_reviews (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  session_id text not null,
  upto_sequence integer not null,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, upto_sequence)
);

create index if not exists learning_reviews_family_idx
  on public.learning_reviews (family_id, created_at desc);

alter table public.learning_reviews enable row level security;
