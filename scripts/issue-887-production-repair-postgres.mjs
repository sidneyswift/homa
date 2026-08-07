import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(
  databaseUrl,
  "HOMA_EVAL_DATABASE_URL must point at a disposable database"
);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repairPath = join(
  repositoryRoot,
  "scripts",
  "issue-887-production-repair.sql"
);
const originalMigrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260801110000_family_billing_subscriptions.sql"
);
const aclMigrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260806092000_harden_family_billing_subscriptions_acl.sql"
);
const correctionMigrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260806093000_correct_billing_provider_product_identity.sql"
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

function runPsql(actions, { expectedStatus = 0, role = "postgres" } = {}) {
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
    }
  );

  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(result.status, 0, result.stderr || "issue 887 repair failed");
  } else {
    assert.notEqual(
      result.status,
      0,
      "issue 887 repair unexpectedly succeeded"
    );
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

function spawnPsql(actions, { role = "postgres", applicationName } = {}) {
  const child = spawn(
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
      env: {
        ...process.env,
        ...(applicationName ? { PGAPPNAME: applicationName } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const completion = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`psql timed out: ${stderr || stdout}`));
    }, 30_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });

  return { child, completion };
}

async function waitFor(description, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function canonicalMigrationStatements(path) {
  return readFileSync(path, "utf8")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function canonicalStatementArray(path) {
  return `array[${canonicalMigrationStatements(path)
    .map(sqlLiteral)
    .join(", ")}]::text[]`;
}

function insertCanonicalLedger(version, name, path) {
  runPsql([
    "-c",
    `
      insert into supabase_migrations.schema_migrations (version, statements, name)
      values (
        ${sqlLiteral(version)},
        ${canonicalStatementArray(path)},
        ${sqlLiteral(name)}
      );
    `,
  ]);
}

function installCanonicalOriginalState() {
  runPsql(["-f", originalMigrationPath]);
  insertCanonicalLedger(
    "20260801110000",
    "family_billing_subscriptions",
    originalMigrationPath
  );
}

function installCanonicalAclState() {
  installCanonicalOriginalState();
  runPsql(["-f", aclMigrationPath]);
  insertCanonicalLedger(
    "20260806092000",
    "harden_family_billing_subscriptions_acl",
    aclMigrationPath
  );
}

function installCanonicalCompleteState() {
  installCanonicalAclState();
  runPsql(["-f", correctionMigrationPath]);
  insertCanonicalLedger(
    "20260806093000",
    "correct_billing_provider_product_identity",
    correctionMigrationPath
  );
}

function installPauseAfterRelationLocks(applicationName, pauseLockKey) {
  runPsql([
    "-c",
    `
      create or replace function public.issue_887_pause_after_relation_locks()
      returns event_trigger
      language plpgsql
      as $pause$
      begin
        if tg_tag = 'CREATE TABLE'
          and current_setting('application_name') = ${sqlLiteral(
            applicationName
          )}
        then
          perform pg_catalog.pg_advisory_xact_lock(${pauseLockKey}::bigint);
        end if;
      end
      $pause$;
      create event trigger issue_887_pause_after_relation_locks
        on ddl_command_start
        execute function public.issue_887_pause_after_relation_locks();
    `,
  ]);
}

function removePauseAfterRelationLocks() {
  runPsql([
    "-c",
    `
      drop event trigger if exists issue_887_pause_after_relation_locks;
      drop function if exists public.issue_887_pause_after_relation_locks();
    `,
  ]);
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
  { role: "homa_eval" }
);

assert.equal(canonicalMigrationStatements(originalMigrationPath).length, 7);
assert.equal(canonicalMigrationStatements(aclMigrationPath).length, 2);
assert.equal(canonicalMigrationStatements(correctionMigrationPath).length, 1);

const fixtureIds = [
  "88700000-0000-4000-8000-000000000001",
  "88700000-0000-4000-8000-000000000002",
  "88700000-0000-4000-8000-000000000003",
];

function resetFresh({
  duplicateSubscription = false,
  nullStatus = false,
} = {}) {
  const thirdSubscription = duplicateSubscription
    ? "sub_issue_887_02"
    : "sub_issue_887_03";
  const thirdStatus = nullStatus ? "null" : "'past_due'";
  runPsql([
    "-c",
    `
      drop event trigger if exists issue_887_fail_on_grant;
      drop event trigger if exists issue_887_pause_after_relation_locks;
      drop function if exists public.issue_887_fail_on_grant();
      drop function if exists public.issue_887_pause_after_relation_locks();
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
        '20260806092000',
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
    `expected exactly ${expectedMarker}, got ${result.stdout.join(" | ")}`
  );
  return result;
}

function assertRepairFailure(pattern) {
  const result = runPsql(["-f", repairPath], { expectedStatus: 1 });
  assert.match(result.stderr, pattern);
  return result;
}

function spawnedRepairMarkers(result) {
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("ISSUE_887_REPAIR="));
}

async function waitForRepairRelationLocks(
  observerSql,
  applicationName,
  requiredRelations
) {
  await waitFor(
    `${applicationName} to hold every required relation lock`,
    async () => {
      const rows = await observerSql`
      select
        namespace.nspname as schema_name,
        relation.relname as relation_name,
        relation_lock.mode,
        relation_lock.granted,
        exists (
          select 1
          from pg_catalog.pg_locks advisory_wait
          where advisory_wait.pid = activity.pid
            and advisory_wait.locktype = 'advisory'
            and not advisory_wait.granted
        ) as waiting_on_advisory
      from pg_catalog.pg_stat_activity activity
      join pg_catalog.pg_locks relation_lock
        on relation_lock.pid = activity.pid
       and relation_lock.locktype = 'relation'
      join pg_catalog.pg_class relation
        on relation.oid = relation_lock.relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where activity.application_name = ${applicationName}
    `;
      const heldRelations = new Set(
        rows
          .filter(
            (row) =>
              row.mode === "ShareRowExclusiveLock" &&
              row.granted === true &&
              row.waiting_on_advisory === true
          )
          .map((row) => `${row.schema_name}.${row.relation_name}`)
      );
      return requiredRelations.every((relation) => heldRelations.has(relation));
    }
  );
}

async function waitForWriterToBlock(
  observerSql,
  applicationName,
  schemaName,
  relationName
) {
  await waitFor(`${applicationName} to wait behind the repair`, async () => {
    const rows = await observerSql`
      select exists (
        select 1
        from pg_catalog.pg_stat_activity activity
        join pg_catalog.pg_locks relation_lock
          on relation_lock.pid = activity.pid
        join pg_catalog.pg_class relation
          on relation.oid = relation_lock.relation
        join pg_catalog.pg_namespace namespace
          on namespace.oid = relation.relnamespace
        where activity.application_name = ${applicationName}
          and namespace.nspname = ${schemaName}
          and relation.relname = ${relationName}
          and relation_lock.mode = 'RowExclusiveLock'
          and not relation_lock.granted
      ) as waiting
    `;
    return rows[0]?.waiting === true;
  });
}

runPsql(["-f", originalMigrationPath]);
runPsql([
  "-c",
  `
    grant select on table public.family_billing_subscriptions to public, authenticated;
    revoke truncate on table public.family_billing_subscriptions from service_role;
  `,
]);
runPsql(["-f", aclMigrationPath]);
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
  "forward migration did not create the exact owner and service_role ACL"
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

const effectivePrivileges = runPsql([
  "-Atc",
  `
    with requested(privilege_name) as (
      values
        ('SELECT'),
        ('INSERT'),
        ('UPDATE'),
        ('DELETE'),
        ('TRUNCATE'),
        ('REFERENCES'),
        ('TRIGGER')
    )
    select concat_ws(
      '|',
      bool_and(not pg_catalog.has_table_privilege(
        'anon',
        'public.family_billing_subscriptions',
        privilege_name
      )),
      bool_and(not pg_catalog.has_table_privilege(
        'authenticated',
        'public.family_billing_subscriptions',
        privilege_name
      )),
      bool_and(pg_catalog.has_table_privilege(
        'service_role',
        'public.family_billing_subscriptions',
        privilege_name
      ))
    )
    from requested;
  `,
]);
assert.deepEqual(effectivePrivileges.stdout, ["t|t|t"]);

const functionalServiceRole = runPsql([
  "-Atc",
  `
    begin;
    set role service_role;
    insert into public.family_billing_subscriptions (
      id,
      family_id,
      provider,
      provider_subscription_id,
      plan_tier,
      status
    ) values (
      '88700000-0000-4000-8000-000000000099'::uuid,
      '${fixtureIds[0]}'::uuid,
      'google',
      'issue_887_service_role_probe',
      'regular',
      'active'
    );
    do $service_role_probe$
    declare
      visible_rows integer;
    begin
      select count(*)
      into visible_rows
      from public.family_billing_subscriptions
      where id = '88700000-0000-4000-8000-000000000099'::uuid;

      if visible_rows <> 1 then
        raise exception
          'service_role probe found % rows after insert, expected 1',
          visible_rows;
      end if;
    end
    $service_role_probe$;
    update public.family_billing_subscriptions
    set status = 'canceled'
    where id = '88700000-0000-4000-8000-000000000099'::uuid;
    delete from public.family_billing_subscriptions
    where id = '88700000-0000-4000-8000-000000000099'::uuid;
    truncate table public.family_billing_subscriptions;
    rollback;
    select 'service_role_dml_ok';
  `,
]);
assert.deepEqual(functionalServiceRole.stdout, ["service_role_dml_ok"]);

const ledgerEvidence = runPsql([
  "-Atc",
  `
    select concat_ws('|', version, name, cardinality(statements))
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806092000', '20260806093000')
    order by version;
  `,
]);
assert.deepEqual(ledgerEvidence.stdout, [
  "20260801110000|family_billing_subscriptions|7",
  "20260806092000|harden_family_billing_subscriptions_acl|2",
  "20260806093000|correct_billing_provider_product_identity|1",
]);

const exactLedgerEvidence = runPsql([
  "-Atc",
  `
    select count(*) = 3
      and bool_and(case version
        when '20260801110000' then
          name = 'family_billing_subscriptions'
          and statements = ${canonicalStatementArray(originalMigrationPath)}
        when '20260806092000' then
          name = 'harden_family_billing_subscriptions_acl'
          and statements = ${canonicalStatementArray(aclMigrationPath)}
        when '20260806093000' then
          name = 'correct_billing_provider_product_identity'
          and statements = ${canonicalStatementArray(correctionMigrationPath)}
        else false
      end)
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806092000', '20260806093000');
  `,
]);
assert.deepEqual(exactLedgerEvidence.stdout, ["t"]);

const reconstructed = runPsql([
  "-Atc",
  `
    select string_agg(
      array_to_string(statements, E';\n') || E';\n',
      E'\n'
      order by version
    )
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806092000', '20260806093000');
  `,
]);
assert.match(reconstructed.rawStdout, /create table if not exists/u);
assert.match(
  reconstructed.rawStdout,
  /grant all privileges[\s\S]*service_role/u
);
assert.match(reconstructed.rawStdout, /set provider_product_id = null/u);
runPsql(["-c", reconstructed.rawStdout]);
applyRepair("ISSUE_887_REPAIR=verified_noop");

resetFresh();
installCanonicalOriginalState();
const canonicalOriginalOnly = runPsql([
  "-Atc",
  `
    select count(*) = 1
      and bool_and(
        name = 'family_billing_subscriptions'
        and statements = ${canonicalStatementArray(originalMigrationPath)}
      )
    from supabase_migrations.schema_migrations
    where version = '20260801110000';
  `,
]);
assert.deepEqual(
  canonicalOriginalOnly.stdout,
  ["t"],
  "canonical original-only state did not preserve genuine migration history"
);
applyRepair();
applyRepair("ISSUE_887_REPAIR=verified_noop");

resetFresh();
installCanonicalAclState();
const canonicalOriginalPlusAcl = runPsql([
  "-Atc",
  `
    select count(*) = 2
      and bool_and(case version
        when '20260801110000' then
          name = 'family_billing_subscriptions'
          and statements = ${canonicalStatementArray(originalMigrationPath)}
        when '20260806092000' then
          name = 'harden_family_billing_subscriptions_acl'
          and statements = ${canonicalStatementArray(aclMigrationPath)}
        else false
      end)
    from supabase_migrations.schema_migrations
    where version in ('20260801110000', '20260806092000');
  `,
]);
assert.deepEqual(
  canonicalOriginalPlusAcl.stdout,
  ["t"],
  "original-plus-ACL state did not preserve both canonical ledgers"
);
applyRepair();
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
    "effective client role membership",
    "grant service_role to authenticated",
    /effective client table privilege/u,
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
    /existing migration ledger differs from canonical history/u,
  ],
];

for (const [label, mutation, errorPattern] of transactionalTamperCases) {
  const rejected = runPsql(["-c", `begin; ${mutation};`, "-f", repairPath], {
    expectedStatus: 1,
  });
  assert.match(
    rejected.stderr,
    errorPattern,
    `${label} tamper was not rejected`
  );
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
  { expectedStatus: 1 }
);
assert.match(
  partitionDrift.stderr,
  /relation metadata differs from the reviewed contract/u
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
        where version in ('20260801110000', '20260806092000', '20260806093000')
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
        where version in ('20260801110000', '20260806092000', '20260806093000')
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
        where version in ('20260801110000', '20260806092000', '20260806093000')
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
        where version in ('20260801110000', '20260806092000', '20260806093000')
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
        where version in ('20260801110000', '20260806092000', '20260806093000')
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
        where version in ('20260801110000', '20260806092000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(nullStatusRollback.stdout, ["t|t"]);

resetFresh();
runPsql(["-c", "create table public.family_billing_subscriptions (id uuid);"]);
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
      'harden_family_billing_subscriptions_acl'
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
    values (
      '20260806092000',
      array['select 1;'],
      'harden_family_billing_subscriptions_acl'
    );
  `,
]);
assertRepairFailure(/canonical history/u);

const pauseAfterRelationLocksKey = 887_060_920_000;
const acceptedStartingStates = [
  {
    name: "fresh",
    install: () => {},
    ledgerExists: false,
    expectedMarker: "ISSUE_887_REPAIR=repaired",
  },
  {
    name: "original_only",
    install: installCanonicalOriginalState,
    ledgerExists: true,
    expectedMarker: "ISSUE_887_REPAIR=repaired",
  },
  {
    name: "original_plus_acl",
    install: installCanonicalAclState,
    ledgerExists: true,
    expectedMarker: "ISSUE_887_REPAIR=repaired",
  },
  {
    name: "complete",
    install: installCanonicalCompleteState,
    ledgerExists: true,
    expectedMarker: "ISSUE_887_REPAIR=verified_noop",
  },
];

async function proveWritersBlockForAcceptedState(startingState) {
  resetFresh();
  startingState.install();

  const repairApplicationName = `issue887_lock_probe_${startingState.name}`;
  const blockerPool = postgres(databaseUrlFor("postgres"), {
    max: 1,
    onnotice: () => {},
  });
  const observerSql = postgres(databaseUrlFor("postgres"), {
    max: 1,
    onnotice: () => {},
  });
  const blockerSql = await blockerPool.reserve();
  const writerDefinitions = [
    {
      name: "migration_ledger",
      schemaName: "supabase_migrations",
      relationName: "schema_migrations",
      statement: `
        update supabase_migrations.schema_migrations
        set name = name
        where version = '20260801110000';
      `,
    },
    {
      name: "families",
      schemaName: "public",
      relationName: "families",
      statement: `
        update public.families
        set name = name
        where id = '${fixtureIds[0]}'::uuid;
      `,
    },
  ];
  if (startingState.ledgerExists) {
    writerDefinitions.push({
      name: "stripe_subscription",
      schemaName: "public",
      relationName: "family_billing_subscriptions",
      statement: `
        update public.family_billing_subscriptions
        set provider_product_id = provider_product_id
        where provider = 'stripe';
      `,
    });
  }

  let blockerHeld = false;
  let triggerInstalled = false;
  let repairRun;
  const writerRuns = [];
  try {
    await blockerSql`select pg_catalog.pg_advisory_lock(${pauseAfterRelationLocksKey}::bigint)`;
    blockerHeld = true;
    installPauseAfterRelationLocks(
      repairApplicationName,
      pauseAfterRelationLocksKey
    );
    triggerInstalled = true;

    repairRun = spawnPsql(["-f", repairPath], {
      applicationName: repairApplicationName,
    });
    const requiredRelations = [
      "supabase_migrations.schema_migrations",
      "public.families",
    ];
    if (startingState.ledgerExists) {
      requiredRelations.push("public.family_billing_subscriptions");
    }
    await waitForRepairRelationLocks(
      observerSql,
      repairApplicationName,
      requiredRelations
    );

    for (const writer of writerDefinitions) {
      const applicationName = `issue887_${startingState.name}_${writer.name}`;
      const run = spawnPsql(
        [
          "-c",
          `
            set statement_timeout = '20s';
            ${writer.statement}
          `,
        ],
        { applicationName }
      );
      writerRuns.push({ ...run, applicationName, writer });
    }
    await Promise.all(
      writerRuns.map((run) =>
        waitForWriterToBlock(
          observerSql,
          run.applicationName,
          run.writer.schemaName,
          run.writer.relationName
        )
      )
    );

    const unlockRows = await blockerSql`
      select pg_catalog.pg_advisory_unlock(
        ${pauseAfterRelationLocksKey}::bigint
      ) as unlocked
    `;
    assert.equal(unlockRows[0]?.unlocked, true);
    blockerHeld = false;

    const [repairResult, ...writerResults] = await Promise.all([
      repairRun.completion,
      ...writerRuns.map((run) => run.completion),
    ]);
    assert.equal(repairResult.status, 0, repairResult.stderr);
    assert.deepEqual(spawnedRepairMarkers(repairResult), [
      startingState.expectedMarker,
    ]);
    for (const writerResult of writerResults) {
      assert.equal(writerResult.status, 0, writerResult.stderr);
    }
  } finally {
    if (blockerHeld) {
      await blockerSql`select pg_catalog.pg_advisory_unlock(${pauseAfterRelationLocksKey}::bigint)`;
    }
    for (const running of [repairRun, ...writerRuns]) {
      if (running?.child.exitCode === null) running.child.kill("SIGKILL");
    }
    await Promise.allSettled(
      [repairRun, ...writerRuns]
        .filter(Boolean)
        .map((running) => running.completion)
    );
    if (triggerInstalled) removePauseAfterRelationLocks();
    blockerSql.release();
    await Promise.all([blockerPool.end(), observerSql.end()]);
  }

  applyRepair("ISSUE_887_REPAIR=verified_noop");
}

for (const startingState of acceptedStartingStates) {
  await proveWritersBlockForAcceptedState(startingState);
}

async function proveTwoRepairSessionsSerialize() {
  resetFresh();
  const firstApplicationName = "issue887_dual_repair_first";
  const secondApplicationName = "issue887_dual_repair_second";
  const blockerPool = postgres(databaseUrlFor("postgres"), {
    max: 1,
    onnotice: () => {},
  });
  const observerSql = postgres(databaseUrlFor("postgres"), {
    max: 1,
    onnotice: () => {},
  });
  const blockerSql = await blockerPool.reserve();
  let blockerHeld = false;
  let triggerInstalled = false;
  let firstRepair;
  let secondRepair;
  try {
    await blockerSql`select pg_catalog.pg_advisory_lock(${pauseAfterRelationLocksKey}::bigint)`;
    blockerHeld = true;
    installPauseAfterRelationLocks(
      firstApplicationName,
      pauseAfterRelationLocksKey
    );
    triggerInstalled = true;

    firstRepair = spawnPsql(["-f", repairPath], {
      applicationName: firstApplicationName,
    });
    await waitForRepairRelationLocks(observerSql, firstApplicationName, [
      "supabase_migrations.schema_migrations",
      "public.families",
    ]);

    secondRepair = spawnPsql(["-f", repairPath], {
      applicationName: secondApplicationName,
    });
    await waitFor(
      "second exact repair to wait on the issue advisory lock",
      async () => {
        const rows = await observerSql`
        select exists (
          select 1
          from pg_catalog.pg_stat_activity first_activity
          join pg_catalog.pg_locks first_lock
            on first_lock.pid = first_activity.pid
          join pg_catalog.pg_stat_activity second_activity
            on true
          join pg_catalog.pg_locks second_lock
            on second_lock.pid = second_activity.pid
          where first_activity.application_name = ${firstApplicationName}
            and second_activity.application_name = ${secondApplicationName}
            and first_lock.locktype = 'advisory'
            and first_lock.granted
            and second_lock.locktype = 'advisory'
            and not second_lock.granted
            and first_lock.classid = second_lock.classid
            and first_lock.objid = second_lock.objid
            and first_lock.objsubid = second_lock.objsubid
        ) as serialized
      `;
        return rows[0]?.serialized === true;
      }
    );

    const unlockRows = await blockerSql`
      select pg_catalog.pg_advisory_unlock(
        ${pauseAfterRelationLocksKey}::bigint
      ) as unlocked
    `;
    assert.equal(unlockRows[0]?.unlocked, true);
    blockerHeld = false;

    const [firstResult, secondResult] = await Promise.all([
      firstRepair.completion,
      secondRepair.completion,
    ]);
    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.deepEqual(spawnedRepairMarkers(firstResult), [
      "ISSUE_887_REPAIR=repaired",
    ]);
    assert.deepEqual(spawnedRepairMarkers(secondResult), [
      "ISSUE_887_REPAIR=verified_noop",
    ]);
  } finally {
    if (blockerHeld) {
      await blockerSql`select pg_catalog.pg_advisory_unlock(${pauseAfterRelationLocksKey}::bigint)`;
    }
    for (const running of [firstRepair, secondRepair]) {
      if (running?.child.exitCode === null) running.child.kill("SIGKILL");
    }
    await Promise.allSettled(
      [firstRepair, secondRepair]
        .filter(Boolean)
        .map((running) => running.completion)
    );
    if (triggerInstalled) removePauseAfterRelationLocks();
    blockerSql.release();
    await Promise.all([blockerPool.end(), observerSql.end()]);
  }
}

await proveTwoRepairSessionsSerialize();
applyRepair("ISSUE_887_REPAIR=verified_noop");

resetFresh();
runPsql([
  "-c",
  `
    insert into supabase_migrations.schema_migrations
      (version, statements, name)
    values ('20260801110000', array['select 1;'], 'family_billing_subscriptions');
  `,
]);
assertRepairFailure(/canonical history/u);

resetFresh();
installCanonicalOriginalState();
runPsql(["-f", correctionMigrationPath]);
insertCanonicalLedger(
  "20260806093000",
  "correct_billing_provider_product_identity",
  correctionMigrationPath
);
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
assertRepairFailure(/canonical history/u);

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
        where version in ('20260801110000', '20260806092000', '20260806093000')
      )
    );
  `,
]);
assert.deepEqual(
  rollbackState.stdout,
  ["t|t|t|t|t|t"],
  "mid-migration failure left billing relation or ledger residue"
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
  "Issue 887 repair passed canonical history, staged forwards, effective ACL, all-state writer locking, two-session serialization, metadata, collision, mixed-state, no-op, and rollback probes."
);
