import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(databaseUrl, "HOMA_EVAL_DATABASE_URL must point at a disposable database");

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repairPath = join(
  repositoryRoot,
  "scripts",
  "issue-887-production-repair.sql",
);
const originalMigrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260801110000_family_billing_subscriptions.sql",
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

function databaseUrlFor(role) {
  const url = new URL(databaseUrl);
  url.username = role;
  url.password = "";
  return url.toString();
}

function runPsql(
  actions,
  { expectedStatus = 0, role = "postgres" } = {},
) {
  const result = spawnSync(
    psql,
    [
      "--dbname",
      databaseUrlFor(role),
      "-qX",
      "-v",
      "ON_ERROR_STOP=1",
      ...actions,
    ],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180_000,
    },
  );

  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(result.status, 0, result.stderr || "issue 887 repair failed");
  } else {
    assert.notEqual(result.status, 0, "issue 887 repair unexpectedly succeeded");
  }
  return {
    rawStdout: result.stdout,
    stdout: result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
    stderr: result.stderr,
  };
}

runPsql(
  [
    "-c",
    `
      do $role$
      begin
        if not exists (
          select 1 from pg_catalog.pg_roles where rolname = 'postgres'
        ) then
          create role postgres login superuser;
        else
          alter role postgres login superuser;
        end if;
      end
      $role$;

      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[] not null,
        name text not null
      );
      alter table supabase_migrations.schema_migrations owner to postgres;

      alter default privileges for role postgres in schema public
        grant all privileges on tables to anon, authenticated, service_role;
    `,
  ],
  { role: "homa_eval" },
);

const fixtureIds = [
  "88700000-0000-4000-8000-000000000001",
  "88700000-0000-4000-8000-000000000002",
  "88700000-0000-4000-8000-000000000003",
];

function resetFresh({ duplicateSubscription = false, nullStatus = false } = {}) {
  const thirdSubscription = duplicateSubscription ? "sub_issue_887_02" : "sub_issue_887_03";
  const thirdStatus = nullStatus ? "null" : "'past_due'";
  runPsql([
    "-c",
    `
      drop event trigger if exists issue_887_fail_on_grant;
      drop function if exists public.issue_887_fail_on_grant();
      drop table if exists public.family_billing_subscriptions cascade;
      drop table if exists public.issue_887_partition_parent cascade;
      drop table if exists public.issue_887_family_index_collision cascade;
      drop table if exists public.issue_887_customer_index_collision cascade;
      drop table if exists public.issue_887_primary_index_collision cascade;
      drop table if exists public.issue_887_unique_index_collision cascade;
      delete from supabase_migrations.schema_migrations
      where version in (
        '20260801110000',
        '20260806092999',
        '20260806093000'
      );
      delete from public.families
      where id in (${fixtureIds.map((id) => `'${id}'::uuid`).join(", ")});

      insert into public.families (
        id,
        name,
        plan_tier,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        stripe_subscription_status,
        stripe_current_period_end,
        billing_updated_at
      )
      values
        (
          '${fixtureIds[0]}'::uuid,
          'Issue 887 family one',
          'regular',
          'cus_issue_887_01',
          'sub_issue_887_01',
          'price_issue_887_01',
          'active',
          '2026-09-01T00:00:00Z'::timestamptz,
          '2026-08-05T10:00:00Z'::timestamptz
        ),
        (
          '${fixtureIds[1]}'::uuid,
          'Issue 887 family two',
          'plus',
          'cus_issue_887_02',
          'sub_issue_887_02',
          'price_issue_887_02',
          'trialing',
          '2026-09-02T00:00:00Z'::timestamptz,
          '2026-08-05T11:00:00Z'::timestamptz
        ),
        (
          '${fixtureIds[2]}'::uuid,
          'Issue 887 family three',
          'elite',
          null,
          '${thirdSubscription}',
          'price_issue_887_03',
          ${thirdStatus},
          null,
          null
        );
    `,
  ]);
}

