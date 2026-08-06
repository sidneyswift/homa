\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '150s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('homa:issue:878:production-repair', 0)
);

create temporary table issue_878_repair_state (
  sandbox_ledger_existed boolean not null,
  delete_ledger_existed boolean not null
) on commit drop;

insert into issue_878_repair_state (
  sandbox_ledger_existed,
  delete_ledger_existed
)
select
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806034000'
  ),
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806035000'
  );

do $state_check$
declare
  repair_state issue_878_repair_state%rowtype;
begin
  select * into strict repair_state from issue_878_repair_state;

  if repair_state.sandbox_ledger_existed
    is distinct from repair_state.delete_ledger_existed
  then
    raise exception
      'issue 878 migration ledger is mixed; both reviewed versions must be absent or present';
  end if;
end
$state_check$;

select not sandbox_ledger_existed as issue_878_apply
from issue_878_repair_state
\gset

\if :issue_878_apply
\ir ../supabase/migrations/20260806034000_sandbox_live_auth_fixtures.sql
\ir ../supabase/migrations/20260806035000_family_delete_progress_trigger.sql

insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values
  (
    '20260806034000',
    array[
      'Issue 878 exact migration applied atomically',
      'sha256=4d6f2bd199a66206746ae3139e3b418397a1d953f4c9139ce5d6001798e3dd85'
    ]::text[],
    'sandbox_live_auth_fixtures'
  ),
  (
    '20260806035000',
    array[
      'Issue 878 exact migration applied atomically',
      'sha256=841ce177e122e393a8d5e37590b3290e2c6b3e1f1a813f158995ee0681c854d8'
    ]::text[],
    'family_delete_progress_trigger'
  );
\endif

create or replace function pg_temp.assert_issue_878_contract()
returns void
language plpgsql
as $assert$
declare
  create_family_oid oid :=
    to_regprocedure('public.create_my_family(text,text,text)');
  pause_member_oid oid :=
    to_regprocedure('private.pause_check_ins_for_removed_member()');
  authenticated_oid oid;
  expected_owner_oid oid;
  create_family_contract record;
  pause_member_contract record;
begin
  select oid into authenticated_oid
  from pg_catalog.pg_roles
  where rolname = 'authenticated';

  if authenticated_oid is null then
    raise exception 'authenticated database role is absent';
  end if;

  select oid into expected_owner_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  if expected_owner_oid is null then
    raise exception 'expected production function owner postgres is absent';
  end if;

  if create_family_oid is null or (
    select count(*)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'create_my_family'
      and procedure.prokind = 'f'
  ) <> 1 then
    raise exception 'create_my_family must have exactly one reviewed signature';
  end if;

  select procedure.* into strict create_family_contract
  from pg_catalog.pg_proc procedure
  where procedure.oid = create_family_oid;

  if create_family_contract.proowner <> expected_owner_oid then
    raise exception 'create_my_family owner is not postgres';
  end if;

  if create_family_contract.proargtypes <> '25 25 25'::oidvector
    or create_family_contract.proallargtypes <> array[
      'text'::regtype,
      'text'::regtype,
      'text'::regtype,
      'uuid'::regtype
    ]::oid[]
    or create_family_contract.proargmodes <> array['i', 'i', 'i', 't']::"char"[]
    or create_family_contract.proargnames <> array[
      'family_name',
      'family_us_state',
      'parent_name',
      'family_id'
    ]::text[]
    or create_family_contract.pronargdefaults <> 3
    or not create_family_contract.proretset
    or create_family_contract.prorettype <> 'uuid'::regtype
    or create_family_contract.prolang <> (
      select oid from pg_catalog.pg_language where lanname = 'plpgsql'
    )
    or not create_family_contract.prosecdef
    or create_family_contract.proconfig
      is distinct from array['search_path=""']::text[]
  then
    raise exception 'create_my_family metadata differs from the reviewed contract';
  end if;

  if not exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        create_family_contract.proacl,
        pg_catalog.acldefault('f', create_family_contract.proowner)
      )
    ) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee = authenticated_oid
  ) or exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        create_family_contract.proacl,
        pg_catalog.acldefault('f', create_family_contract.proowner)
      )
    ) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee not in (
        create_family_contract.proowner,
        authenticated_oid
      )
  ) then
    raise exception 'create_my_family execute grants differ from the reviewed contract';
  end if;

  if pause_member_oid is null or (
    select count(*)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = 'pause_check_ins_for_removed_member'
      and procedure.prokind = 'f'
  ) <> 1 then
    raise exception
      'pause_check_ins_for_removed_member must have exactly one reviewed signature';
  end if;

  select procedure.* into strict pause_member_contract
  from pg_catalog.pg_proc procedure
  where procedure.oid = pause_member_oid;

  if pause_member_contract.proowner <> expected_owner_oid then
    raise exception 'pause_check_ins_for_removed_member owner is not postgres';
  end if;

  if pause_member_contract.pronargs <> 0
    or pause_member_contract.prorettype <> 'trigger'::regtype
    or pause_member_contract.prolang <> (
      select oid from pg_catalog.pg_language where lanname = 'plpgsql'
    )
    or not pause_member_contract.prosecdef
    or pause_member_contract.proconfig
      is distinct from array['search_path=""']::text[]
  then
    raise exception
      'pause_check_ins_for_removed_member metadata differs from the reviewed contract';
  end if;

  if exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        pause_member_contract.proacl,
        pg_catalog.acldefault('f', pause_member_contract.proowner)
      )
    ) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee <> pause_member_contract.proowner
  ) then
    raise exception
      'pause_check_ins_for_removed_member exposes an unexpected execute grant';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger trigger
    where trigger.tgname = 'family_members_pause_check_ins_before_removal'
      and trigger.tgrelid = 'public.family_members'::regclass
      and trigger.tgfoid = pause_member_oid
      and trigger.tgenabled = 'O'
      and not trigger.tgisinternal
  ) <> 1 then
    raise exception
      'family member removal trigger is not bound to the reviewed function';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806034000'
      and name = 'sandbox_live_auth_fixtures'
      and statements = array[
        'Issue 878 exact migration applied atomically',
        'sha256=4d6f2bd199a66206746ae3139e3b418397a1d953f4c9139ce5d6001798e3dd85'
      ]::text[]
  ) or not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806035000'
      and name = 'family_delete_progress_trigger'
      and statements = array[
        'Issue 878 exact migration applied atomically',
        'sha256=841ce177e122e393a8d5e37590b3290e2c6b3e1f1a813f158995ee0681c854d8'
      ]::text[]
  ) then
    raise exception 'issue 878 migration ledger hash evidence is absent or altered';
  end if;
