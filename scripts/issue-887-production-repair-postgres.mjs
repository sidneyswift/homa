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
        end if;
      end
      $role$;

      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[] not null,
        name text not null
      );
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
      drop table if exists public.family_billing_subscriptions cascade;
      delete from supabase_migrations.schema_migrations
      where version in ('20260801110000', '20260806093000');
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

function applyRepair(expectedMarker = "ISSUE_887_REPAIR=repaired") {
  const result = runPsql(["-f", repairPath]);
  assert.ok(
    result.stdout.includes(expectedMarker),
    `expected ${expectedMarker}, got ${result.stdout.join(" | ")}`,
  );
  return result;
}

function assertRepairFailure(pattern) {
  const result = runPsql(["-f", repairPath], { expectedStatus: 1 });
  assert.match(result.stderr, pattern);
  return result;
}

resetFresh();
applyRepair();
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
  "20260801110000|family_billing_subscriptions|-- Issue 887 source sha256=0215e6ea62dde4f9a64f2d62e08ab89121e8b06a838812d39fc2f660f0fe8198",
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

runPsql([
  "-c",
  `
    alter table public.family_billing_subscriptions
    alter column status drop not null;
  `,
]);
assertRepairFailure(/columns differ from the reviewed contract/u);
runPsql([
  "-c",
  `
    alter table public.family_billing_subscriptions
    alter column status set not null;
  `,
]);

runPsql([
  "-c",
  "grant trigger on table public.family_billing_subscriptions to authenticated;",
]);
assertRepairFailure(/grants TRIGGER to denied role authenticated/u);
runPsql([
  "-c",
  "revoke trigger on table public.family_billing_subscriptions from authenticated;",
]);

runPsql([
  "-c",
  `
    create policy issue_887_permissive_probe
    on public.family_billing_subscriptions
    for all
    to public
    using (true)
    with check (true);
  `,
]);
assertRepairFailure(/must have zero RLS policies/u);
runPsql([
  "-c",
  `
    drop policy issue_887_permissive_probe
    on public.family_billing_subscriptions;
  `,
]);

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements = array['select 1;']::text[]
    where version = '20260806093000';
  `,
]);
assertRepairFailure(/migration ledger evidence is absent or altered/u);

resetFresh();
runPsql([
  "-c",
  "create table public.issue_887_collision_holder (family_id uuid, last_observed_at timestamptz); create index family_billing_subscriptions_family_observed_idx on public.issue_887_collision_holder (family_id, last_observed_at desc);",
]);
assertRepairFailure(/indexes differ from the reviewed contract/u);
const collisionRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select index_record.indrelid =
          'public.issue_887_collision_holder'::regclass
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
runPsql(["-c", "drop table public.issue_887_collision_holder;"]);

resetFresh();
runPsql([
  "-c",
  "create table public.issue_887_provider_collision_holder (provider text, provider_customer_id text); create index family_billing_subscriptions_provider_customer_idx on public.issue_887_provider_collision_holder (provider, provider_customer_id) where provider_customer_id is not null;",
]);
assertRepairFailure(/indexes differ from the reviewed contract/u);
const providerCollisionRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      to_regclass('public.family_billing_subscriptions') is null,
      (
        select index_record.indrelid =
          'public.issue_887_provider_collision_holder'::regclass
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
runPsql(["-c", "drop table public.issue_887_provider_collision_holder;"]);

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

console.log(
  "Issue 887 repair passed fresh apply, fresh-session no-op, forward correction, reconstruction, mixed-state, duplicate, collision, schema, policy, grant, ledger, and rollback probes.",
);
