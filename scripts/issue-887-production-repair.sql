\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local idle_in_transaction_session_timeout = '150s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('homa:issue:887:production-repair', 0)
);

create temporary table issue_887_expected_migrations (
  version text primary key,
  statements text[] not null,
  name text not null
) on commit drop;

insert into issue_887_expected_migrations (version, statements, name)
values
  (
    '20260801110000',
    array[
      '-- Issue 887 original_sha256=0215e6ea62dde4f9a64f2d62e08ab89121e8b06a838812d39fc2f660f0fe8198 executable_sha256=5ed8f1bf0df5d940cd61de1427a7aa1adaa09582f2528ba7240b180fedaa7909',
      $issue_887_original_table$create table if not exists public.family_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'apple', 'google')),
  provider_subscription_id text not null,
  provider_customer_id text,
  provider_product_id text,
  plan_tier text not null default 'regular'
    check (plan_tier in ('regular', 'plus', 'elite')),
  billing_period text check (billing_period in ('monthly', 'annual')),
  status text not null,
  current_period_end timestamptz,
  last_observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);$issue_887_original_table$,
      $issue_887_original_family_index$create index if not exists family_billing_subscriptions_family_observed_idx
  on public.family_billing_subscriptions (family_id, last_observed_at desc);$issue_887_original_family_index$,
      $issue_887_original_customer_index$create index if not exists family_billing_subscriptions_provider_customer_idx
  on public.family_billing_subscriptions (provider, provider_customer_id)
  where provider_customer_id is not null;$issue_887_original_customer_index$,
      'alter table public.family_billing_subscriptions enable row level security;',
      $issue_887_original_revoke$revoke all on table public.family_billing_subscriptions
  from public, anon, authenticated;$issue_887_original_revoke$,
      'grant all privileges on table public.family_billing_subscriptions to service_role;',
      $issue_887_original_stripe$insert into public.family_billing_subscriptions (
  family_id, provider, provider_subscription_id, provider_customer_id,
  provider_product_id, plan_tier, billing_period, status,
  current_period_end, last_observed_at
)
select
  id, 'stripe', stripe_subscription_id, stripe_customer_id, stripe_price_id,
  plan_tier, null, coalesce(stripe_subscription_status, 'active'),
  stripe_current_period_end, coalesce(billing_updated_at, now())
from public.families
where stripe_subscription_id is not null
on conflict (provider, provider_subscription_id) do update
  set provider_customer_id = excluded.provider_customer_id,
      provider_product_id = excluded.provider_product_id,
      plan_tier = excluded.plan_tier,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      last_observed_at = excluded.last_observed_at,
      updated_at = now();$issue_887_original_stripe$,
      $issue_887_original_apple$insert into public.family_billing_subscriptions (
  family_id, provider, provider_subscription_id, provider_customer_id,
  provider_product_id, plan_tier, billing_period, status,
  current_period_end, last_observed_at
)
select
  id, 'apple', apple_original_transaction_id, null, apple_product_id,
  plan_tier, null, coalesce(apple_subscription_status, 'active'),
  apple_expires_at, coalesce(billing_updated_at, now())
from public.families
where apple_original_transaction_id is not null
on conflict (provider, provider_subscription_id) do update
  set provider_product_id = excluded.provider_product_id,
      plan_tier = excluded.plan_tier,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      last_observed_at = excluded.last_observed_at,
      updated_at = now();$issue_887_original_apple$
    ]::text[],
    'family_billing_subscriptions'
  ),
  (
    '20260806093000',
    array[
      '-- Issue 887 source sha256=07e432ffbf449427ac43a7f4433dae3f5b083cbb9b185edff75a774b310464c7',
      $issue_887_correction$update public.family_billing_subscriptions as subscription
set provider_product_id = null
from public.families as family
where subscription.family_id = family.id
  and subscription.provider = 'stripe'
  and subscription.provider_product_id = family.stripe_price_id;$issue_887_correction$
    ]::text[],
    'correct_billing_provider_product_identity'
  );

