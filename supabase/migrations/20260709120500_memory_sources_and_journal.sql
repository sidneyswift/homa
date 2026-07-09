-- Migration #33: two small columns for the learning loops (agentic
-- ladder items 3, 7 and 8; docs/homa-planning/15-agentic-architecture.md).
--
-- 1. family_memories.source grows two values: 'call' (the post-call
--    memory turn and the voice remember tool) and 'review' (the
--    post-turn chat review). The source is what the /home memories card
--    shows next to each entry, so a parent always sees where a saved
--    fact came from before deciding to keep or remove it.

alter table public.family_memories
  drop constraint if exists family_memories_source_check;

alter table public.family_memories
  add constraint family_memories_source_check
  check (source in ('homa', 'parent', 'onboarding', 'call', 'review'));

-- 2. The evening journal prompt's once-a-day stamp. Compared against the
--    family's own local date (families.time_zone) inside the cron, so a
--    family never gets two prompts in one of THEIR days.

alter table public.families
  add column if not exists journal_prompt_last_sent_at timestamptz;
