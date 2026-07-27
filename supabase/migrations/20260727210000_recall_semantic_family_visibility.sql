-- recall_semantic never surfaces internal conversation rows.
--
-- conversation_messages carries visibility ('family' | 'internal'):
-- scheduler dispatch prompts, undelivered drafts, and the subagent rows
-- flipped to internal in the 2026-07-19 cleanup are server-only under the
-- continuity hardening policy (20260711150308). recall_semantic is
-- SECURITY INVOKER, so the caller's RLS already hides those rows for
-- authenticated sessions; this replacement repeats the predicate inside
-- the function body so the guarantee holds for any principal that can
-- ever execute it, matching the explicit visibility filters in the
-- lexical and pinned recall paths (belt on top of the RLS brace).
--
-- Same signature, fewer rows returned: not a breaking change, so this
-- may be applied before or after the code deploy (no expand-contract
-- function version needed for a body-only replace).

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
      and c.visibility = 'family'
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
