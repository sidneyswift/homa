-- Emergency containment for issue #606.
--
-- The earlier privacy migration assigned assistant messages and episode
-- summaries after discarding null user ownership from its grouping. A session
-- with one known adult and one unknown user row could therefore look
-- unambiguous. Historical calls were assigned from the current phone mapping,
-- which cannot prove who owned the number when the call began.
--
-- Preserve only ownership backed by complete, single-adult user provenance.
-- Null remains the fail-closed state. Explicit sent deliveries continue to
-- grant access to their recipient at the individual message level.

with episode_user_provenance as (
  select
    message.family_id,
    message.episode_id,
    message.member_user_id,
    exists (
      select 1
      from public.family_members member
      where member.family_id = message.family_id
        and member.user_id = message.member_user_id
    ) as known_family_member
  from public.conversation_messages message
  where message.role = 'user'
    and message.episode_id is not null
), safe_episodes as (
  select
    family_id,
    episode_id,
    (
      min(member_user_id::text)
        filter (where member_user_id is not null)
    )::uuid as member_user_id
  from episode_user_provenance
  group by family_id, episode_id
  having count(*) > 0
    and bool_and(member_user_id is not null and known_family_member)
    and count(distinct member_user_id) = 1
), fully_safe_episodes as (
  select safe.*
  from safe_episodes safe
  where not exists (
    select 1
    from public.conversation_messages message
    where message.family_id = safe.family_id
      and message.episode_id = safe.episode_id
      and message.member_user_id is not null
      and message.member_user_id <> safe.member_user_id
  )
    and not exists (
      select 1
      from public.conversation_deliveries delivery
      where delivery.family_id = safe.family_id
        and delivery.episode_id = safe.episode_id
        and delivery.status = 'sent'
        and delivery.recipient_member_user_id
          is distinct from safe.member_user_id
    )
)
update public.conversation_episodes episode
set scope = 'member',
    member_user_id = case
      when exists (
        select 1
        from fully_safe_episodes safe
        where safe.family_id = episode.family_id
          and safe.episode_id = episode.id
          and safe.member_user_id = episode.member_user_id
      ) then episode.member_user_id
      else null
    end
where episode.scope is distinct from 'member'
  or not exists (
    select 1
    from fully_safe_episodes safe
    where safe.family_id = episode.family_id
      and safe.episode_id = episode.id
      and safe.member_user_id = episode.member_user_id
  );

with session_user_provenance as (
  select
    message.family_id,
    message.session_id,
    message.member_user_id,
    exists (
      select 1
      from public.family_members member
      where member.family_id = message.family_id
        and member.user_id = message.member_user_id
    ) as known_family_member
  from public.conversation_messages message
  where message.role = 'user'
), safe_sessions as (
  select
    family_id,
    session_id,
    (
      min(member_user_id::text)
        filter (where member_user_id is not null)
    )::uuid as member_user_id
  from session_user_provenance
  group by family_id, session_id
  having count(*) > 0
    and bool_and(member_user_id is not null and known_family_member)
    and count(distinct member_user_id) = 1
)
update public.conversation_messages message
set member_user_id = null
where message.role = 'assistant'
  and message.member_user_id is not null
  and not exists (
    select 1
    from safe_sessions safe
    where safe.family_id = message.family_id
      and safe.session_id = message.session_id
      and safe.member_user_id = message.member_user_id
  );

-- No current row has immutable call-start adult provenance. Clear every
-- historical assignment, including assignments recreated by an old sync.
update public.call_transcripts
set member_user_id = null
where member_user_id is not null;

create or replace function public.conversation_session_owned_by_caller(
  p_family_id uuid,
  p_session_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.family_members current_member
      where current_member.family_id = p_family_id
        and current_member.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.conversation_messages user_message
      where user_message.family_id = p_family_id
        and user_message.session_id = p_session_id
        and user_message.role = 'user'
    )
    and not exists (
      select 1
      from public.conversation_messages user_message
      where user_message.family_id = p_family_id
        and user_message.session_id = p_session_id
        and user_message.role = 'user'
        and user_message.member_user_id
          is distinct from auth.uid()
    );
$$;

revoke all on function
  public.conversation_session_owned_by_caller(uuid, text)
  from public, anon, service_role;
grant execute on function
  public.conversation_session_owned_by_caller(uuid, text)
  to authenticated;

create or replace function public.conversation_episode_owned_by_caller(
  p_family_id uuid,
  p_episode_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.family_members current_member
      where current_member.family_id = p_family_id
        and current_member.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.conversation_messages user_message
      where user_message.family_id = p_family_id
        and user_message.episode_id = p_episode_id
        and user_message.role = 'user'
    )
    and not exists (
      select 1
      from public.conversation_messages user_message
      where user_message.family_id = p_family_id
        and user_message.episode_id = p_episode_id
        and user_message.role = 'user'
        and user_message.member_user_id
          is distinct from auth.uid()
    )
    and not exists (
      select 1
      from public.conversation_messages message
      where message.family_id = p_family_id
        and message.episode_id = p_episode_id
        and message.member_user_id is not null
        and message.member_user_id <> auth.uid()
    )
    and not exists (
      select 1
      from public.conversation_deliveries delivery
      where delivery.family_id = p_family_id
        and delivery.episode_id = p_episode_id
        and delivery.status = 'sent'
        and delivery.recipient_member_user_id
          is distinct from auth.uid()
    );
$$;

revoke all on function
  public.conversation_episode_owned_by_caller(uuid, uuid)
  from public, anon, service_role;
grant execute on function
  public.conversation_episode_owned_by_caller(uuid, uuid)
  to authenticated;

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
      (
        role = 'user'
        and member_user_id = auth.uid()
      )
      or (
        role = 'assistant'
        and member_user_id = auth.uid()
        and public.conversation_session_owned_by_caller(
          family_id,
          session_id
        )
      )
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

drop policy if exists "adults read their own conversation episodes"
  on public.conversation_episodes;
create policy "adults read their own conversation episodes"
  on public.conversation_episodes
  for select
  to authenticated
  using (
    public.is_family_member(family_id)
    and member_user_id = auth.uid()
    and public.conversation_episode_owned_by_caller(family_id, id)
  );

comment on column public.call_transcripts.member_user_id is
  'Authenticated adult proven at call start. Null means unproven and unreadable.';
