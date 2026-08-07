\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

\if :{?issue_606_run_id}
\else
\echo 'issue 606 repair requires issue_606_run_id'
\quit 3
\endif

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '150s';

create temporary table issue_606_execution_context (
  workflow_run_id text primary key
    check (workflow_run_id ~ '^[1-9][0-9]*$')
) on commit drop;

insert into issue_606_execution_context (workflow_run_id)
values (:'issue_606_run_id');

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('homa:issue:606:production-repair', 0)
);

lock table supabase_migrations.schema_migrations
  in share row exclusive mode;
lock table public.family_members in share row exclusive mode;
lock table public.conversation_deliveries in access exclusive mode;
lock table public.conversation_episodes in access exclusive mode;
lock table public.conversation_messages in access exclusive mode;
lock table public.call_transcripts in access exclusive mode;

do $required_history$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260802033000'
      and name = 'conversation_privacy_per_adult'
  ) then
    raise exception
      'issue 606 requires reviewed migration 20260802033000 in the production ledger';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260805110000'
      and name = 'eve_web_session_owners'
  ) then
    raise exception
      'issue 606 requires reviewed migration 20260805110000 in the production ledger';
  end if;
end
$required_history$;

create or replace function pg_temp.issue_606_unsafe_counts()
returns table (
  unsafe_assistants bigint,
  unsafe_episodes bigint,
  owned_calls bigint
)
language sql
stable
set search_path = ''
as $counts$
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
  ), episode_user_provenance as (
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
  select
    (
      select count(*)
      from public.conversation_messages message
      where message.role = 'assistant'
        and message.member_user_id is not null
        and not exists (
          select 1
          from safe_sessions safe
          where safe.family_id = message.family_id
            and safe.session_id = message.session_id
            and safe.member_user_id = message.member_user_id
        )
    ),
    (
      select count(*)
      from public.conversation_episodes episode
      where episode.scope is distinct from 'member'
        or (
          episode.member_user_id is not null
          and not exists (
            select 1
            from fully_safe_episodes safe
            where safe.family_id = episode.family_id
              and safe.episode_id = episode.id
              and safe.member_user_id = episode.member_user_id
          )
        )
    ),
    (
      select count(*)
      from public.call_transcripts transcript
      where transcript.member_user_id is not null
    )
$counts$;

create or replace function pg_temp.issue_606_contract_ok()
returns boolean
language plpgsql
stable
set search_path = ''
as $contract$
declare
  session_oid oid := pg_catalog.to_regprocedure(
    'public.conversation_session_owned_by_caller(uuid,text)'
  );
  episode_oid oid := pg_catalog.to_regprocedure(
    'public.conversation_episode_owned_by_caller(uuid,uuid)'
  );
  authenticated_oid oid;
  expected_owner_oid oid;
  session_contract record;
  episode_contract record;
  message_qual text;
  episode_qual text;
begin
  select oid into authenticated_oid
  from pg_catalog.pg_roles
  where rolname = 'authenticated';

  select oid into expected_owner_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  if authenticated_oid is null
    or expected_owner_oid is null
    or session_oid is null
    or episode_oid is null
  then
    return false;
  end if;

  select procedure.* into strict session_contract
  from pg_catalog.pg_proc procedure
  where procedure.oid = session_oid;

  select procedure.* into strict episode_contract
  from pg_catalog.pg_proc procedure
  where procedure.oid = episode_oid;

  if session_contract.proowner <> expected_owner_oid
    or episode_contract.proowner <> expected_owner_oid
    or not session_contract.prosecdef
    or not episode_contract.prosecdef
    or session_contract.provolatile <> 's'
    or episode_contract.provolatile <> 's'
    or session_contract.proconfig
      is distinct from array['search_path=""']::text[]
    or episode_contract.proconfig
      is distinct from array['search_path=""']::text[]
  then
    return false;
  end if;

  if not exists (
    select 1
    from pg_catalog.aclexplode(session_contract.proacl) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee = authenticated_oid
  ) or exists (
    select 1
    from pg_catalog.aclexplode(session_contract.proacl) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee not in (session_contract.proowner, authenticated_oid)
  ) or not exists (
    select 1
    from pg_catalog.aclexplode(episode_contract.proacl) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee = authenticated_oid
  ) or exists (
    select 1
    from pg_catalog.aclexplode(episode_contract.proacl) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee not in (episode_contract.proowner, authenticated_oid)
  ) then
    return false;
  end if;

  select pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
  into message_qual
  from pg_catalog.pg_policy policy
  where policy.polrelid = 'public.conversation_messages'::regclass
    and policy.polname = 'adults read their own conversation messages'
    and policy.polcmd = 'r'
    and policy.polpermissive
    and policy.polroles = array[authenticated_oid]::oid[];

  select pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
  into episode_qual
  from pg_catalog.pg_policy policy
  where policy.polrelid = 'public.conversation_episodes'::regclass
    and policy.polname = 'adults read their own conversation episodes'
    and policy.polcmd = 'r'
    and policy.polpermissive
    and policy.polroles = array[authenticated_oid]::oid[];

  return message_qual is not null
    and pg_catalog.strpos(message_qual, 'conversation_session_owned_by_caller') > 0
    and pg_catalog.strpos(message_qual, 'conversation_deliveries') > 0
    and pg_catalog.strpos(message_qual, 'is_family_member') > 0
    and episode_qual is not null
    and pg_catalog.strpos(episode_qual, 'conversation_episode_owned_by_caller') > 0
    and pg_catalog.strpos(episode_qual, 'is_family_member') > 0
    and pg_catalog.strpos(episode_qual, 'conversation_deliveries') = 0
    and pg_catalog.col_description(
      'public.call_transcripts'::regclass,
      (
        select attribute.attnum
        from pg_catalog.pg_attribute attribute
        where attribute.attrelid = 'public.call_transcripts'::regclass
          and attribute.attname = 'member_user_id'
          and not attribute.attisdropped
      )
    ) = 'Authenticated adult proven at call start. Null means unproven and unreadable.';
exception
  when no_data_found or too_many_rows then
    return false;
end
$contract$;

create temporary table issue_606_repair_state (
  correction_ledger_existed boolean not null,
  contract_was_safe boolean not null,
  assistants_before bigint not null,
  episodes_before bigint not null,
  calls_before bigint not null
) on commit drop;

insert into issue_606_repair_state
select
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260807040000'
  ),
  pg_temp.issue_606_contract_ok(),
  counts.unsafe_assistants,
  counts.unsafe_episodes,
  counts.owned_calls
