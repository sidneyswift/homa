\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '150s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('homa:issue:888:production-repair', 0)
);

-- Freeze the migration ledger, parent rows, and any existing receipt table
-- before reading the starting state. The advisory lock serializes two repair
-- sessions, while these relation locks stop ordinary writers from changing a
-- reviewed state between validation and commit.
lock table supabase_migrations.schema_migrations
  in share row exclusive mode;
lock table public.families in share row exclusive mode;

do $lock_existing_receipt_table$
begin
  begin
    execute
      'lock table public.month_plan_approvals in share row exclusive mode';
  exception
    when undefined_table then
      null;
  end;
end
$lock_existing_receipt_table$;

create temporary table issue_888_repair_state (
  original_ledger_existed boolean not null,
  boundary_ledger_existed boolean not null,
  table_name_existed boolean not null,
  primary_index_name_existed boolean not null,
  family_index_name_existed boolean not null
) on commit drop;

insert into issue_888_repair_state (
  original_ledger_existed,
  boundary_ledger_existed,
  table_name_existed,
  primary_index_name_existed,
  family_index_name_existed
)
select
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260801201500'
  ),
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806040000'
  ),
  to_regclass('public.month_plan_approvals') is not null,
  to_regclass('public.month_plan_approvals_pkey') is not null,
  to_regclass('public.month_plan_approvals_family_month_idx') is not null;

do $state_check$
declare
  repair_state issue_888_repair_state%rowtype;
  ledgers_present boolean;
  relations_present boolean;
begin
  select * into strict repair_state from issue_888_repair_state;

  if repair_state.original_ledger_existed
    is distinct from repair_state.boundary_ledger_existed
  then
    raise exception
      'issue 888 migration ledger is mixed; both reviewed versions must be absent or present';
  end if;

  ledgers_present := repair_state.original_ledger_existed;
  relations_present :=
    repair_state.table_name_existed
    and repair_state.primary_index_name_existed
    and repair_state.family_index_name_existed;

  if ledgers_present and not relations_present then
    raise exception
      'issue 888 relation state is mixed; both ledger rows require the table and both indexes';
  end if;

  if not ledgers_present and (
    repair_state.table_name_existed
    or repair_state.primary_index_name_existed
    or repair_state.family_index_name_existed
  ) then
    raise exception
      'issue 888 relation state is mixed; absent ledger rows require all reviewed relation names to be absent';
  end if;
end
$state_check$;

do $prerequisites$
begin
  if to_regclass('public.families') is null then
    raise exception 'issue 888 prerequisite public.families is absent';
  end if;

  if to_regprocedure('public.is_family_member(uuid)') is null then
    raise exception 'issue 888 prerequisite is_family_member(uuid) is absent';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'postgres'
  ) or not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'anon'
  ) or not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticated'
  ) or not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'service_role'
  ) then
    raise exception 'issue 888 requires the postgres and Supabase Data API roles';
  end if;
end
$prerequisites$;

create or replace function pg_temp.issue_888_original_statements()
returns text[]
language sql
immutable
as $statements$
  select array[
    $original_1$/* issue=888 source_sha256=82e13e2cb85667f8ec9e5d8f561fcc63332e34c90b19b168f2aad462065e8d66 */
create table if not exists public.month_plan_approvals (
  draft_id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  final_revision smallint not null check (final_revision >= 1),
  revision_history jsonb not null check (jsonb_typeof(revision_history) = 'array'),
  approved_at timestamptz not null default now()
)$original_1$,
    $original_2$create index if not exists month_plan_approvals_family_month_idx
  on public.month_plan_approvals (family_id, month_start desc)$original_2$,
    $original_3$alter table public.month_plan_approvals enable row level security$original_3$,
    $original_4$drop policy if exists "members read approved month plan history"
  on public.month_plan_approvals$original_4$,
    $original_5$create policy "members read approved month plan history"
  on public.month_plan_approvals for select to authenticated
  using (public.is_family_member(family_id))$original_5$,
    $original_6$revoke insert, update, delete on public.month_plan_approvals from authenticated$original_6$
  ]::text[]
