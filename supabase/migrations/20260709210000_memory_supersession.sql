-- Migration #36: memory supersession (round-3/round-4 lab finding,
-- build-log 2026-07-09 midday; founder direction "do all of this").
--
-- The agent's forget tool now SUPERSEDES instead of deletes: the row gets
-- superseded_at and drops out of the pinned context, the /home card, and
-- dedupe/budget math, but stays searchable by recall with an "older note,
-- later corrected" label. Point-in-time questions ("what was she into in
-- February?") and used-to-love connections survive corrections.
--
-- The parent's Remove button on /home keeps HARD delete on purpose: an
-- agent correction is history; a parent removal is a privacy decision.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

alter table public.family_memories
  add column if not exists superseded_at timestamptz;

create index if not exists family_memories_active_idx
  on public.family_memories (family_id, created_at)
  where superseded_at is null;
