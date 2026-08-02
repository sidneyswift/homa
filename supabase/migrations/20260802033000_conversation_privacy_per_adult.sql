-- Raw conversations belong to the authenticated adult, not the household.
--
-- Founder rulings chat-privacy-per-adult and voice-transcript-per-adult make
-- both sides of an interactive exchange private. Shared family memories and
-- progress remain family-wide. Null ownership means the historical row is
-- ambiguous and therefore invisible through the Data API and recall.
--
-- This migration may lead the code deploy. Existing writers still produce
-- valid nullable rows, and the stricter policies fail closed until the new
-- writers persist an owner on both sides of each exchange.

alter table public.call_transcripts
  add column if not exists member_user_id uuid
    references auth.users (id) on delete set null;

-- The original constraint conflicts with the existing ON DELETE SET NULL
-- foreign key once interactive episodes correctly use member scope. Keep the
-- episode as an unreadable historical shell when its owner deletes account.
alter table public.conversation_episodes
  drop constraint if exists conversation_episodes_check;

create index if not exists call_transcripts_member_started_idx
  on public.call_transcripts (member_user_id, started_at desc)
  where member_user_id is not null;

-- A null assistant row can inherit its session owner only when every
-- attributed row in that family/session names the same adult.
with session_owners as (
  select family_id, session_id,
         min(member_user_id::text)::uuid as member_user_id
  from public.conversation_messages
  where member_user_id is not null
  group by family_id, session_id
  having count(distinct member_user_id) = 1
)
update public.conversation_messages message
set member_user_id = owner.member_user_id
from session_owners owner
where message.family_id = owner.family_id
  and message.session_id = owner.session_id
  and message.role = 'assistant'
  and message.member_user_id is null;

-- Proactive Homa messages have no speaker-side owner. A single successful
-- recipient is enough to attribute the row; multi-recipient messages remain
-- null and are exposed only through each recipient's sent delivery.
with delivery_owners as (
  select message_id,
         min(recipient_member_user_id::text)::uuid as member_user_id
  from public.conversation_deliveries
  where status = 'sent'
    and recipient_member_user_id is not null
  group by message_id
  having count(distinct recipient_member_user_id) = 1
)
update public.conversation_messages message
set member_user_id = owner.member_user_id
from delivery_owners owner
where message.id = owner.message_id
  and message.role = 'assistant'
  and message.member_user_id is null;

-- Member-scope an episode only when all available message and delivery
-- evidence identifies one adult. Ambiguous household episodes stay hidden
-- unless a successful delivery explicitly grants the caller that message.
with episode_attributions as (
  select family_id, episode_id, member_user_id
  from public.conversation_messages
  where episode_id is not null and member_user_id is not null
  union
  select family_id, episode_id, recipient_member_user_id
  from public.conversation_deliveries
  where status = 'sent' and recipient_member_user_id is not null
), episode_owners as (
  select family_id, episode_id,
         min(member_user_id::text)::uuid as member_user_id
  from episode_attributions
  group by family_id, episode_id
  having count(distinct member_user_id) = 1
)
update public.conversation_episodes episode
set scope = 'member', member_user_id = owner.member_user_id
from episode_owners owner
where episode.id = owner.episode_id
  and episode.family_id = owner.family_id
  and episode.member_user_id is null;

-- Historical calls are attributable only when the persisted end-user number
-- maps to exactly one adult in the same family. The agent number belongs to
-- Homa and is never ownership evidence. Everything else stays null.
with call_owners as (
  select transcript.id,
         min(phone.member_user_id::text)::uuid as member_user_id
  from public.call_transcripts transcript
  join public.family_phones phone
    on phone.family_id = transcript.family_id
   and phone.phone_e164 = transcript.caller_e164
  where phone.member_user_id is not null
  group by transcript.id
  having count(distinct phone.member_user_id) = 1
)
update public.call_transcripts transcript
set member_user_id = owner.member_user_id
from call_owners owner
where transcript.id = owner.id
  and transcript.member_user_id is null;

drop policy if exists "members read their conversation messages"
  on public.conversation_messages;
drop policy if exists "adults read their own conversation messages"
  on public.conversation_messages;
create policy "adults read their own conversation messages"
  on public.conversation_messages
  for select
  to authenticated
  using (
    visibility = 'family'
    and public.is_family_member(family_id)
    and (
      member_user_id = auth.uid()
      or exists (
        select 1
        from public.conversation_deliveries delivery
        where delivery.family_id = conversation_messages.family_id
          and delivery.message_id = conversation_messages.id
          and delivery.recipient_member_user_id = auth.uid()
          and delivery.status = 'sent'
      )
    )
  );