create temporary table issue_887_repair_state (
  original_ledger_existed boolean not null,
  correction_ledger_existed boolean not null,
  table_existed boolean not null,
  primary_index_existed boolean not null,
  unique_index_existed boolean not null,
  family_index_existed boolean not null,
  customer_index_existed boolean not null,
  repair_transaction_timestamp timestamptz not null
) on commit drop;

insert into issue_887_repair_state (
  original_ledger_existed,
  correction_ledger_existed,
  table_existed,
  primary_index_existed,
  unique_index_existed,
  family_index_existed,
  customer_index_existed,
  repair_transaction_timestamp
)
select
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260801110000'
  ),
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260806093000'
  ),
  to_regclass('public.family_billing_subscriptions') is not null,
  to_regclass('public.family_billing_subscriptions_pkey') is not null,
  to_regclass(
    'public.family_billing_subscriptions_provider_provider_subscription_key'
  ) is not null,
  to_regclass('public.family_billing_subscriptions_family_observed_idx') is not null,
  to_regclass('public.family_billing_subscriptions_provider_customer_idx') is not null,
  pg_catalog.now();

do $state_check$
declare
  repair_state issue_887_repair_state%rowtype;
begin
  select * into strict repair_state from issue_887_repair_state;

  if exists (
    select 1
    from supabase_migrations.schema_migrations migration
    where (
      migration.name = 'family_billing_subscriptions'
      and migration.version <> '20260801110000'
    ) or (
      migration.name = 'correct_billing_provider_product_identity'
      and migration.version <> '20260806093000'
    )
  ) or not (
    (
      not repair_state.original_ledger_existed
      and not repair_state.correction_ledger_existed
      and not repair_state.table_existed
      and not repair_state.primary_index_existed
      and not repair_state.unique_index_existed
      and not repair_state.family_index_existed
      and not repair_state.customer_index_existed
    )
    or (
      repair_state.original_ledger_existed
      and not repair_state.correction_ledger_existed
      and repair_state.table_existed
      and repair_state.primary_index_existed
      and repair_state.unique_index_existed
      and repair_state.family_index_existed
      and repair_state.customer_index_existed
    )
    or (
      repair_state.original_ledger_existed
      and repair_state.correction_ledger_existed
      and repair_state.table_existed
      and repair_state.primary_index_existed
      and repair_state.unique_index_existed
      and repair_state.family_index_existed
      and repair_state.customer_index_existed
    )
  ) then
    raise exception
      'issue 887 migration state is mixed; expected fresh, original-only, or complete state';
  end if;
end
$state_check$;

create temporary table issue_887_reviewed_snapshot on commit drop as
select
  count(*) filter (
    where family.stripe_subscription_id is not null
  )::integer as stripe_records,
  count(distinct family.stripe_subscription_id) filter (
    where family.stripe_subscription_id is not null
  )::integer as distinct_stripe_subscription_ids,
  count(*) filter (
    where family.apple_original_transaction_id is not null
  )::integer as apple_records,
  count(*) filter (
    where (
      family.stripe_subscription_id is not null
      or family.apple_original_transaction_id is not null
    )
      and (
        family.plan_tier is null
        or family.plan_tier not in ('regular', 'plus', 'elite')
      )
  )::integer as invalid_plan_tiers,
  count(*) filter (
    where (
      family.stripe_subscription_id is not null
      and family.stripe_subscription_status is null
    ) or (
      family.apple_original_transaction_id is not null
      and family.apple_subscription_status is null
    )
  )::integer as null_statuses
from public.families as family;

do $snapshot_check$
declare
  snapshot issue_887_reviewed_snapshot%rowtype;
begin
  select * into strict snapshot from issue_887_reviewed_snapshot;

  if snapshot.stripe_records <> 3
    or snapshot.distinct_stripe_subscription_ids <> 3
    or snapshot.apple_records <> 0
    or snapshot.invalid_plan_tiers <> 0
    or snapshot.null_statuses <> 0
  then
    raise exception
      'issue 887 live billing snapshot differs from the reviewed 3 Stripe, 0 Apple contract';
  end if;
end
$snapshot_check$;

create temporary table issue_887_compatibility_snapshot on commit drop as
select
  family.id,
  family.stripe_customer_id,
  family.stripe_subscription_id,
  family.stripe_price_id,
  family.stripe_subscription_status,
  family.stripe_current_period_end,
  family.apple_original_transaction_id,
  family.apple_product_id,
  family.apple_subscription_status,
  family.apple_expires_at,
  family.plan_tier,
  family.billing_updated_at