$statements$;

create or replace function pg_temp.issue_888_boundary_statements()
returns text[]
language sql
immutable
as $statements$
  select array[
    $boundary_1$/* issue=888 source_sha256=9fabf67838a95a6cf6df569d275d0314c8304523ca9a494334da2a80bcab5a12 */
revoke all privileges on table public.month_plan_approvals
  from public, anon, authenticated$boundary_1$,
    $boundary_2$grant select on table public.month_plan_approvals to authenticated$boundary_2$,
    $boundary_3$grant all privileges on table public.month_plan_approvals to service_role$boundary_3$
  ]::text[]
$statements$;

select not original_ledger_existed as issue_888_apply
from issue_888_repair_state
\gset

\if :issue_888_apply
\ir ../supabase/migrations/20260801201500_month_plan_approvals.sql
\ir ../supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql

insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values
  (
    '20260801201500',
    pg_temp.issue_888_original_statements(),
    'month_plan_approvals'
  ),
  (
    '20260806040000',
    pg_temp.issue_888_boundary_statements(),
    'month_plan_approvals_write_boundary'
  );
\endif

create or replace function pg_temp.assert_issue_888_contract()
returns void
language plpgsql
as $assert$
declare
  table_oid oid := to_regclass('public.month_plan_approvals');
  primary_index_oid oid := to_regclass('public.month_plan_approvals_pkey');
  family_index_oid oid :=
    to_regclass('public.month_plan_approvals_family_month_idx');
  expected_owner_oid oid;
  authenticated_oid oid;
  service_role_oid oid;
  table_contract record;
  primary_index_contract record;
  family_index_contract record;
  policy_contract record;
  column_names text[];
  column_types oid[];
  column_type_modifiers integer[];
  column_not_null boolean[];
  column_defaults text[];
  privilege_count integer;
  expected_all_privilege_count integer;