drop policy if exists "members read their conversation episodes"
  on public.conversation_episodes;
drop policy if exists "adults read their own conversation episodes"
  on public.conversation_episodes;
create policy "adults read their own conversation episodes"
  on public.conversation_episodes
  for select
  to authenticated
  using (
    public.is_family_member(family_id)
    and (
      member_user_id = auth.uid()
      or exists (
        select 1
        from public.conversation_deliveries delivery
        where delivery.family_id = conversation_episodes.family_id
          and delivery.episode_id = conversation_episodes.id
          and delivery.recipient_member_user_id = auth.uid()
          and delivery.status = 'sent'
      )
    )
  );

drop policy if exists "members read their conversation deliveries"
  on public.conversation_deliveries;
drop policy if exists "adults read their own conversation deliveries"
  on public.conversation_deliveries;
create policy "adults read their own conversation deliveries"
  on public.conversation_deliveries
  for select
  to authenticated
  using (
    public.is_family_member(family_id)
    and recipient_member_user_id = auth.uid()
  );

drop policy if exists "members read their conversation open loops"
  on public.conversation_open_loops;
drop policy if exists "adults read their own conversation open loops"
  on public.conversation_open_loops;
create policy "adults read their own conversation open loops"
  on public.conversation_open_loops
  for select
  to authenticated
  using (
    public.is_family_member(family_id)
    and exists (
      select 1
      from public.conversation_deliveries delivery
      where delivery.id = conversation_open_loops.delivery_id
        and delivery.family_id = conversation_open_loops.family_id
        and delivery.recipient_member_user_id = auth.uid()
    )
  );

drop policy if exists "members read call transcripts"
  on public.call_transcripts;
drop policy if exists "adults read their own call transcripts"
  on public.call_transcripts;
create policy "adults read their own call transcripts"
  on public.call_transcripts
  for select
  to authenticated
  using (
    family_id is not null
    and public.is_family_member(family_id)
    and member_user_id = auth.uid()
  );

revoke all on table public.call_transcripts from public, anon, authenticated;
grant select on table public.call_transcripts to authenticated;

create or replace function public.recall_semantic(
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
      memory.created_at as happened_at,
      case
        when memory.superseded_at is not null then 'saved memory, older note that was later corrected'
        when memory.kind = 'what_works' then 'saved memory (what works)'
        else 'saved memory'
      end as label,
      memory.content,
      (memory.embedding <=> (select v from q))::double precision as distance
    from public.family_memories memory
    where memory.embedding is not null
      and (scopes is null or 'memory' = any(scopes))
    union all
    select
      'chat',
      message.created_at,
      (case when message.channel = 'sms' then 'text message' else 'chat' end)
        || ' (' || (case when message.role = 'user' then 'the parent' else 'Homa' end) || ')',
      message.content,
      (message.embedding <=> (select v from q))::double precision
    from public.conversation_messages message
    where message.embedding is not null
      and message.visibility = 'family'
      and (scopes is null or 'chat' = any(scopes))
      and (
        message.member_user_id = auth.uid()
        or exists (
          select 1
          from public.conversation_deliveries delivery
          where delivery.family_id = message.family_id
            and delivery.message_id = message.id
            and delivery.recipient_member_user_id = auth.uid()
            and delivery.status = 'sent'
        )
      )
    union all
    select
      'call',
      transcript.started_at,
      case when transcript.line = 'curriculum' then 'phone call (report review)' else 'phone call' end,
      left(transcript.transcript_text, 480),
      (transcript.embedding <=> (select v from q))::double precision
    from public.call_transcripts transcript
    where transcript.embedding is not null
      and transcript.member_user_id = auth.uid()
      and (scopes is null or 'call' = any(scopes))
  ) hits
  order by distance asc
  limit greatest(1, least(match_limit, 12));
$$;

revoke all on function public.recall_semantic(text, int, text[]) from public;
revoke execute on function public.recall_semantic(text, int, text[]) from anon;
grant execute on function public.recall_semantic(text, int, text[]) to authenticated;

comment on column public.call_transcripts.member_user_id is
  'Authenticated adult who owns the raw call. Null means ambiguous and unreadable.';
comment on column public.conversation_episodes.member_user_id is
  'Authenticated adult owner. Null on member scope means deleted or ambiguous and unreadable.';
