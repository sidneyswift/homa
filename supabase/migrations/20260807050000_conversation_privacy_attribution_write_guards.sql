-- Forward write guards for issue #606.
--
-- The containment migration clears unsafe historical attribution. These
-- triggers keep an older application instance from recreating it while the
-- deployment drains. Models and current phone mappings are not provenance.

create or replace function public.conversation_complete_session_member(
  p_family_id uuid,
  p_session_id text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  with provenance as (
    select
      min(message.member_user_id::text)::uuid as member_user_id,
      count(*) as user_count,
      count(distinct message.member_user_id) as owner_count,
      bool_and(message.member_user_id is not null) as complete
    from public.conversation_messages message
    where message.family_id = p_family_id
      and message.session_id = p_session_id
      and message.role = 'user'
  )
  select provenance.member_user_id
  from provenance
  where provenance.user_count > 0
    and provenance.complete
    and provenance.owner_count = 1
    and exists (
      select 1
      from public.family_members current_member
      where current_member.family_id = p_family_id
        and current_member.user_id = provenance.member_user_id
    )
$function$;

create or replace function public.conversation_complete_episode_member(
  p_family_id uuid,
  p_episode_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  with provenance as (
    select
      min(message.member_user_id::text)::uuid as member_user_id,
      count(*) as user_count,
      count(distinct message.member_user_id) as owner_count,
      bool_and(message.member_user_id is not null) as complete
    from public.conversation_messages message
    where message.family_id = p_family_id
      and message.episode_id = p_episode_id
      and message.role = 'user'
  )
  select provenance.member_user_id
  from provenance
  where provenance.user_count > 0
    and provenance.complete
    and provenance.owner_count = 1
    and exists (
      select 1
      from public.conversation_episodes episode
      where episode.id = p_episode_id
        and episode.family_id = p_family_id
    )
    and exists (
      select 1
      from public.family_members current_member
      where current_member.family_id = p_family_id
        and current_member.user_id = provenance.member_user_id
    )
    and not exists (
      select 1
      from public.conversation_messages message
      where message.family_id = p_family_id
        and message.episode_id = p_episode_id
        and message.member_user_id is not null
        and message.member_user_id <> provenance.member_user_id
    )
    and not exists (
      select 1
      from public.conversation_deliveries delivery
      where delivery.family_id = p_family_id
        and delivery.episode_id = p_episode_id
        and delivery.status = 'sent'
        and delivery.recipient_member_user_id
          is distinct from provenance.member_user_id
    )
$function$;

revoke all on function
  public.conversation_complete_session_member(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function
  public.conversation_complete_episode_member(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.conversation_guard_message_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  session_member uuid;
  episode_member uuid;
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    new.role := old.role;
  end if;

  if new.role = 'user' then
    if tg_op = 'UPDATE' and old.role = 'user' then
      -- Ownership may only be erased, including by ON DELETE SET NULL.
      -- It can never be created or transferred after the user row exists.
      if new.member_user_id is not null then
        new.member_user_id := old.member_user_id;
      end if;
    elsif new.member_user_id is not null and not exists (
      select 1
      from public.family_members current_member
      where current_member.family_id = new.family_id
        and current_member.user_id = new.member_user_id
    ) then
      new.member_user_id := null;
    end if;
    return new;
  end if;

  if new.role <> 'assistant' or new.member_user_id is null then
    return new;
  end if;

  session_member := public.conversation_complete_session_member(
    new.family_id,
    new.session_id
  );
  if session_member is distinct from new.member_user_id then
    new.member_user_id := null;
    return new;
  end if;

  if new.episode_id is not null then
    episode_member := public.conversation_complete_episode_member(
      new.family_id,
      new.episode_id
    );
    if episode_member is distinct from new.member_user_id then
      new.member_user_id := null;
    end if;
  end if;
  return new;
end
$function$;

create or replace function public.conversation_guard_episode_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  proven_member uuid;
begin
  new.scope := 'member';
  if new.member_user_id is null then
    return new;
  end if;
  proven_member := public.conversation_complete_episode_member(
    new.family_id,
    new.id
  );
  if proven_member is distinct from new.member_user_id then
    new.member_user_id := null;
  end if;
  return new;
end
$function$;

create or replace function public.conversation_guard_call_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Until immutable call-start provenance exists, every assignment is
  -- unproven. Current phone ownership must never rewrite call history.
  new.member_user_id := null;
  return new;
end
$function$;

create or replace function public.conversation_revalidate_user_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op <> 'INSERT' and old.role = 'user' then
    update public.conversation_messages assistant
    set member_user_id = null
    where assistant.family_id = old.family_id
      and assistant.session_id = old.session_id
      and assistant.role = 'assistant'
      and assistant.member_user_id is not null
      and assistant.member_user_id is distinct from
        public.conversation_complete_session_member(
          old.family_id,
          old.session_id
        );

    if old.episode_id is not null then
      update public.conversation_episodes episode
      set member_user_id = null,
          scope = 'member'
      where episode.id = old.episode_id
        and episode.family_id = old.family_id
        and episode.member_user_id is not null
        and episode.member_user_id is distinct from
          public.conversation_complete_episode_member(
            old.family_id,
            old.episode_id
          );
    end if;
  end if;

  if tg_op <> 'DELETE' and new.role = 'user' then
    update public.conversation_messages assistant
    set member_user_id = null
    where assistant.family_id = new.family_id
      and assistant.session_id = new.session_id
      and assistant.role = 'assistant'
      and assistant.member_user_id is not null
      and assistant.member_user_id is distinct from
        public.conversation_complete_session_member(
          new.family_id,
          new.session_id
        );

    if new.episode_id is not null then
      update public.conversation_episodes episode
      set member_user_id = null,
          scope = 'member'
      where episode.id = new.episode_id
        and episode.family_id = new.family_id
        and episode.member_user_id is not null
        and episode.member_user_id is distinct from
          public.conversation_complete_episode_member(
            new.family_id,
            new.episode_id
          );
    end if;
  end if;
  return null;
end
$function$;

revoke all on function public.conversation_guard_message_owner()
  from public, anon, authenticated, service_role;
revoke all on function public.conversation_guard_episode_owner()
  from public, anon, authenticated, service_role;
revoke all on function public.conversation_guard_call_owner()
  from public, anon, authenticated, service_role;
revoke all on function public.conversation_revalidate_user_provenance()
  from public, anon, authenticated, service_role;

drop trigger if exists conversation_guard_message_owner
  on public.conversation_messages;
create trigger conversation_guard_message_owner
before insert or update on public.conversation_messages
for each row execute function public.conversation_guard_message_owner();

drop trigger if exists conversation_revalidate_user_provenance
  on public.conversation_messages;
create trigger conversation_revalidate_user_provenance
after insert or update or delete on public.conversation_messages
for each row
execute function public.conversation_revalidate_user_provenance();

drop trigger if exists conversation_guard_episode_owner
  on public.conversation_episodes;
create trigger conversation_guard_episode_owner
before insert or update on public.conversation_episodes
for each row execute function public.conversation_guard_episode_owner();

drop trigger if exists conversation_guard_call_owner
  on public.call_transcripts;
create trigger conversation_guard_call_owner
before insert or update on public.call_transcripts
for each row execute function public.conversation_guard_call_owner();

comment on function public.conversation_complete_session_member(uuid, text) is
  'Exact current member proven by every user row in one conversation session.';
comment on function public.conversation_complete_episode_member(uuid, uuid) is
  'Exact current member proven by complete message and delivery provenance for one episode.';
comment on trigger conversation_guard_call_owner on public.call_transcripts is
  'Keeps call ownership null until immutable call-start provenance ships.';
