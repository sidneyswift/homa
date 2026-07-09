-- Migration #32: learning columns on call_transcripts (agentic ladder
-- items 2-4, founder direction 2026-07-09, docs/homa-planning/
-- 15-agentic-architecture.md §5).
--
-- transcript_text: the flattened text of messages, written by the sync
-- job at capture time so the recall tool can full-text search calls
-- without unpacking jsonb per query. Backfilled here for rows captured
-- before the column existed.
--
-- memory_extracted_at / memory_extraction: the post-call memory turn's
-- once-only marker plus its audit trail (exactly what Homa saved from
-- this call, feeding the visible-with-undo surface on /home).
--
-- Isolation posture unchanged: members-only SELECT, server-only writes.

alter table public.call_transcripts
  add column if not exists transcript_text text not null default '',
  add column if not exists memory_extracted_at timestamptz,
  add column if not exists memory_extraction jsonb;

update public.call_transcripts
set transcript_text = coalesce(
  (
    select string_agg(coalesce(msg->>'text', ''), ' ' order by ord)
    from jsonb_array_elements(messages) with ordinality as m(msg, ord)
    where coalesce(msg->>'text', '') <> ''
  ),
  ''
)
where transcript_text = '';

create index if not exists call_transcripts_fts_idx
  on public.call_transcripts
  using gin (to_tsvector('english', transcript_text));