begin
  select oid into expected_owner_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  select oid into authenticated_oid
  from pg_catalog.pg_roles
  where rolname = 'authenticated';

  select oid into service_role_oid
  from pg_catalog.pg_roles
  where rolname = 'service_role';

  if table_oid is null then
    raise exception 'month_plan_approvals table is absent';
  end if;

  select relation.* into strict table_contract
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where relation.oid = table_oid
    and namespace.nspname = 'public'
    and relation.relname = 'month_plan_approvals';

  if table_contract.relkind <> 'r'
    or table_contract.relpersistence <> 'p'
    or table_contract.relispartition
    or table_contract.relowner <> expected_owner_oid
    or not table_contract.relrowsecurity
    or table_contract.relforcerowsecurity
  then
    raise exception
      'month_plan_approvals relation metadata differs from the reviewed contract';
  end if;

  select
    pg_catalog.array_agg(attribute.attname order by attribute.attnum),
    pg_catalog.array_agg(attribute.atttypid order by attribute.attnum),
    pg_catalog.array_agg(attribute.atttypmod order by attribute.attnum),
    pg_catalog.array_agg(attribute.attnotnull order by attribute.attnum),
    pg_catalog.array_agg(
      coalesce(
        pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid),
        '<none>'
      )
      order by attribute.attnum
    )
  into
    column_names,
    column_types,
    column_type_modifiers,
    column_not_null,
    column_defaults
  from pg_catalog.pg_attribute attribute
  left join pg_catalog.pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
    and default_value.adnum = attribute.attnum
  where attribute.attrelid = table_oid
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if column_names is distinct from array[
      'draft_id',
      'family_id',
      'month_start',
      'final_revision',
      'revision_history',
      'approved_at'
    ]::text[]
    or column_types is distinct from array[
      'uuid'::regtype,
      'uuid'::regtype,
      'date'::regtype,
      'smallint'::regtype,
      'jsonb'::regtype,
      'timestamp with time zone'::regtype
    ]::oid[]
    or column_type_modifiers is distinct from array[-1, -1, -1, -1, -1, -1]
    or column_not_null is distinct from array[true, true, true, true, true, true]
    or column_defaults is distinct from array[
      '<none>',
      '<none>',
      '<none>',
      '<none>',
      '<none>',
      'now()'
    ]::text[]
    or exists (
      select 1
      from pg_catalog.pg_attribute attribute
      where attribute.attrelid = table_oid
        and attribute.attnum > 0
        and (
          attribute.attisdropped
          or (
            attribute.attidentity <> ''
            or attribute.attgenerated <> ''
          )
        )
    )
  then
    raise exception
      'month_plan_approvals columns differ from the reviewed six-column contract';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = table_oid
  ) <> 5 then
    raise exception
      'month_plan_approvals must have exactly five reviewed constraints';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.conname = 'month_plan_approvals_pkey'
      and constraint_record.contype = 'p'
      and constraint_record.conkey = array[1]::smallint[]
      and constraint_record.conindid = primary_index_oid
      and constraint_record.convalidated
      and not constraint_record.condeferrable
      and not constraint_record.condeferred
  ) then
    raise exception 'month_plan_approvals primary key differs from contract';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.conname = 'month_plan_approvals_family_id_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.conkey = array[2]::smallint[]
      and constraint_record.confrelid = 'public.families'::regclass
      and constraint_record.confkey = array[
        (
          select attribute.attnum
          from pg_catalog.pg_attribute attribute
          where attribute.attrelid = 'public.families'::regclass
            and attribute.attname = 'id'
            and not attribute.attisdropped
        )
      ]::smallint[]
      and constraint_record.confupdtype = 'a'
      and constraint_record.confdeltype = 'c'
      and constraint_record.confmatchtype = 's'
      and constraint_record.convalidated
      and not constraint_record.condeferrable
      and not constraint_record.condeferred
  ) then
    raise exception
      'month_plan_approvals family cascade differs from contract';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.conname = 'month_plan_approvals_month_start_check'
      and constraint_record.contype = 'c'
      and constraint_record.conkey = array[3]::smallint[]
      and pg_catalog.pg_get_expr(
        constraint_record.conbin,
        constraint_record.conrelid
      ) = '(EXTRACT(day FROM month_start) = (1)::numeric)'
      and constraint_record.convalidated
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.conname = 'month_plan_approvals_final_revision_check'
      and constraint_record.contype = 'c'
      and constraint_record.conkey = array[4]::smallint[]
      and pg_catalog.pg_get_expr(
        constraint_record.conbin,
        constraint_record.conrelid
      ) = '(final_revision >= 1)'
      and constraint_record.convalidated
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.conname = 'month_plan_approvals_revision_history_check'
      and constraint_record.contype = 'c'
      and constraint_record.conkey = array[5]::smallint[]
      and pg_catalog.pg_get_expr(
        constraint_record.conbin,
        constraint_record.conrelid
      ) = '(jsonb_typeof(revision_history) = ''array''::text)'
      and constraint_record.convalidated
  ) then
    raise exception 'month_plan_approvals check constraints differ from contract';
  end if;

  if primary_index_oid is null or family_index_oid is null or (
    select count(*)
    from pg_catalog.pg_index index_record
    where index_record.indrelid = table_oid
  ) <> 2 then
    raise exception 'month_plan_approvals must have exactly two reviewed indexes';
  end if;

  select
    index_record.*,
    index_relation.relkind as index_relkind,
    index_relation.relowner as index_owner,
    access_method.amname as access_method_name,
    array(
      select operator_class.opcname
      from unnest(index_record.indclass::oid[]) with ordinality
        operator_class_oid(oid, position)
      join pg_catalog.pg_opclass operator_class
        on operator_class.oid = operator_class_oid.oid
      order by operator_class_oid.position
    ) as operator_classes
  into strict primary_index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = primary_index_oid;

  if primary_index_contract.indrelid <> table_oid
    or primary_index_contract.index_relkind <> 'i'
    or primary_index_contract.index_owner <> expected_owner_oid
    or primary_index_contract.access_method_name <> 'btree'
    or not primary_index_contract.indisunique
    or not primary_index_contract.indisprimary
    or not primary_index_contract.indimmediate
    or not primary_index_contract.indisvalid
    or not primary_index_contract.indisready
    or not primary_index_contract.indislive
    or primary_index_contract.indisexclusion
    or primary_index_contract.indnullsnotdistinct
    or primary_index_contract.indisclustered
    or primary_index_contract.indisreplident
    or primary_index_contract.indnkeyatts <> 1
    or primary_index_contract.indnatts <> 1
    or primary_index_contract.indkey::text <> '1'
    or primary_index_contract.indoption::text <> '0'
    or primary_index_contract.indcollation::text <> '0'
    or primary_index_contract.indexprs is not null
    or primary_index_contract.indpred is not null
    or primary_index_contract.operator_classes
      is distinct from array['uuid_ops']::name[]
  then
    raise exception 'month_plan_approvals primary index differs from contract';
  end if;

  select
    index_record.*,
    index_relation.relkind as index_relkind,
    index_relation.relowner as index_owner,
    access_method.amname as access_method_name,
    array(
      select operator_class.opcname
      from unnest(index_record.indclass::oid[]) with ordinality
        operator_class_oid(oid, position)
      join pg_catalog.pg_opclass operator_class
        on operator_class.oid = operator_class_oid.oid
      order by operator_class_oid.position
    ) as operator_classes
  into strict family_index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = family_index_oid;

  if family_index_contract.indrelid <> table_oid
    or family_index_contract.index_relkind <> 'i'
    or family_index_contract.index_owner <> expected_owner_oid
    or family_index_contract.access_method_name <> 'btree'
    or family_index_contract.indisunique
    or family_index_contract.indisprimary
    or not family_index_contract.indimmediate
    or not family_index_contract.indisvalid
    or not family_index_contract.indisready
    or not family_index_contract.indislive
    or family_index_contract.indisexclusion
    or family_index_contract.indnullsnotdistinct
    or family_index_contract.indisclustered
    or family_index_contract.indisreplident
    or family_index_contract.indnkeyatts <> 2
    or family_index_contract.indnatts <> 2
    or family_index_contract.indkey::text <> '2 3'
    or family_index_contract.indoption::text <> '0 3'
    or family_index_contract.indcollation::text <> '0 0'
    or family_index_contract.indexprs is not null
    or family_index_contract.indpred is not null
    or family_index_contract.operator_classes
      is distinct from array['uuid_ops', 'date_ops']::name[]
  then
    raise exception 'month_plan_approvals family-month index differs from contract';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policy policy
    where policy.polrelid = table_oid
  ) <> 1 then
    raise exception 'month_plan_approvals must have exactly one reviewed policy';
  end if;

  select policy.* into strict policy_contract
  from pg_catalog.pg_policy policy
  where policy.polrelid = table_oid;

  if policy_contract.polname <> 'members read approved month plan history'
    or policy_contract.polcmd <> 'r'
    or not policy_contract.polpermissive
    or policy_contract.polroles is distinct from array[authenticated_oid]::oid[]
    or pg_catalog.pg_get_expr(
      policy_contract.polqual,
      policy_contract.polrelid
    ) <> 'is_family_member(family_id)'
    or policy_contract.polwithcheck is not null
  then
    raise exception 'month_plan_approvals policy differs from contract';
  end if;

  select count(*) into privilege_count
  from pg_catalog.aclexplode(
    coalesce(
      table_contract.relacl,
      pg_catalog.acldefault('r', table_contract.relowner)
    )
  );

  select count(*) into expected_all_privilege_count
  from pg_catalog.aclexplode(
    pg_catalog.acldefault('r', table_contract.relowner)
  );

  if privilege_count <> (expected_all_privilege_count * 2) + 1
    or (
      select count(*)
      from pg_catalog.aclexplode(table_contract.relacl)
      where grantee = expected_owner_oid
    ) <> expected_all_privilege_count
    or (
      select count(*)
      from pg_catalog.aclexplode(table_contract.relacl)
      where grantee = service_role_oid
    ) <> expected_all_privilege_count
    or (
      select count(*)
      from pg_catalog.aclexplode(table_contract.relacl)
      where grantee = authenticated_oid
        and privilege_type = 'SELECT'
    ) <> 1
    or exists (
      select 1
      from pg_catalog.aclexplode(table_contract.relacl)
      where grantee not in (
        expected_owner_oid,
        authenticated_oid,
        service_role_oid
      )
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(table_contract.relacl)
      where grantee = authenticated_oid
        and privilege_type <> 'SELECT'
    )
    or exists (
      select 1
      from pg_catalog.aclexplode(table_contract.relacl) privilege
      where privilege.grantor <> expected_owner_oid
        or privilege.is_grantable
    )
    or exists (
      select 1
      from pg_catalog.pg_attribute attribute
      where attribute.attrelid = table_oid
        and attribute.attnum > 0
        and attribute.attacl is not null
    )
    or exists (
      select privilege.privilege_type
      from pg_catalog.aclexplode(table_contract.relacl) privilege
      where privilege.grantee in (expected_owner_oid, service_role_oid)
      except
      select default_privilege.privilege_type
      from pg_catalog.aclexplode(
        pg_catalog.acldefault('r', table_contract.relowner)
      ) default_privilege
    )
    or exists (
      select default_privilege.privilege_type
      from pg_catalog.aclexplode(
        pg_catalog.acldefault('r', table_contract.relowner)
      ) default_privilege
      except
      select privilege.privilege_type
      from pg_catalog.aclexplode(table_contract.relacl) privilege
      where privilege.grantee = expected_owner_oid
    )
    or exists (
      select default_privilege.privilege_type
      from pg_catalog.aclexplode(
        pg_catalog.acldefault('r', table_contract.relowner)
      ) default_privilege
      except
      select privilege.privilege_type
      from pg_catalog.aclexplode(table_contract.relacl) privilege
      where privilege.grantee = service_role_oid
    )
  then
    raise exception 'month_plan_approvals ACL differs from contract';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260801201500'
      and name = 'month_plan_approvals'
      and statements = pg_temp.issue_888_original_statements()
  ) or not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806040000'
      and name = 'month_plan_approvals_write_boundary'
      and statements = pg_temp.issue_888_boundary_statements()
  ) then
    raise exception 'issue 888 migration ledger hash evidence is absent or altered';
  end if;
