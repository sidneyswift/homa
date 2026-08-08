\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

create temporary table issue_873_repair_state (
  table_existed boolean not null,
  ledger_existed boolean not null
) on commit drop;

insert into issue_873_repair_state (table_existed, ledger_existed)
select
  to_regclass('public.stripe_trial_card_claims') is not null,
  exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260805200000'
  );

create or replace function pg_temp.assert_trial_claim_table(required boolean)
returns void
language plpgsql
as $assert$
declare
  claim_table oid := to_regclass('public.stripe_trial_card_claims');
  card_column smallint;
  family_column smallint;
  family_id_column smallint;
begin
  if claim_table is null then
    if required then
      raise exception 'stripe_trial_card_claims is absent after applying issue 873';
    end if;
    return;
  end if;

  if (
    select count(*)
    from pg_attribute
    where attrelid = claim_table
      and attnum > 0
      and not attisdropped
  ) <> 4 then
    raise exception 'stripe_trial_card_claims has an unexpected column count';
  end if;

  select attnum
  into card_column
  from pg_attribute
  where attrelid = claim_table
    and attname = 'card_fingerprint'
    and atttypid = 'text'::regtype
    and attnotnull
    and not attisdropped
    and not exists (
      select 1
      from pg_attrdef
      where adrelid = claim_table
        and adnum = pg_attribute.attnum
    );

  select attnum
  into family_column
  from pg_attribute
  where attrelid = claim_table
    and attname = 'family_id'
    and atttypid = 'uuid'::regtype
    and attnotnull
    and not attisdropped
    and not exists (
      select 1
      from pg_attrdef
      where adrelid = claim_table
        and adnum = pg_attribute.attnum
    );

  select attnum
  into family_id_column
  from pg_attribute
  where attrelid = 'public.families'::regclass
    and attname = 'id'
    and not attisdropped;

  if card_column is null or family_column is null or family_id_column is null then
    raise exception 'stripe_trial_card_claims has an unexpected key column';
  end if;

  if not exists (
    select 1
    from pg_attribute
    join pg_attrdef
      on pg_attrdef.adrelid = pg_attribute.attrelid
      and pg_attrdef.adnum = pg_attribute.attnum
    where pg_attribute.attrelid = claim_table
      and pg_attribute.attname = 'created_at'
      and pg_attribute.atttypid = 'timestamptz'::regtype
      and pg_attribute.attnotnull
      and not pg_attribute.attisdropped
      and pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid) = 'now()'
  ) or not exists (
    select 1
    from pg_attribute
    join pg_attrdef
      on pg_attrdef.adrelid = pg_attribute.attrelid
      and pg_attrdef.adnum = pg_attribute.attnum
    where pg_attribute.attrelid = claim_table
      and pg_attribute.attname = 'updated_at'
      and pg_attribute.atttypid = 'timestamptz'::regtype
      and pg_attribute.attnotnull
      and not pg_attribute.attisdropped
      and pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid) = 'now()'
  ) then
    raise exception 'stripe_trial_card_claims has unexpected timestamp columns';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = claim_table
      and contype = 'p'
  ) <> 1 or not exists (
    select 1
    from pg_constraint
    where conrelid = claim_table
      and contype = 'p'
      and conkey = array[card_column]::smallint[]
  ) then
    raise exception 'stripe_trial_card_claims has an unexpected primary key';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = claim_table
      and contype = 'f'
  ) <> 1 or not exists (
    select 1
    from pg_constraint
    where conrelid = claim_table
      and contype = 'f'
      and confrelid = 'public.families'::regclass
      and conkey = array[family_column]::smallint[]
      and confkey = array[family_id_column]::smallint[]
      and confdeltype = 'c'
  ) then
    raise exception 'stripe_trial_card_claims has an unexpected family foreign key';
  end if;

  if not exists (
    select 1
    from pg_index
    join pg_class index_relation on index_relation.oid = pg_index.indexrelid
    where pg_index.indrelid = claim_table
      and index_relation.relnamespace = 'public'::regnamespace
      and index_relation.relname = 'stripe_trial_card_claims_family_idx'
      and pg_index.indnkeyatts = 1
      and pg_index.indnatts = 1
      and pg_index.indkey[0] = family_column
      and not pg_index.indisunique
      and pg_index.indisvalid
      and pg_index.indisready
      and pg_index.indpred is null
      and pg_index.indexprs is null
  ) then
    raise exception 'stripe_trial_card_claims is missing its exact family index';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = claim_table
  ) then
    raise exception 'stripe_trial_card_claims does not have row level security enabled';
  end if;

  if has_table_privilege(
    'anon',
    claim_table,
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) or has_table_privilege(
    'authenticated',
    claim_table,
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) then
    raise exception 'stripe_trial_card_claims exposes a client table privilege';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid = claim_table
      and polpermissive
  ) then
    raise exception 'stripe_trial_card_claims has a permissive policy';
  end if;
end
$assert$;

do $preflight$
begin
  if (
    select ledger_existed and not table_existed
    from issue_873_repair_state
  ) then
    raise exception 'issue 873 is recorded as applied while its table is absent';
  end if;

  perform pg_temp.assert_trial_claim_table(false);
end
$preflight$;

\ir ../supabase/migrations/20260805200000_reconcile_trial_claim_migration.sql

select pg_temp.assert_trial_claim_table(true);

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '20260805200000',
  array['Issue 873 exact additive migration applied atomically']::text[],
  'reconcile_trial_claim_migration'
)
on conflict (version) do nothing;

do $ledger_check$
begin
  if (
    select count(*)
    from supabase_migrations.schema_migrations
    where version = '20260805200000'
  ) <> 1 then
    raise exception 'issue 873 migration ledger entry was not recorded exactly once';
  end if;
end
$ledger_check$;

drop function pg_temp.assert_trial_claim_table(boolean);

select 'ISSUE_873_REPAIR=' || case
  when table_existed and ledger_existed then 'verified_noop'
  else 'repaired'
end
from issue_873_repair_state;

commit;