from pg_temp.issue_606_unsafe_counts() counts;

\ir ../supabase/migrations/20260807040000_conversation_privacy_attribution_containment.sql

create or replace function pg_temp.issue_606_ledger_statements(
  p_workflow_run_id text
)
returns text[]
language sql
stable
set search_path = ''
as $ledger$
  select array[
    pg_catalog.format(
      E'/* Homa issue 606: exact correction applied atomically. */\n/* sha256=a158765ad96a27830f7c92f80c038adfcc43b32e0971b3624f12302e579a3db9 */\n%s',
      pg_catalog.pg_get_functiondef(
        'public.conversation_session_owned_by_caller(uuid,text)'::regprocedure
      )
    ),
    'revoke all on function public.conversation_session_owned_by_caller(uuid, text) from public, anon, service_role',
    'grant execute on function public.conversation_session_owned_by_caller(uuid, text) to authenticated',
    pg_catalog.pg_get_functiondef(
      'public.conversation_episode_owned_by_caller(uuid,uuid)'::regprocedure
    ),
    'revoke all on function public.conversation_episode_owned_by_caller(uuid, uuid) from public, anon, service_role',
    'grant execute on function public.conversation_episode_owned_by_caller(uuid, uuid) to authenticated',
    '/* Cleanup updates and exact RLS policies are replayed from the hash-pinned correction file. */',
    pg_catalog.format(
      '/* Homa issue 606 workflow_run_id=%s */',
      p_workflow_run_id
    )
  ]::text[]
$ledger$;

select not correction_ledger_existed as issue_606_insert_ledger
from issue_606_repair_state
\gset

\if :issue_606_insert_ledger
insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260807040000',
  pg_temp.issue_606_ledger_statements(
    (select workflow_run_id from issue_606_execution_context)
  ),
  'conversation_privacy_attribution_containment'
);
\endif

do $assert_repair$
declare
  counts record;
begin
  select * into strict counts
  from pg_temp.issue_606_unsafe_counts();

  if counts.unsafe_assistants <> 0
    or counts.unsafe_episodes <> 0
    or counts.owned_calls <> 0
  then
    raise exception 'issue 606 unsafe ownership remains after correction';
  end if;

  if not pg_temp.issue_606_contract_ok() then
    raise exception 'issue 606 privacy function, policy, owner, or grant contract is unsafe';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260807040000'
      and name = 'conversation_privacy_attribution_containment'
      and statements = pg_temp.issue_606_ledger_statements(
        (select workflow_run_id from issue_606_execution_context)
      )
  ) then
    raise exception 'issue 606 correction ledger evidence is absent or altered';
  end if;
end
$assert_repair$;

create temporary table issue_606_after_counts on commit drop as
select * from pg_temp.issue_606_unsafe_counts();

select 'ISSUE_606_ASSISTANTS_CLEARED=' ||
  (state.assistants_before - after.unsafe_assistants)::text
from issue_606_repair_state state
cross join issue_606_after_counts after;

select 'ISSUE_606_EPISODES_CLEARED=' ||
  (state.episodes_before - after.unsafe_episodes)::text
from issue_606_repair_state state
cross join issue_606_after_counts after;

select 'ISSUE_606_CALLS_CLEARED=' ||
  (state.calls_before - after.owned_calls)::text
from issue_606_repair_state state
cross join issue_606_after_counts after;

select 'ISSUE_606_UNSAFE_ASSISTANTS=' ||
  (after.unsafe_assistants > 0)::text
from issue_606_after_counts after;

select 'ISSUE_606_UNSAFE_EPISODES=' ||
  (after.unsafe_episodes > 0)::text
from issue_606_after_counts after;

select 'ISSUE_606_OWNED_CALLS=' ||
  (after.owned_calls > 0)::text
from issue_606_after_counts after;

select 'ISSUE_606_REPAIR=' || case
  when state.correction_ledger_existed
    and state.contract_was_safe
    and state.assistants_before = 0
    and state.episodes_before = 0
    and state.calls_before = 0
  then 'verified_noop'
  else 'repaired'
end
from issue_606_repair_state state;

commit;