end
$assert$;

select pg_temp.assert_issue_888_contract();

create or replace function pg_temp.assert_issue_888_probe(
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

create or replace function pg_temp.issue_888_browser_write_denied(
  operation text,
  probe_draft_id uuid,
  probe_family_id uuid
)
returns boolean
language plpgsql
as $probe$
begin
  if operation = 'insert' then
    insert into public.month_plan_approvals (
      draft_id,
      family_id,
      month_start,
      final_revision,
      revision_history
    ) values (
      probe_draft_id,
      probe_family_id,
      date '2026-09-01',
      1,
      '[]'::jsonb
    );
  elsif operation = 'update' then
    update public.month_plan_approvals
    set final_revision = final_revision + 1
    where draft_id = probe_draft_id;
  elsif operation = 'delete' then
    delete from public.month_plan_approvals
    where draft_id = probe_draft_id;
  elsif operation = 'truncate' then
    truncate table public.month_plan_approvals;
  else
    raise exception 'unknown issue 888 probe operation %', operation;
  end if;

  return false;
exception
  when insufficient_privilege then
    return true;
end
$probe$;

create temporary table issue_888_probe_ids on commit drop as
select
  pg_catalog.gen_random_uuid() as first_user_id,
  pg_catalog.gen_random_uuid() as second_user_id,
  pg_catalog.gen_random_uuid() as first_family_id,
  pg_catalog.gen_random_uuid() as second_family_id,
  pg_catalog.gen_random_uuid() as first_draft_id,
  pg_catalog.gen_random_uuid() as second_draft_id,
  pg_catalog.gen_random_uuid() as denied_draft_id;

grant select on issue_888_probe_ids to authenticated, service_role;

savepoint issue_888_access_probe;

insert into auth.users (id, email, email_confirmed_at)
select
  first_user_id,
  'issue-888-first-' || pg_catalog.replace(first_user_id::text, '-', '')
    || '@invalid.example',
  pg_catalog.now()
from issue_888_probe_ids
union all
select
  second_user_id,
  'issue-888-second-' || pg_catalog.replace(second_user_id::text, '-', '')
    || '@invalid.example',
  pg_catalog.now()
from issue_888_probe_ids;

insert into public.families (id, name, sandbox)
select first_family_id, 'Issue 888 first access probe', true
from issue_888_probe_ids
union all
select second_family_id, 'Issue 888 second access probe', true
from issue_888_probe_ids;

insert into public.family_members (family_id, user_id, role, display_name)
select first_family_id, first_user_id, 'parent', 'Issue 888 probe'
from issue_888_probe_ids
union all
select second_family_id, second_user_id, 'parent', 'Issue 888 probe'
from issue_888_probe_ids;

set local role service_role;

insert into public.month_plan_approvals (
  draft_id,
  family_id,
  month_start,
  final_revision,
  revision_history
)
select
  first_draft_id,
  first_family_id,
  date '2026-09-01',
  2,
  '[{"revision":1},{"revision":2}]'::jsonb
from issue_888_probe_ids
union all
select
  second_draft_id,
  second_family_id,
  date '2026-10-01',
  1,
  '[{"revision":1}]'::jsonb
from issue_888_probe_ids;

reset role;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  first_user_id::text,
  true
)
from issue_888_probe_ids;