from public.families as family
where family.stripe_subscription_id is not null
  or family.apple_original_transaction_id is not null;

create temporary table issue_887_subscription_snapshot (
  id uuid primary key,
  family_id uuid not null,
  provider text not null,
  provider_subscription_id text not null,
  provider_customer_id text,
  provider_product_id text,
  plan_tier text not null,
  billing_period text,
  status text not null,
  current_period_end timestamptz,
  last_observed_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
) on commit drop;

select table_existed as issue_887_snapshot_existing_subscriptions
from issue_887_repair_state
\gset

\if :issue_887_snapshot_existing_subscriptions
insert into issue_887_subscription_snapshot
select
  subscription.id,
  subscription.family_id,
  subscription.provider,
  subscription.provider_subscription_id,
  subscription.provider_customer_id,
  subscription.provider_product_id,
  subscription.plan_tier,
  subscription.billing_period,
  subscription.status,
  subscription.current_period_end,
  subscription.last_observed_at,
  subscription.created_at,
  subscription.updated_at
from public.family_billing_subscriptions as subscription;
\endif

select
  not original_ledger_existed as issue_887_apply_original,
  not correction_ledger_existed as issue_887_apply_correction
from issue_887_repair_state
\gset

\if :issue_887_apply_original
\ir ../supabase/migrations/20260801110000_family_billing_subscriptions.sql

insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
select version, statements, name
from issue_887_expected_migrations
where version = '20260801110000';
\endif

\if :issue_887_apply_correction
\ir ../supabase/migrations/20260806093000_correct_billing_provider_product_identity.sql

insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
select version, statements, name
from issue_887_expected_migrations
where version = '20260806093000';
\endif

create or replace function pg_temp.assert_issue_887_contract()
returns void
language plpgsql
as $assert$
declare
  relation_oid oid := to_regclass('public.family_billing_subscriptions');
  primary_index_oid oid :=
    to_regclass('public.family_billing_subscriptions_pkey');
  unique_index_oid oid := to_regclass(
    'public.family_billing_subscriptions_provider_provider_subscription_key'
  );
  family_index_oid oid :=
    to_regclass('public.family_billing_subscriptions_family_observed_idx');
  customer_index_oid oid :=
    to_regclass('public.family_billing_subscriptions_provider_customer_idx');
  expected_owner_oid oid;
  service_role_oid oid;
  family_id_attnum smallint;
  families_id_attnum smallint;
  actual_columns text[];
  table_contract record;
  primary_index_contract record;
  unique_index_contract record;
  family_index_contract record;
  customer_index_contract record;
  privilege_count integer;
  expected_all_privilege_count integer;
