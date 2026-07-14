-- Migration #51: age-aware knowledge corpus facets
-- (plans/2026-07-14-age-aware-knowledge-corpus.md, KC-1).
--
-- Additive-only: two nullable columns on knowledge_bank plus a lookup
-- index, so the current read path (freshKnowledgeForTopics with a null
-- stage/lens filter) keeps working during dual-read. Deny-all RLS is
-- unchanged; families never read this table. This migration MUST lead
-- the deploy that reads the columns (additive-migration rule, AGENTS.md).
--
--   stage: the developmental band a row serves (packages/core
--     stageForAgeMonths). null = stage-agnostic (pure philosophy) or a
--     legacy row not yet re-keyed.
--   lens:  the research purpose. Supersedes topic_type, which stays for
--     dual-read and for the gate's supersede scope.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

alter table public.knowledge_bank
  add column if not exists stage text
    check (stage is null or stage in
      ('early_years', 'early_elem', 'upper_elem', 'middle', 'high')),
  add column if not exists lens text
    check (lens is null or lens in
      ('develops_when', 'how_to_teach', 'current_study', 'method',
       'curriculum', 'red_flags'));

-- The corpus read/demand cell key: one active row per (lens, topic_key,
-- stage). status stays in the key so superseded history does not slow
-- the active-row lookups.
create index if not exists knowledge_bank_cell_idx
  on public.knowledge_bank (lens, topic_key, stage, status);

-- Backfill lens from topic_type for the rows already in the bank. Stage
-- stays null: it cannot be inferred honestly from legacy content, and a
-- null stage matches every family under dual-read, so nothing disappears.
update public.knowledge_bank
set lens = case topic_type
    when 'method_philosophy' then 'method'
    when 'method_format' then 'method'
    when 'subject' then 'how_to_teach'
    when 'study' then 'current_study'
    when 'other' then 'curriculum'
    else null
  end
where lens is null;