set local role authenticated;

select pg_temp.assert_issue_888_probe(
  (
    select count(*) = 1
    from public.month_plan_approvals approval
    join issue_888_probe_ids probe
      on approval.draft_id in (probe.first_draft_id, probe.second_draft_id)
  ),
  'authenticated family member did not read exactly one family receipt'
);

select pg_temp.assert_issue_888_probe(
  pg_temp.issue_888_browser_write_denied(
    'insert',
    denied_draft_id,
    first_family_id
  ),
  'authenticated insert was not denied'
)
from issue_888_probe_ids;

select pg_temp.assert_issue_888_probe(
  pg_temp.issue_888_browser_write_denied(
    'update',
    first_draft_id,
    first_family_id
  ),
  'authenticated update was not denied'
)
from issue_888_probe_ids;

select pg_temp.assert_issue_888_probe(
  pg_temp.issue_888_browser_write_denied(
    'delete',
    first_draft_id,
    first_family_id
  ),
  'authenticated delete was not denied'
)
from issue_888_probe_ids;

select pg_temp.assert_issue_888_probe(
  pg_temp.issue_888_browser_write_denied(
    'truncate',
    first_draft_id,
    first_family_id
  ),
  'authenticated truncate was not denied'
)
from issue_888_probe_ids;

reset role;

