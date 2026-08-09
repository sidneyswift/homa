\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '150s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'homa:issue:878:account-deletion-containment',
    0
  )
);

lock table supabase_migrations.schema_migrations
  in share row exclusive mode;
lock table public.account_deletion_jobs
  in share row exclusive mode;

create temporary table issue_878_containment_state (
  ledger_existed boolean not null
) on commit drop;

insert into issue_878_containment_state
select
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260809030000'
  );

do $active_job_gate$
begin
  if exists (
    select 1
    from public.account_deletion_jobs
    where status <> 'complete'
  ) then
    raise exception
      'account deletion containment requires zero non-complete deletion jobs';
  end if;
end
$active_job_gate$;

select not ledger_existed as issue_878_containment_apply
from issue_878_containment_state
\gset

\if :issue_878_containment_apply
\ir ../supabase/migrations/20260809030000_pause_legacy_account_deletion.sql
\endif

create or replace function pg_temp.issue_878_containment_ledger_statements()
returns text[]
language sql
stable
as $ledger$
  select array[
    pg_catalog.format(
      E'/* Homa issue 878: exact 20260809030000_pause_legacy_account_deletion.sql applied atomically. */\n/* sha256=d654b9c3666a67fadcf667861063850394e805aee5d9522e9ea62407c075b96a */\n%s',
      pg_catalog.pg_get_functiondef(
        'public.delete_own_account()'::regprocedure
      )
    ),
    'revoke all on function public.delete_own_account() from public, anon, authenticated, service_role'
  ]::text[]
$ledger$;

\if :issue_878_containment_apply
insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260809030000',
  pg_temp.issue_878_containment_ledger_statements(),
  'pause_legacy_account_deletion'
);
\endif

create or replace function pg_temp.assert_issue_878_containment()
returns void
language plpgsql
as $assert$
declare
  function_oid oid := to_regprocedure('public.delete_own_account()');
  function_contract record;
  expected_owner_oid oid;
begin
  select oid into expected_owner_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  if expected_owner_oid is null then
    raise exception 'expected production function owner postgres is absent';
  end if;

  if function_oid is null or (
    select count(*)
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'delete_own_account'
      and procedure.prokind = 'f'
  ) <> 1 then
    raise exception 'delete_own_account must have exactly one reviewed signature';
  end if;

  select procedure.* into strict function_contract
  from pg_catalog.pg_proc procedure
  where procedure.oid = function_oid;

  if function_contract.proowner <> expected_owner_oid then
    raise exception 'delete_own_account owner is not postgres';
  end if;

  if function_contract.pronargs <> 0
    or function_contract.prorettype <> 'void'::regtype
    or function_contract.prolang <> (
      select oid from pg_catalog.pg_language where lanname = 'plpgsql'
    )
    or not function_contract.prosecdef
    or function_contract.proconfig
      is distinct from array['search_path=""']::text[]
  then
    raise exception 'delete_own_account metadata differs from containment';
  end if;

  if pg_catalog.btrim(function_contract.prosrc, E' \n\r\t') is distinct from
    $expected$begin
  raise exception using
    errcode = '55000',
    message = 'account deletion is temporarily unavailable';
end;$expected$
  then
    raise exception 'delete_own_account body differs from containment';
  end if;

  if exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        function_contract.proacl,
        pg_catalog.acldefault('f', function_contract.proowner)
      )
    ) privilege
    where privilege.privilege_type = 'EXECUTE'
      and privilege.grantee <> function_contract.proowner
  ) then
    raise exception 'delete_own_account exposes an unexpected execute grant';
  end if;

  if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
    or pg_catalog.has_function_privilege(
      'authenticated',
      function_oid,
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'service_role',
      function_oid,
      'EXECUTE'
    )
  then
    raise exception 'a client role can still execute delete_own_account';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260809030000'
      and name = 'pause_legacy_account_deletion'
      and statements = pg_temp.issue_878_containment_ledger_statements()
  ) then
    raise exception 'account-deletion containment ledger evidence is absent or altered';
  end if;

  begin
    perform public.delete_own_account();
    raise exception 'delete_own_account unexpectedly returned';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'account deletion is temporarily unavailable' then
        raise exception 'delete_own_account returned the wrong containment error';
      end if;
  end;
end
$assert$;

select pg_temp.assert_issue_878_containment();

\if :issue_878_containment_apply
select 'ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied';
\else
select 'ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=verified_noop';
\endif

commit;