end
$assert$;

select pg_temp.assert_issue_878_contract();

create or replace function pg_temp.assert_issue_878_probe(
  passed boolean,
  failure_message text
)
returns void
language plpgsql
as $assert$
begin
  if passed is distinct from true then
    raise exception '%', failure_message;
  end if;
end
$assert$;

create temporary table issue_878_probe_ids on commit drop as
select
  pg_catalog.gen_random_uuid() as reserved_user_id,
  pg_catalog.gen_random_uuid() as ordinary_user_id,
  pg_catalog.gen_random_uuid() as delete_user_id,
  pg_catalog.gen_random_uuid() as delete_family_id,
  pg_catalog.gen_random_uuid() as delete_child_id,
  pg_catalog.gen_random_uuid() as delete_check_in_id,
  pg_catalog.gen_random_uuid() as member_user_id,
  pg_catalog.gen_random_uuid() as member_family_id,
  pg_catalog.gen_random_uuid() as member_child_id,
  pg_catalog.gen_random_uuid() as member_check_in_id;

savepoint issue_878_reserved_email_probe;

insert into auth.users (id, email, email_confirmed_at)
select
  reserved_user_id,
  'issue-878+' || pg_catalog.replace(reserved_user_id::text, '-', '')
    || '+homatest@invalid.example',
  pg_catalog.now()
from issue_878_probe_ids;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  reserved_user_id::text,
  true
)
from issue_878_probe_ids;

set local role authenticated;

select family_id::text as reserved_family_id
from public.create_my_family(
  'Issue 878 reserved email probe',
  'AZ',
  'Migration probe'
)
\gset

reset role;

select pg_temp.assert_issue_878_probe(
  coalesce((
    select family.sandbox
    from public.families family
    where family.id = :'reserved_family_id'::uuid
  ), false),
  'reserved Auth email did not create a sandbox family'
);

rollback to savepoint issue_878_reserved_email_probe;

savepoint issue_878_ordinary_email_probe;

insert into auth.users (id, email, email_confirmed_at)
select
  ordinary_user_id,
  'issue-878-' || pg_catalog.replace(ordinary_user_id::text, '-', '')
    || '@invalid.example',
  pg_catalog.now()
from issue_878_probe_ids;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  ordinary_user_id::text,
  true
)
from issue_878_probe_ids;

set local role authenticated;

select family_id::text as ordinary_family_id
from public.create_my_family(
  'Issue 878 ordinary email probe',
  'AZ',
  'Migration probe'
)
\gset

reset role;

select pg_temp.assert_issue_878_probe(
  coalesce((
    select not family.sandbox
    from public.families family
    where family.id = :'ordinary_family_id'::uuid
  ), false),
  'ordinary Auth email was incorrectly marked as a sandbox family'
);

rollback to savepoint issue_878_ordinary_email_probe;

savepoint issue_878_whole_family_delete_probe;

insert into auth.users (id, email, email_confirmed_at)
select
  delete_user_id,
  'issue-878-delete-' || pg_catalog.replace(delete_user_id::text, '-', '')
    || '@invalid.example',
  pg_catalog.now()