function repairMarkers(result) {
  return result.stdout.filter((line) => line.startsWith("ISSUE_887_REPAIR="));
}

function applyRepair(expectedMarker = "ISSUE_887_REPAIR=repaired") {
  const result = runPsql(["-f", repairPath]);
  assert.deepEqual(
    repairMarkers(result),
    [expectedMarker],
    `expected exactly ${expectedMarker}, got ${result.stdout.join(" | ")}`,
  );
  return result;
}

function assertRepairFailure(pattern) {
  const result = runPsql(["-f", repairPath], { expectedStatus: 1 });
  assert.match(result.stderr, pattern);
  return result;
}

runPsql(["-f", originalMigrationPath]);
const forwardAcl = runPsql([
  "-Atc",
  `
    with table_contract as (
      select relation.oid, relation.relowner, relation.relacl
      from pg_catalog.pg_class relation
      where relation.oid = 'public.family_billing_subscriptions'::regclass
    ), expected as (
      select count(*) as privilege_count
      from table_contract,
        pg_catalog.aclexplode(
          pg_catalog.acldefault('r', table_contract.relowner)
        ) privilege
    ), actual as (
      select
        count(*) filter (
          where privilege.grantee = table_contract.relowner
        ) as owner_count,
        count(*) filter (
          where privilege.grantee = (
            select oid from pg_catalog.pg_roles where rolname = 'service_role'
          )
        ) as service_role_count,
        count(*) filter (
          where privilege.grantee not in (
            table_contract.relowner,
            (select oid from pg_catalog.pg_roles where rolname = 'service_role')
          )
        ) as unexpected_count,
        count(*) filter (
          where privilege.grantor <> table_contract.relowner
            or privilege.is_grantable
        ) as bad_grant_count,
        count(*) filter (
          where privilege.grantee = (
              select oid from pg_catalog.pg_roles where rolname = 'service_role'
            )
            and privilege.privilege_type = 'MAINTAIN'
        ) as service_maintain_count
      from table_contract,
        pg_catalog.aclexplode(table_contract.relacl) privilege
      group by table_contract.relowner
    )
    select
      table_contract.relacl is not null
      and actual.owner_count = expected.privilege_count
      and actual.service_role_count = expected.privilege_count
      and actual.unexpected_count = 0
      and actual.bad_grant_count = 0
      and not exists (
        select 1
        from pg_catalog.pg_attribute attribute
        where attribute.attrelid = table_contract.oid
          and attribute.attnum > 0
          and attribute.attacl is not null
      )
      and actual.service_maintain_count = case
        when current_setting('server_version_num')::integer >= 170000 then 1
        else 0
      end
    from table_contract, expected, actual;
  `,
]);
assert.deepEqual(
  forwardAcl.stdout,
  ["t"],
  "forward migration did not create the exact owner and service_role ACL",
);
runPsql(["-c", "drop table public.family_billing_subscriptions;"]);

resetFresh();
applyRepair();
applyRepair("ISSUE_887_REPAIR=verified_noop");
applyRepair("ISSUE_887_REPAIR=verified_noop");

