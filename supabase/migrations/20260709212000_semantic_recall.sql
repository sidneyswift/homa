-- Migration #38: semantic recall (pgvector; round-3/round-4 lab evidence,
-- build-log 2026-07-09 midday: FTS AND-semantics missed an archived
-- paraphrase, and paraphrases like "her nut thing" defeat lexical search
-- on every substrate).
--
-- Embeddings are written best-effort at capture time (memories, chat
-- messages, call transcripts); a null embedding just means that row is
-- findable by FTS only. The recall tool tries FTS first and falls back to
-- recall_semantic when lexical search comes up short.
--
-- Tenancy: recall_semantic is SECURITY INVOKER, so the caller's own RLS
-- policies decide which rows exist for the query; there is no family_id
-- parameter to get wrong. Index note: at cohort-one row counts a
-- sequential scan is faster than an ANN index; add an HNSW index when a
-- family's archive crosses ~100k rows.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create extension if not exists vector with schema extensions;

alter table public.family_memories
  add column if not exists embedding extensions.vector(1536);
alter table public.conversation_messages
  add column if not exists embedding extensions.vector(1536);
alter table public.call_transcripts
  add column if not exists embedding extensions.vector(1536);

create or replace function public.recall_semantic(
  query_embedding text,
  match_limit int default 6
)
returns table (
  source text,
  happened_at timestamptz,
  label text,
  content text,
  distance double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select query_embedding::extensions.vector(1536) as v
  )
  select * from (
    select
      'memory'::text as source,
      m.created_at as happened_at,
      case
        when m.superseded_at is not null then 'saved memory, older note that was later corrected'
        when m.kind = 'what_works' then 'saved memory (what works)'
        else 'saved memory'
      end as label,
      m.content,
      (m.embedding <=> (select v from q))::double precision as distance
    from public.family_memories m
    where m.embedding is not null
    union all
    select
      'chat',
      c.created_at,
      (case when c.channel = 'sms' then 'text message' else 'chat' end)
        || ' (' || (case when c.role = 'user' then 'the parent' else 'Homa' end) || ')',
      c.content,
      (c.embedding <=> (select v from q))::double precision
    from public.conversation_messages c
    where c.embedding is not null
    union all
    select
      'call',
      t.started_at,
      case when t.line = 'curriculum' then 'phone call (report review)' else 'phone call' end,
      left(t.transcript_text, 480),
      (t.embedding <=> (select v from q))::double precision
    from public.call_transcripts t
    where t.embedding is not null
  ) hits
  order by distance asc
  limit greatest(1, least(match_limit, 12));
$$;

revoke all on function public.recall_semantic(text, int) from public;
grant execute on function public.recall_semantic(text, int) to authenticated;