from issue_878_probe_ids;

insert into public.families (id, name, sandbox)
select delete_family_id, 'Issue 878 whole-family delete probe', true
from issue_878_probe_ids;

insert into public.children (id, family_id, name, birth_month)
select
  delete_child_id,
  delete_family_id,
  'Issue 878 delete child',
  date '2019-07-01'
from issue_878_probe_ids;

insert into public.family_members (family_id, user_id, role, display_name)
select delete_family_id, delete_user_id, 'parent', 'Migration probe'
from issue_878_probe_ids;

insert into public.progress_check_ins (
  id,
  child_id,
  family_id,
  idempotency_key,
  purpose,
  scope,
  state,
  active_member_user_id,
  prompt_recipient_member_user_id,
  current_item_id,
  pending_runtime_session_id,
  pending_turn_id
)
select
  delete_check_in_id,
  delete_child_id,
  delete_family_id,
  'issue-878-whole-family-delete',
  'subject_deep_dive',
  '{"subject_ids":["science"]}'::jsonb,
  'active',
  delete_user_id,
  delete_user_id,
  'science.life-cycles',
  'issue-878-delete-session',
  'issue-878-delete-turn'
from issue_878_probe_ids;

delete from public.families family
using issue_878_probe_ids probe
where family.id = probe.delete_family_id;

select pg_temp.assert_issue_878_probe(
  not exists (
    select 1
    from public.families family
    join issue_878_probe_ids probe
      on probe.delete_family_id = family.id
  ) and not exists (
    select 1
    from public.progress_check_ins check_in
    join issue_878_probe_ids probe
      on probe.delete_check_in_id = check_in.id
  ) and not exists (
    select 1
    from public.events event
    join issue_878_probe_ids probe
      on probe.delete_family_id = event.family_id
    where event.name = 'progress.checkin_paused'
  ),
  'whole-family deletion did not finish cleanly without a pause event'
);

rollback to savepoint issue_878_whole_family_delete_probe;

savepoint issue_878_member_removal_probe;

insert into auth.users (id, email, email_confirmed_at)
select
  member_user_id,
  'issue-878-member-' || pg_catalog.replace(member_user_id::text, '-', '')
    || '@invalid.example',
  pg_catalog.now()
from issue_878_probe_ids;

insert into public.families (id, name, sandbox)
select member_family_id, 'Issue 878 member removal probe', true
from issue_878_probe_ids;

insert into public.children (id, family_id, name, birth_month)
select
  member_child_id,
  member_family_id,
  'Issue 878 member child',
  date '2019-07-01'
from issue_878_probe_ids;

insert into public.family_members (family_id, user_id, role, display_name)
select member_family_id, member_user_id, 'parent', 'Migration probe'
from issue_878_probe_ids;

insert into public.progress_check_ins (
  id,
  child_id,
  family_id,
  idempotency_key,
  purpose,
  scope,
  state,
  active_member_user_id,
  prompt_recipient_member_user_id,
  current_item_id,
  pending_runtime_session_id,
  pending_turn_id
)
select
  member_check_in_id,
  member_child_id,
  member_family_id,
  'issue-878-member-removal',
  'subject_deep_dive',
  '{"subject_ids":["science"]}'::jsonb,
  'active',
  member_user_id,
  member_user_id,
  'science.life-cycles',
  'issue-878-member-session',
  'issue-878-member-turn'
from issue_878_probe_ids;

delete from public.family_members member
using issue_878_probe_ids probe
where member.family_id = probe.member_family_id
  and member.user_id = probe.member_user_id;

select pg_temp.assert_issue_878_probe(
  exists (
    select 1
    from public.progress_check_ins check_in
    join issue_878_probe_ids probe
      on probe.member_check_in_id = check_in.id
    where check_in.state = 'paused'
      and check_in.pause_reason = 'member_removed'
      and check_in.active_member_user_id is null
      and check_in.prompt_recipient_member_user_id is null
      and check_in.pending_runtime_session_id is null
      and check_in.pending_turn_id is null
  ) and (
    select count(*)
    from public.events event
    join issue_878_probe_ids probe
      on probe.member_family_id = event.family_id
    where event.name = 'progress.checkin_paused'
      and event.props = pg_catalog.jsonb_build_object(
        'family_id', probe.member_family_id,
        'child_id', probe.member_child_id,
        'reason', 'member_removed'
      )
  ) = 1,
  'ordinary member removal did not pause the check-in and emit one exact event'
);

rollback to savepoint issue_878_member_removal_probe;

select 'ISSUE_878_REPAIR=' || case
  when sandbox_ledger_existed then 'verified_noop'
  else 'repaired'
end
from issue_878_repair_state;

drop function pg_temp.assert_issue_878_probe(boolean, text);
drop function pg_temp.assert_issue_878_contract();

commit;