const exactResult = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      count(*) filter (where provider = 'stripe'),
      count(*) filter (where provider = 'apple'),
      count(*) filter (where provider_product_id is not null),
      count(*) filter (where billing_period is not null)
    )
    from public.family_billing_subscriptions;
  `,
]);
assert.deepEqual(exactResult.stdout, ["3|0|0|0"]);

const ledgerEvidence = runPsql([
  "-Atc",
  `
    select concat_ws('|', version, name, statements[1])
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806093000')
    order by version;
  `,
]);
assert.deepEqual(ledgerEvidence.stdout, [
  "20260801110000|family_billing_subscriptions|-- Issue 887 original_sha256=0215e6ea62dde4f9a64f2d62e08ab89121e8b06a838812d39fc2f660f0fe8198 executable_sha256=5ed8f1bf0df5d940cd61de1427a7aa1adaa09582f2528ba7240b180fedaa7909",
  "20260806093000|correct_billing_provider_product_identity|-- Issue 887 source sha256=07e432ffbf449427ac43a7f4433dae3f5b083cbb9b185edff75a774b310464c7",
]);

const reconstructed = runPsql([
  "-Atc",
  `
    select string_agg(
      array_to_string(statements, E'\n'),
      E'\n'
      order by version
    )
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806093000');
  `,
]);
assert.match(reconstructed.rawStdout, /create table if not exists/u);
assert.match(reconstructed.rawStdout, /grant all privileges[\s\S]*service_role/u);
assert.match(reconstructed.rawStdout, /set provider_product_id = null/u);
runPsql(["-c", reconstructed.rawStdout]);
applyRepair("ISSUE_887_REPAIR=verified_noop");

runPsql([
  "-c",
  `
    delete from supabase_migrations.schema_migrations
    where version = '20260806093000';
    update public.family_billing_subscriptions subscription
    set provider_product_id = family.stripe_price_id
    from public.families family
    where subscription.family_id = family.id
      and subscription.provider = 'stripe';
  `,
]);
applyRepair();
const forwardCorrection = runPsql([
  "-Atc",
  `
    select count(*)
    from public.family_billing_subscriptions
    where provider_product_id is not null;
  `,
]);
assert.deepEqual(forwardCorrection.stdout, ["0"]);

const correctionTimestamps = runPsql([
  "-Atc",
  `
    select count(*)
    from public.families family
    join public.family_billing_subscriptions subscription
      on subscription.family_id = family.id
     and subscription.provider = 'stripe'
     and subscription.provider_subscription_id = family.stripe_subscription_id
    where subscription.last_observed_at is null
      or (
        family.billing_updated_at is not null
        and subscription.last_observed_at is distinct from family.billing_updated_at
      );
  `,
]);
assert.deepEqual(correctionTimestamps.stdout, ["0"]);

runPsql([
  "-c",
  `
    update public.family_billing_subscriptions
    set last_observed_at = '2020-01-01T00:00:00Z'::timestamptz
    where provider_subscription_id = 'sub_issue_887_01';
  `,
]);
assertRepairFailure(/unexpected observation timestamp/u);
runPsql([
  "-c",
  `
    update public.family_billing_subscriptions subscription
    set last_observed_at = family.billing_updated_at
    from public.families family
    where subscription.family_id = family.id
      and subscription.provider_subscription_id = 'sub_issue_887_01';
  `,
]);

const transactionalTamperCases = [
  [
    "column nullability",
    `alter table public.family_billing_subscriptions
       alter column status drop not null`,
    /columns differ from the reviewed contract/u,
  ],
  [
    "unexpected table ACL",
    "grant trigger on table public.family_billing_subscriptions to authenticated",
    /ACL differs from contract/u,
  ],
  [
    "table ACL grant option",
    `grant select on table public.family_billing_subscriptions
       to service_role with grant option`,
    /ACL differs from contract/u,
  ],
  [
    "table ACL grantor",
    `grant select on table public.family_billing_subscriptions
       to service_role with grant option;
     set role service_role;
     grant select on table public.family_billing_subscriptions to authenticated;
     reset role`,
    /ACL differs from contract/u,
  ],
  [
    "column ACL",
    `grant update (status) on table public.family_billing_subscriptions
       to authenticated`,
    /ACL differs from contract/u,
  ],
  [
    "dropped column",
    `alter table public.family_billing_subscriptions
       add column issue_887_hidden text;
     alter table public.family_billing_subscriptions
       drop column issue_887_hidden`,
    /columns differ from the reviewed contract/u,
  ],
  [
    "generated column",
    `alter table public.family_billing_subscriptions
       add column issue_887_generated text
       generated always as (provider || provider_subscription_id) stored`,
    /columns differ from the reviewed contract/u,
  ],
  [
    "identity column",
    `alter table public.family_billing_subscriptions
       add column issue_887_identity bigint generated always as identity`,
    /columns differ from the reviewed contract/u,
  ],
  [
    "constraint identity",
    `alter table public.family_billing_subscriptions
       rename constraint family_billing_subscriptions_provider_check
       to issue_887_provider_check`,
    /constraints differ from the reviewed contract/u,
  ],
  [
    "family index contract",
    `drop index public.family_billing_subscriptions_family_observed_idx;
     create index family_billing_subscriptions_family_observed_idx
       on public.family_billing_subscriptions (last_observed_at, family_id)`,
    /family-observed index differs from contract/u,
  ],
  [
    "policy",
    `create policy issue_887_permissive_probe
       on public.family_billing_subscriptions
       for all to public using (true) with check (true)`,
    /must have zero RLS policies/u,
  ],
  [
    "ledger",
    `update supabase_migrations.schema_migrations
       set statements = array['select 1;']::text[]
       where version = '20260806093000'`,
    /migration ledger evidence is absent or altered/u,
  ],
];

for (const [label, mutation, errorPattern] of transactionalTamperCases) {
  const rejected = runPsql(
    ["-c", `begin; ${mutation};`, "-f", repairPath],
    { expectedStatus: 1 },
  );
  assert.match(rejected.stderr, errorPattern, `${label} tamper was not rejected`);
  applyRepair("ISSUE_887_REPAIR=verified_noop");
}

const partitionDrift = runPsql(
  [
    "-c",
    `begin;
     create table public.issue_887_partition_parent (
       id uuid not null,
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
     ) partition by list (provider);
     alter table public.issue_887_partition_parent
       attach partition public.family_billing_subscriptions default;`,
    "-f",
    repairPath,
  ],
  { expectedStatus: 1 },
);
assert.match(
  partitionDrift.stderr,
  /relation metadata differs from the reviewed contract/u,
);
applyRepair("ISSUE_887_REPAIR=verified_noop");

resetFresh();
runPsql([
  "-c",
  "create table public.issue_887_family_index_collision (family_id uuid, last_observed_at timestamptz); create index family_billing_subscriptions_family_observed_idx on public.issue_887_family_index_collision (family_id, last_observed_at desc);",
]);
assertRepairFailure(/migration state is mixed/u);
const collisionRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select index_record.indrelid =
          'public.issue_887_family_index_collision'::regclass
        from pg_catalog.pg_index index_record
        where index_record.indexrelid =
          'public.family_billing_subscriptions_family_observed_idx'::regclass
      ),
      (
        select count(*) = 0
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(collisionRollback.stdout, ["t|t|t"]);
runPsql(["-c", "drop table public.issue_887_family_index_collision;"]);

resetFresh();
runPsql([
  "-c",
  "create table public.issue_887_customer_index_collision (provider text, provider_customer_id text); create index family_billing_subscriptions_provider_customer_idx on public.issue_887_customer_index_collision (provider, provider_customer_id) where provider_customer_id is not null;",
]);
assertRepairFailure(/migration state is mixed/u);
const providerCollisionRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select index_record.indrelid =
          'public.issue_887_customer_index_collision'::regclass
        from pg_catalog.pg_index index_record
        where index_record.indexrelid =
          'public.family_billing_subscriptions_provider_customer_idx'::regclass
      ),
      (
        select count(*) = 0
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(providerCollisionRollback.stdout, ["t|t|t"]);
runPsql(["-c", "drop table public.issue_887_customer_index_collision;"]);

resetFresh();
runPsql([
  "-c",
  `create table public.issue_887_primary_index_collision (
     id uuid constraint family_billing_subscriptions_pkey primary key
   );`,
]);
assertRepairFailure(/migration state is mixed/u);
const primaryCollisionRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select index_record.indrelid =
          'public.issue_887_primary_index_collision'::regclass
        from pg_catalog.pg_index index_record
        where index_record.indexrelid =
          'public.family_billing_subscriptions_pkey'::regclass
      ),
      (
        select count(*) = 0
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(primaryCollisionRollback.stdout, ["t|t|t"]);
runPsql(["-c", "drop table public.issue_887_primary_index_collision;"]);

resetFresh();
runPsql([
  "-c",
  `create table public.issue_887_unique_index_collision (
     provider text,
     provider_subscription_id text,
     constraint family_billing_subscriptions_provider_provider_subscription_key
       unique (provider, provider_subscription_id)
   );`,
]);
assertRepairFailure(/migration state is mixed/u);
const uniqueCollisionRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select index_record.indrelid =
          'public.issue_887_unique_index_collision'::regclass
        from pg_catalog.pg_index index_record
        where index_record.indexrelid =
          'public.family_billing_subscriptions_provider_provider_subscription_key'::regclass
      ),
      (
        select count(*) = 0
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(uniqueCollisionRollback.stdout, ["t|t|t"]);
runPsql(["-c", "drop table public.issue_887_unique_index_collision;"]);

resetFresh({ duplicateSubscription: true });
assertRepairFailure(/live billing snapshot differs/u);
const duplicateRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select count(*) = 0
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(duplicateRollback.stdout, ["t|t"]);

resetFresh({ nullStatus: true });
assertRepairFailure(/live billing snapshot differs/u);
const nullStatusRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select count(*) = 0
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(nullStatusRollback.stdout, ["t|t"]);

resetFresh();
runPsql([
  "-c",
  "create table public.family_billing_subscriptions (id uuid);",
]);
assertRepairFailure(/migration state is mixed/u);

resetFresh();
runPsql([
  "-c",
  `
    insert into supabase_migrations.schema_migrations
      (version, statements, name)
    values (
      '20260806092999',
      array['select 1;'],
      'family_billing_subscriptions'
    );
  `,
]);
assertRepairFailure(/migration state is mixed/u);

resetFresh();
runPsql([
  "-c",
  `
    insert into supabase_migrations.schema_migrations
      (version, statements, name)
    values ('20260801110000', array['select 1;'], 'family_billing_subscriptions');
  `,
]);
assertRepairFailure(/migration state is mixed/u);

resetFresh();
runPsql([
  "-c",
  `
    insert into supabase_migrations.schema_migrations
      (version, statements, name)
    values (
      '20260806093000',
      array['select 1;'],
      'correct_billing_provider_product_identity'
    );
  `,
]);
assertRepairFailure(/migration state is mixed/u);

resetFresh();
runPsql([
  "-c",
  `
    create or replace function public.issue_887_fail_on_grant()
    returns event_trigger
    language plpgsql
    as $failure$
    begin
      if tg_tag = 'GRANT' then
        raise exception 'issue 887 injected mid-migration failure';
      end if;
    end
    $failure$;
    create event trigger issue_887_fail_on_grant
      on ddl_command_start
      execute function public.issue_887_fail_on_grant();
  `,
]);

const injectedFailure = runPsql(["-f", repairPath], { expectedStatus: 1 });
assert.match(injectedFailure.stderr, /injected mid-migration failure/u);

const rollbackState = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      to_regclass('public.family_billing_subscriptions_pkey') is null,
      to_regclass(
        'public.family_billing_subscriptions_provider_provider_subscription_key'
      ) is null,
      to_regclass('public.family_billing_subscriptions_family_observed_idx') is null,
      to_regclass('public.family_billing_subscriptions_provider_customer_idx') is null,
      not exists (
        select 1
        from supabase_migrations.schema_migrations
        where version in ('20260801110000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(
  rollbackState.stdout,
  ["t|t|t|t|t|t"],
  "mid-migration failure left billing relation or ledger residue",
);

runPsql([
  "-c",
  `
    drop event trigger issue_887_fail_on_grant;
    drop function public.issue_887_fail_on_grant();
  `,
]);
applyRepair();
applyRepair("ISSUE_887_REPAIR=verified_noop");

console.log(
  "Issue 887 repair passed defaults, apply, replay, fresh no-op, correction, exact metadata, ACL, collision, mixed-state, and rollback probes.",
);