set local role service_role;

update public.month_plan_approvals approval
set final_revision = 3
from issue_888_probe_ids probe
where approval.draft_id = probe.first_draft_id;

select pg_temp.assert_issue_888_probe(
  (
    select approval.final_revision = 3
      and approval.approved_at is not null
    from public.month_plan_approvals approval
    join issue_888_probe_ids probe
      on approval.draft_id = probe.first_draft_id
  ),
  'service_role could not write and read an exact approval receipt'
);

delete from public.month_plan_approvals approval
using issue_888_probe_ids probe
where approval.draft_id = probe.second_draft_id;

select pg_temp.assert_issue_888_probe(
  not exists (
    select 1
    from public.month_plan_approvals approval
    join issue_888_probe_ids probe
      on approval.draft_id = probe.second_draft_id
  ),
  'service_role could not delete an approval receipt'
);

reset role;

rollback to savepoint issue_888_access_probe;

select pg_temp.assert_issue_888_contract();

select 'ISSUE_888_REPAIR=' || case
  when original_ledger_existed then 'verified_noop'
  else 'repaired'
end
from issue_888_repair_state;

drop function pg_temp.issue_888_browser_write_denied(text, uuid, uuid);
drop function pg_temp.assert_issue_888_probe(boolean, text);
drop function pg_temp.assert_issue_888_contract();
drop function pg_temp.issue_888_boundary_statements();
drop function pg_temp.issue_888_original_statements();

commit;