begin
  select oid into expected_owner_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  select oid into service_role_oid
  from pg_catalog.pg_roles
  where rolname = 'service_role';

  if expected_owner_oid is null or service_role_oid is null then
    raise exception 'expected production table roles are absent';
  end if;

  if relation_oid is null then
    raise exception 'family_billing_subscriptions relation is absent';
  end if;

  select relation.* into strict table_contract
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where relation.oid = relation_oid
    and namespace.nspname = 'public'
    and relation.relname = 'family_billing_subscriptions';

  if table_contract.relkind <> 'r'
    or table_contract.relpersistence <> 'p'
    or table_contract.relispartition
    or table_contract.relowner <> expected_owner_oid
    or not table_contract.relrowsecurity
    or table_contract.relforcerowsecurity
  then
    raise exception
      'family_billing_subscriptions relation metadata differs from the reviewed contract';
  end if;

  select array_agg(
    pg_catalog.concat_ws(
      '|',
      attribute.attname,
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
      case when attribute.attnotnull then 'not null' else 'nullable' end,
      coalesce(
        pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid),
        '<none>'
      )
    )
    order by attribute.attnum
  )
  into actual_columns
  from pg_catalog.pg_attribute attribute
  left join pg_catalog.pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
   and default_value.adnum = attribute.attnum
  where attribute.attrelid = relation_oid
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if actual_columns is distinct from array[
    'id|uuid|not null|gen_random_uuid()',
    'family_id|uuid|not null|<none>',
    'provider|text|not null|<none>',
    'provider_subscription_id|text|not null|<none>',
    'provider_customer_id|text|nullable|<none>',
    'provider_product_id|text|nullable|<none>',
    'plan_tier|text|not null|''regular''::text',
    'billing_period|text|nullable|<none>',
    'status|text|not null|<none>',
    'current_period_end|timestamp with time zone|nullable|<none>',
    'last_observed_at|timestamp with time zone|not null|now()',
    'created_at|timestamp with time zone|not null|now()',
    'updated_at|timestamp with time zone|not null|now()'
  ]::text[] or exists (
    select 1
    from pg_catalog.pg_attribute attribute
    where attribute.attrelid = relation_oid
      and attribute.attnum > 0
      and (
        attribute.attisdropped
        or attribute.attidentity <> ''
        or attribute.attgenerated <> ''
      )
  ) then
    raise exception
      'family_billing_subscriptions columns differ from the reviewed contract';
  end if;

  select attnum into strict family_id_attnum
  from pg_catalog.pg_attribute
  where attrelid = relation_oid
    and attname = 'family_id'
    and not attisdropped;

  select attnum into strict families_id_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'public.families'::regclass
    and attname = 'id'
    and not attisdropped;

  if primary_index_oid is null
    or unique_index_oid is null
    or family_index_oid is null
    or customer_index_oid is null
    or (
      select count(*)
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
    ) <> 6
    or not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and constraint_record.conname = 'family_billing_subscriptions_pkey'
        and constraint_record.contype = 'p'
        and constraint_record.conkey = array[1]::smallint[]
        and constraint_record.conindid = primary_index_oid
        and constraint_record.convalidated
        and not constraint_record.condeferrable
        and not constraint_record.condeferred
    )
    or not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and constraint_record.conname =
          'family_billing_subscriptions_family_id_fkey'
        and constraint_record.contype = 'f'
        and constraint_record.conkey = array[family_id_attnum]::smallint[]
        and constraint_record.confrelid = 'public.families'::regclass
        and constraint_record.confkey = array[families_id_attnum]::smallint[]
        and constraint_record.confupdtype = 'a'
        and constraint_record.confdeltype = 'c'
        and constraint_record.confmatchtype = 's'
        and constraint_record.convalidated
        and not constraint_record.condeferrable
        and not constraint_record.condeferred
    )
    or not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and constraint_record.conname =
          'family_billing_subscriptions_provider_provider_subscription_key'
        and constraint_record.contype = 'u'
        and constraint_record.conkey = array[3, 4]::smallint[]
        and constraint_record.conindid = unique_index_oid
        and constraint_record.convalidated
        and not constraint_record.condeferrable
        and not constraint_record.condeferred
    )
    or not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and constraint_record.conname =
          'family_billing_subscriptions_provider_check'
        and constraint_record.contype = 'c'
        and constraint_record.conkey = array[3]::smallint[]
        and pg_catalog.pg_get_expr(
          constraint_record.conbin,
          constraint_record.conrelid
        ) = '(provider = ANY (ARRAY[''stripe''::text, ''apple''::text, ''google''::text]))'
        and constraint_record.convalidated
        and not constraint_record.connoinherit
    )
    or not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and constraint_record.conname =
          'family_billing_subscriptions_plan_tier_check'
        and constraint_record.contype = 'c'
        and constraint_record.conkey = array[7]::smallint[]
        and pg_catalog.pg_get_expr(
          constraint_record.conbin,
          constraint_record.conrelid
        ) = '(plan_tier = ANY (ARRAY[''regular''::text, ''plus''::text, ''elite''::text]))'
        and constraint_record.convalidated
        and not constraint_record.connoinherit
    )
    or not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and constraint_record.conname =
          'family_billing_subscriptions_billing_period_check'
        and constraint_record.contype = 'c'
        and constraint_record.conkey = array[8]::smallint[]
        and pg_catalog.pg_get_expr(
          constraint_record.conbin,
          constraint_record.conrelid
        ) = '(billing_period = ANY (ARRAY[''monthly''::text, ''annual''::text]))'
        and constraint_record.convalidated
        and not constraint_record.connoinherit
    )
  then
    raise exception
      'family_billing_subscriptions constraints differ from the reviewed contract';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_index index_record
    where index_record.indrelid = relation_oid
  ) <> 4 then
    raise exception
      'family_billing_subscriptions must have exactly four reviewed indexes';
  end if;

  select
    index_record.*,
    index_relation.relkind as index_relkind,
    index_relation.relpersistence as index_persistence,
    index_relation.relowner as index_owner,
    access_method.amname as access_method_name,
    array(
      select operator_class.opcname
      from unnest(index_record.indclass::oid[]) with ordinality
        operator_class_oid(oid, position)
      join pg_catalog.pg_opclass operator_class
        on operator_class.oid = operator_class_oid.oid
      order by operator_class_oid.position
    ) as operator_classes,
    array(
      select case
        when collation_oid.oid = 0 then '<none>'
        else collation_record.collname::text
      end
      from unnest(index_record.indcollation::oid[]) with ordinality
        collation_oid(oid, position)
      left join pg_catalog.pg_collation collation_record
        on collation_record.oid = collation_oid.oid
      order by collation_oid.position
    ) as collations
  into strict primary_index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = primary_index_oid;

  if primary_index_contract.indrelid <> relation_oid
    or primary_index_contract.index_relkind <> 'i'
    or primary_index_contract.index_persistence <> 'p'
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
    or primary_index_contract.indexprs is not null
    or primary_index_contract.indpred is not null
    or primary_index_contract.operator_classes
      is distinct from array['uuid_ops']::name[]
    or primary_index_contract.collations
      is distinct from array['<none>']::text[]
  then
    raise exception
      'family_billing_subscriptions primary index differs from contract';
  end if;

  select
    index_record.*,
    index_relation.relkind as index_relkind,
    index_relation.relpersistence as index_persistence,
    index_relation.relowner as index_owner,
    access_method.amname as access_method_name,
    array(
      select operator_class.opcname
      from unnest(index_record.indclass::oid[]) with ordinality
        operator_class_oid(oid, position)
      join pg_catalog.pg_opclass operator_class
        on operator_class.oid = operator_class_oid.oid
      order by operator_class_oid.position
    ) as operator_classes,
    array(
      select case
        when collation_oid.oid = 0 then '<none>'
        else collation_record.collname::text
      end
      from unnest(index_record.indcollation::oid[]) with ordinality
        collation_oid(oid, position)
      left join pg_catalog.pg_collation collation_record
        on collation_record.oid = collation_oid.oid
      order by collation_oid.position
    ) as collations
  into strict unique_index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = unique_index_oid;

  if unique_index_contract.indrelid <> relation_oid
    or unique_index_contract.index_relkind <> 'i'
    or unique_index_contract.index_persistence <> 'p'
    or unique_index_contract.index_owner <> expected_owner_oid
    or unique_index_contract.access_method_name <> 'btree'
    or not unique_index_contract.indisunique
    or unique_index_contract.indisprimary
    or not unique_index_contract.indimmediate
    or not unique_index_contract.indisvalid
    or not unique_index_contract.indisready
    or not unique_index_contract.indislive
    or unique_index_contract.indisexclusion
    or unique_index_contract.indnullsnotdistinct
    or unique_index_contract.indisclustered
    or unique_index_contract.indisreplident
    or unique_index_contract.indnkeyatts <> 2
    or unique_index_contract.indnatts <> 2
    or unique_index_contract.indkey::text <> '3 4'
    or unique_index_contract.indoption::text <> '0 0'
    or unique_index_contract.indexprs is not null
    or unique_index_contract.indpred is not null
    or unique_index_contract.operator_classes
      is distinct from array['text_ops', 'text_ops']::name[]
    or unique_index_contract.collations
      is distinct from array['default', 'default']::text[]
  then
    raise exception
      'family_billing_subscriptions unique index differs from contract';
  end if;

  select
    index_record.*,
    index_relation.relkind as index_relkind,
    index_relation.relpersistence as index_persistence,
    index_relation.relowner as index_owner,
    access_method.amname as access_method_name,
    array(
      select operator_class.opcname
      from unnest(index_record.indclass::oid[]) with ordinality
        operator_class_oid(oid, position)
      join pg_catalog.pg_opclass operator_class
        on operator_class.oid = operator_class_oid.oid
      order by operator_class_oid.position
    ) as operator_classes,
    array(
      select case
        when collation_oid.oid = 0 then '<none>'
        else collation_record.collname::text
      end
      from unnest(index_record.indcollation::oid[]) with ordinality
        collation_oid(oid, position)
      left join pg_catalog.pg_collation collation_record
        on collation_record.oid = collation_oid.oid
      order by collation_oid.position
    ) as collations
  into strict family_index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = family_index_oid;

  if family_index_contract.indrelid <> relation_oid
    or family_index_contract.index_relkind <> 'i'
    or family_index_contract.index_persistence <> 'p'
    or family_index_contract.index_owner <> expected_owner_oid
    or family_index_contract.access_method_name <> 'btree'
    or family_index_contract.indisunique
    or family_index_contract.indisprimary
    or not family_index_contract.indisvalid
    or not family_index_contract.indisready
    or not family_index_contract.indislive
    or family_index_contract.indisexclusion
    or family_index_contract.indnullsnotdistinct
    or family_index_contract.indisclustered
    or family_index_contract.indisreplident
    or family_index_contract.indnkeyatts <> 2
    or family_index_contract.indnatts <> 2
    or family_index_contract.indkey::text <> '2 11'
    or family_index_contract.indoption::text <> '0 3'
    or family_index_contract.indexprs is not null
    or family_index_contract.indpred is not null
    or family_index_contract.operator_classes
      is distinct from array['uuid_ops', 'timestamptz_ops']::name[]
    or family_index_contract.collations
      is distinct from array['<none>', '<none>']::text[]
  then
    raise exception
      'family_billing_subscriptions family-observed index differs from contract';
  end if;

  select
    index_record.*,
    index_relation.relkind as index_relkind,
    index_relation.relpersistence as index_persistence,
    index_relation.relowner as index_owner,
    access_method.amname as access_method_name,
    array(
      select operator_class.opcname
      from unnest(index_record.indclass::oid[]) with ordinality
        operator_class_oid(oid, position)
      join pg_catalog.pg_opclass operator_class
        on operator_class.oid = operator_class_oid.oid
      order by operator_class_oid.position
    ) as operator_classes,
    array(
      select case
        when collation_oid.oid = 0 then '<none>'
        else collation_record.collname::text
      end
      from unnest(index_record.indcollation::oid[]) with ordinality
        collation_oid(oid, position)
      left join pg_catalog.pg_collation collation_record
        on collation_record.oid = collation_oid.oid
      order by collation_oid.position
    ) as collations
  into strict customer_index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = customer_index_oid;

  if customer_index_contract.indrelid <> relation_oid
    or customer_index_contract.index_relkind <> 'i'
    or customer_index_contract.index_persistence <> 'p'
    or customer_index_contract.index_owner <> expected_owner_oid
    or customer_index_contract.access_method_name <> 'btree'
    or customer_index_contract.indisunique
    or customer_index_contract.indisprimary
    or not customer_index_contract.indisvalid
    or not customer_index_contract.indisready
    or not customer_index_contract.indislive
    or customer_index_contract.indisexclusion
    or customer_index_contract.indnullsnotdistinct
    or customer_index_contract.indisclustered
    or customer_index_contract.indisreplident
    or customer_index_contract.indnkeyatts <> 2
    or customer_index_contract.indnatts <> 2
    or customer_index_contract.indkey::text <> '3 5'
    or customer_index_contract.indoption::text <> '0 0'
    or customer_index_contract.indexprs is not null
    or pg_catalog.pg_get_expr(
      customer_index_contract.indpred,
      customer_index_contract.indrelid
    ) <> '(provider_customer_id IS NOT NULL)'
    or customer_index_contract.operator_classes
      is distinct from array['text_ops', 'text_ops']::name[]
    or customer_index_contract.collations
      is distinct from array['default', 'default']::text[]
  then
    raise exception
      'family_billing_subscriptions provider-customer index differs from contract';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid = relation_oid
  ) then
    raise exception 'family_billing_subscriptions must have zero RLS policies';
  end if;

  select count(*) into privilege_count
  from pg_catalog.aclexplode(table_contract.relacl);

  select count(*) into expected_all_privilege_count
  from pg_catalog.aclexplode(
    pg_catalog.acldefault('r', table_contract.relowner)
  );

  if table_contract.relacl is null
    or privilege_count <> expected_all_privilege_count * 2
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
    or exists (
      select 1
      from pg_catalog.aclexplode(table_contract.relacl)
      where grantee not in (expected_owner_oid, service_role_oid)
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
      where attribute.attrelid = relation_oid
        and attribute.attnum > 0
        and attribute.attacl is not null
    )
    or exists (
      select privilege.privilege_type
      from pg_catalog.aclexplode(table_contract.relacl) privilege
      where privilege.grantee = expected_owner_oid
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
      select privilege.privilege_type
      from pg_catalog.aclexplode(table_contract.relacl) privilege
      where privilege.grantee = service_role_oid
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
      where privilege.grantee = service_role_oid
    )
  then
    raise exception 'family_billing_subscriptions ACL differs from contract';
  end if;

  if exists (
    select 1
    from issue_887_expected_migrations expected
    left join supabase_migrations.schema_migrations actual
      on actual.version = expected.version
    where actual.version is null
      or actual.name is distinct from expected.name
      or actual.statements is distinct from expected.statements
  ) or (
    select count(*)
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806093000')
  ) <> 2 then
    raise exception 'issue 887 migration ledger evidence is absent or altered';
  end if;

  if (
    select original_ledger_existed and not correction_ledger_existed
    from issue_887_repair_state
  ) then
    if (
      select count(*) from public.family_billing_subscriptions
    ) <> (
      select count(*) from issue_887_subscription_snapshot
    ) or exists (
      select 1
      from issue_887_subscription_snapshot before_repair
      join public.families family
        on family.id = before_repair.family_id
      left join public.family_billing_subscriptions after_repair
        on after_repair.id = before_repair.id
      where after_repair.id is null
        or row(
          after_repair.family_id,
          after_repair.provider,
          after_repair.provider_subscription_id,
          after_repair.provider_customer_id,
          after_repair.provider_product_id,
          after_repair.plan_tier,
          after_repair.billing_period,
          after_repair.status,
          after_repair.current_period_end,
          after_repair.last_observed_at,
          after_repair.created_at,
          after_repair.updated_at
        ) is distinct from row(
          before_repair.family_id,
          before_repair.provider,
          before_repair.provider_subscription_id,
          before_repair.provider_customer_id,
          case
            when before_repair.provider = 'stripe'
              and before_repair.provider_product_id = family.stripe_price_id
            then null
            else before_repair.provider_product_id
          end,
          before_repair.plan_tier,
          before_repair.billing_period,
          before_repair.status,
          before_repair.current_period_end,
          before_repair.last_observed_at,
          before_repair.created_at,
          before_repair.updated_at
        )
    ) then
      raise exception
        'issue 887 forward correction changed more than proven Stripe product mirrors';
    end if;
  end if;

  if (
    select correction_ledger_existed
    from issue_887_repair_state
  ) then
    if (
      select count(*) from public.family_billing_subscriptions
    ) <> (
      select count(*) from issue_887_subscription_snapshot
    ) or exists (
      select 1
      from issue_887_subscription_snapshot before_repair
      left join public.family_billing_subscriptions after_repair
        on after_repair.id = before_repair.id
      where after_repair.id is null
        or row(
          after_repair.family_id,
          after_repair.provider,
          after_repair.provider_subscription_id,
          after_repair.provider_customer_id,
          after_repair.provider_product_id,
          after_repair.plan_tier,
          after_repair.billing_period,
          after_repair.status,
          after_repair.current_period_end,
          after_repair.last_observed_at,
          after_repair.created_at,
          after_repair.updated_at
        ) is distinct from row(
          before_repair.family_id,
          before_repair.provider,
          before_repair.provider_subscription_id,
          before_repair.provider_customer_id,
          before_repair.provider_product_id,
          before_repair.plan_tier,
          before_repair.billing_period,
          before_repair.status,
          before_repair.current_period_end,
          before_repair.last_observed_at,
          before_repair.created_at,
          before_repair.updated_at
        )
    ) then
      raise exception 'issue 887 verified no-op changed an existing billing row';
    end if;
  end if;

  if (
    select count(*)
    from public.family_billing_subscriptions
  ) <> 3
    or (
      select count(*)
      from public.family_billing_subscriptions
      where provider = 'stripe'
    ) <> 3
    or exists (
      select 1
      from public.family_billing_subscriptions
      where provider <> 'stripe'
        or billing_period is not null
        or provider_product_id is not null
    )
    or exists (
      select 1
      from public.families family
      where family.stripe_subscription_id is not null
        and not exists (
          select 1
          from public.family_billing_subscriptions subscription
          where subscription.family_id = family.id
            and subscription.provider = 'stripe'
            and subscription.provider_subscription_id =
              family.stripe_subscription_id
            and subscription.provider_customer_id is not distinct from
              family.stripe_customer_id
            and subscription.provider_product_id is null
            and subscription.plan_tier is not distinct from family.plan_tier
            and subscription.billing_period is null
            and subscription.status is not distinct from
              family.stripe_subscription_status
            and subscription.current_period_end is not distinct from
              family.stripe_current_period_end
        )
    )
  then
    raise exception
      'family billing backfill differs from the reviewed corrected snapshot';
  end if;

  if (
    select not original_ledger_existed
    from issue_887_repair_state
  ) and exists (
    select 1
    from public.families family
    join public.family_billing_subscriptions subscription
      on subscription.family_id = family.id
     and subscription.provider = 'stripe'
     and subscription.provider_subscription_id = family.stripe_subscription_id
    cross join issue_887_repair_state repair_state
    where subscription.last_observed_at is distinct from
      coalesce(
        family.billing_updated_at,
        repair_state.repair_transaction_timestamp
      )
  ) then
    raise exception
      'fresh issue 887 backfill has an unexpected observation timestamp';
  end if;

  if (
    select original_ledger_existed
    from issue_887_repair_state
  ) and exists (
    select 1
    from public.families family
    join public.family_billing_subscriptions subscription
      on subscription.family_id = family.id
     and subscription.provider = 'stripe'
     and subscription.provider_subscription_id = family.stripe_subscription_id
    where subscription.last_observed_at is null
      or (
        family.billing_updated_at is not null
        and subscription.last_observed_at is distinct from
          family.billing_updated_at
      )
  ) then
    raise exception
      'existing issue 887 backfill has an unexpected observation timestamp';
  end if;

  if exists (
    (
      select
        family.id,
        family.stripe_customer_id,
        family.stripe_subscription_id,
        family.stripe_price_id,
        family.stripe_subscription_status,
        family.stripe_current_period_end,
        family.apple_original_transaction_id,
        family.apple_product_id,
        family.apple_subscription_status,
        family.apple_expires_at,
        family.plan_tier,
        family.billing_updated_at
      from public.families family
      where family.stripe_subscription_id is not null
        or family.apple_original_transaction_id is not null
      except
      select * from issue_887_compatibility_snapshot
    )
    union all
    (
      select * from issue_887_compatibility_snapshot
      except
      select
        family.id,
        family.stripe_customer_id,
        family.stripe_subscription_id,
        family.stripe_price_id,
        family.stripe_subscription_status,
        family.stripe_current_period_end,
        family.apple_original_transaction_id,
        family.apple_product_id,
        family.apple_subscription_status,
        family.apple_expires_at,
        family.plan_tier,
        family.billing_updated_at
      from public.families family
      where family.stripe_subscription_id is not null
        or family.apple_original_transaction_id is not null
    )
  ) then
    raise exception 'issue 887 changed a legacy family compatibility column';
  end if;
end
$assert$;

select pg_temp.assert_issue_887_contract();

select 'ISSUE_887_REPAIR=' || case
  when correction_ledger_existed then 'verified_noop'
  else 'repaired'
end
from issue_887_repair_state;

drop function pg_temp.assert_issue_887_contract();

commit;
