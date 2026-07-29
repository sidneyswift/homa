-- recall_semantic honours the scope it was asked for (gh#375).
--
-- The function ranked memories, chats, and calls together and applied
-- match_limit to that global ranking. The caller then discarded every
-- row outside the requested scope in application code, so a
-- scope:"calls" search spent its whole budget on memories and chats.
--
-- That is how Homa told a parent on 2026-07-23 that her phone call did
-- not exist while its transcript sat in call_transcripts, embedded, from
-- 49 minutes earlier. She made five recall attempts. The lexical arm
-- could not match a transcript that never happens to use her words (that
-- call is the only one of her six that never says "call"), and this
-- function, the arm that exists to catch exactly that, was ranking rows
-- it was going to throw away.
--
-- Deploy shape: `scopes` defaults to null, which reproduces the old
-- all-sources behaviour bit for bit, so a two-argument caller still
-- works and this migration may safely lead its code deploy.
--
-- The old two-argument function is dropped rather than left beside this
-- one on purpose. PostgREST resolves an RPC by the names of the keys in
-- the request body, and two overloads that both accept
-- {query_embedding, match_limit} would leave it unable to choose a
-- candidate. One function with a defaulted third argument serves both
-- call shapes with no ambiguity.
drop function if exists public.recall_semantic(text, int);

create function public.recall_semantic(
  query_embedding text,
  match_limit int default 6,
  scopes text[] default null
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
      and (scopes is null or 'memory' = any(scopes))
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
      and (scopes is null or 'chat' = any(scopes))
    union all
    select
      'call',
      t.started_at,
      case when t.line = 'curriculum' then 'phone call (report review)' else 'phone call' end,
      left(t.transcript_text, 480),
      (t.embedding <=> (select v from q))::double precision
    from public.call_transcripts t
    where t.embedding is not null
      and (scopes is null or 'call' = any(scopes))
  ) hits
  order by distance asc
  limit greatest(1, least(match_limit, 12));
$$;

revoke all on function public.recall_semantic(text, int, text[]) from public;
grant execute on function public.recall_semantic(text, int, text[]) to authenticated;
