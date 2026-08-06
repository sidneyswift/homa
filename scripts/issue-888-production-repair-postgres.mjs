import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(databaseUrl, "HOMA_EVAL_DATABASE_URL must point at a disposable database");

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repairPath = join(
  repositoryRoot,
  "scripts",
  "issue-888-production-repair.sql",
);
const originalMigrationPath = join(
  repositoryRoot,
  "supabase",
  "migrations",
  "20260801201500_month_plan_approvals.sql",
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

const originalHash =
  "82e13e2cb85667f8ec9e5d8f561fcc63332e34c90b19b168f2aad462065e8d66";
const boundaryHash =
  "9fabf67838a95a6cf6df569d275d0314c8304523ca9a494334da2a80bcab5a12";

const postgresUrl = new URL(databaseUrl);
postgresUrl.username = "postgres";
postgresUrl.password = "";

function runPsql(actions, expectedStatus = 0, targetUrl = postgresUrl.toString()) {
  const result = spawnSync(
    psql,
    ["--dbname", targetUrl, "-qX", "-v", "ON_ERROR_STOP=1", ...actions],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180_000,
    },
  );

  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(result.status, 0, result.stderr || "issue 888 repair failed");
  } else {
    assert.notEqual(result.status, 0, "issue 888 repair unexpectedly succeeded");
  }

  return {
    stdout: result.stdout,
    lines: result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
    stderr: result.stderr,
  };
}

function repairMarkers(result) {
  return result.lines.filter((line) => line.startsWith("ISSUE_888_REPAIR="));
}

runPsql(
  [
    "-c",
    `
      do $roles$
      begin
        if not exists (
          select 1 from pg_catalog.pg_roles where rolname = 'postgres'
        ) then
          create role postgres login superuser;
        else
          alter role postgres login superuser;
        end if;
      end
      $roles$;

      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[] not null,
        name text not null
      );
      alter table supabase_migrations.schema_migrations owner to postgres;

      drop table if exists public.month_plan_approvals cascade;
      delete from supabase_migrations.schema_migrations
      where version in ('20260801201500', '20260806040000');

      alter default privileges for role postgres in schema public
        grant all privileges on tables to anon, authenticated, service_role;
    `,
  ],
  0,
  databaseUrl,
);

runPsql(["-f", originalMigrationPath]);

const reproducedDefaults = runPsql([
  "-Atc",
  `
    with privilege_counts as (
      select
        count(*) filter (
          where grantee = (select oid from pg_roles where rolname = 'anon')
        ) as anon_count,
        count(*) filter (
          where grantee = (select oid from pg_roles where rolname = 'authenticated')
        ) as authenticated_count,
        count(*) filter (
          where grantee = (select oid from pg_roles where rolname = 'service_role')
        ) as service_role_count,
        count(*) filter (
          where grantee = (select oid from pg_roles where rolname = 'authenticated')
            and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
        ) as dangerous_authenticated_count
      from pg_catalog.aclexplode(
        (select relacl from pg_class
          where oid = 'public.month_plan_approvals'::regclass)
      )
    ), platform_default as (
      select count(*) as privilege_count
      from pg_catalog.aclexplode(
        pg_catalog.acldefault(
          'r',
          (select oid from pg_roles where rolname = 'postgres')
        )
      )
    )
    select
      anon_count = privilege_count
      and authenticated_count = privilege_count - 3
      and service_role_count = privilege_count
      and dangerous_authenticated_count = 3
    from privilege_counts, platform_default;
  `,
]);
assert.deepEqual(
  reproducedDefaults.lines,
  ["t"],
  "disposable setup did not reproduce Supabase default table grants",
);
runPsql(["-c", "drop table public.month_plan_approvals;"]);

const reusedSession = runPsql(["-f", repairPath, "-f", repairPath]);
assert.deepEqual(repairMarkers(reusedSession), [
  "ISSUE_888_REPAIR=repaired",
  "ISSUE_888_REPAIR=verified_noop",
]);

const freshSession = runPsql(["-f", repairPath]);
assert.deepEqual(repairMarkers(freshSession), [
  "ISSUE_888_REPAIR=verified_noop",
]);

const exactLedger = runPsql([
  "-Atc",
  `
    select concat_ws('|', version, name, cardinality(statements),
      statements[1] like '%source_sha256=' || case version
        when '20260801201500' then '${originalHash}'
        when '20260806040000' then '${boundaryHash}'
      end || '%')
    from supabase_migrations.schema_migrations
    where version in ('20260801201500', '20260806040000')
    order by version;
  `,
]);
assert.deepEqual(exactLedger.lines, [
  "20260801201500|month_plan_approvals|6|t",
  "20260806040000|month_plan_approvals_write_boundary|3|t",
]);

const fetchedMigration = runPsql([
  "-Atc",
  `
    select string_agg(
      array_to_string(statements, E';\\n') || ';',
      E'\\n'
      order by version
    )
    from supabase_migrations.schema_migrations
    where version in ('20260801201500', '20260806040000');
  `,
]).stdout.trim();
assert.match(fetchedMigration, /create table if not exists public\.month_plan_approvals/u);
assert.match(fetchedMigration, /grant all privileges[\s\S]*service_role/u);

runPsql(["-c", "drop table public.month_plan_approvals;"]);
runPsql(["-c", fetchedMigration]);
assert.deepEqual(repairMarkers(runPsql(["-f", repairPath])), [
  "ISSUE_888_REPAIR=verified_noop",
]);

const firstUserId = randomUUID();
const secondUserId = randomUUID();
const firstFamilyId = randomUUID();
const secondFamilyId = randomUUID();
const firstDraftId = randomUUID();
const secondDraftId = randomUUID();

runPsql([
  "-c",
  `
    set session_replication_role = replica;
    insert into auth.users (id, email, email_confirmed_at) values
      ('${firstUserId}', 'issue-888-first-${firstUserId}@invalid.example', now()),
      ('${secondUserId}', 'issue-888-second-${secondUserId}@invalid.example', now());
    set session_replication_role = origin;

    insert into public.families (id, name, sandbox) values
      ('${firstFamilyId}', 'Issue 888 first harness family', true),
      ('${secondFamilyId}', 'Issue 888 second harness family', true);
    insert into public.family_members (family_id, user_id, role, display_name) values
      ('${firstFamilyId}', '${firstUserId}', 'parent', 'Issue 888 harness'),
      ('${secondFamilyId}', '${secondUserId}', 'parent', 'Issue 888 harness');

    set role service_role;
    insert into public.month_plan_approvals (
      draft_id,
      family_id,
      month_start,
      final_revision,
      revision_history
    ) values
      (
        '${firstDraftId}',
        '${firstFamilyId}',
        date '2026-09-01',
        2,
        '[{"revision":1},{"revision":2}]'::jsonb
      ),
      (
        '${secondDraftId}',
        '${secondFamilyId}',
        date '2026-10-01',
        1,
        '[{"revision":1}]'::jsonb
      );
    reset role;
  `,
]);

const validReceipt = runPsql([
  "-Atc",
  `
    select concat_ws('|', month_start, final_revision,
      jsonb_array_length(revision_history), approved_at is not null)
    from public.month_plan_approvals
    where draft_id = '${firstDraftId}';
  `,
]);
assert.deepEqual(validReceipt.lines, ["2026-09-01|2|2|t"]);

const familyRead = runPsql([
  "-Atc",
  `
    set request.jwt.claim.sub = '${firstUserId}';
    set role authenticated;
    select concat_ws('|', count(*),
      count(*) filter (where family_id = '${firstFamilyId}'),
      count(*) filter (where family_id = '${secondFamilyId}'))
    from public.month_plan_approvals
    where draft_id in ('${firstDraftId}', '${secondDraftId}');
  `,
]);
assert.ok(familyRead.lines.includes("1|1|0"), "family RLS did not isolate receipts");

for (const [operation, sql] of [
  [
    "insert",
    `insert into public.month_plan_approvals
      (draft_id, family_id, month_start, final_revision, revision_history)
     values ('${randomUUID()}', '${firstFamilyId}', date '2026-11-01', 1, '[]')`,
  ],
  [
    "update",
    `update public.month_plan_approvals set final_revision = 3
     where draft_id = '${firstDraftId}'`,
  ],
  [
    "delete",
    `delete from public.month_plan_approvals where draft_id = '${firstDraftId}'`,
  ],
  ["truncate", "truncate table public.month_plan_approvals"],
]) {
  const denied = runPsql(
    [
      "-c",
      `set request.jwt.claim.sub = '${firstUserId}'; set role authenticated; ${sql};`,
    ],
    1,
  );
  assert.match(
    denied.stderr,
    /permission denied for table month_plan_approvals/u,
    `authenticated ${operation} did not fail at the table privilege boundary`,
  );
}

runPsql([
  "-c",
  `
    set role service_role;
    update public.month_plan_approvals
      set final_revision = 3
      where draft_id = '${firstDraftId}';
    delete from public.month_plan_approvals
      where draft_id = '${secondDraftId}';
    reset role;
  `,
]);
const serverMutation = runPsql([
  "-Atc",
  `
    select concat_ws('|',
      (select final_revision from public.month_plan_approvals
        where draft_id = '${firstDraftId}'),
      not exists (select 1 from public.month_plan_approvals
        where draft_id = '${secondDraftId}'));
  `,
]);
assert.deepEqual(serverMutation.lines, ["3|t"]);

const invalidCases = [
  [
    "month start",
    `insert into public.month_plan_approvals values
      ('${randomUUID()}', '${firstFamilyId}', date '2026-09-02', 1, '[]', now())`,
    /month_plan_approvals_month_start_check/u,
  ],
  [
    "revision lower bound",
    `insert into public.month_plan_approvals values
      ('${randomUUID()}', '${firstFamilyId}', date '2026-09-01', 0, '[]', now())`,
    /month_plan_approvals_final_revision_check/u,
  ],
  [
    "revision history shape",
    `insert into public.month_plan_approvals values
      ('${randomUUID()}', '${firstFamilyId}', date '2026-09-01', 1, '{}', now())`,
    /month_plan_approvals_revision_history_check/u,
  ],
  [
    "family foreign key",
    `insert into public.month_plan_approvals values
      ('${randomUUID()}', '${randomUUID()}', date '2026-09-01', 1, '[]', now())`,
    /month_plan_approvals_family_id_fkey/u,
  ],
  [
    "draft id primary key",
    `insert into public.month_plan_approvals values
      ('${firstDraftId}', '${firstFamilyId}', date '2026-09-01', 1, '[]', now())`,
    /month_plan_approvals_pkey/u,
  ],
];
for (const [label, sql, errorPattern] of invalidCases) {
  const rejected = runPsql(["-c", sql], 1);
  assert.match(rejected.stderr, errorPattern, `${label} constraint was not enforced`);
}

const cascadeDraftId = randomUUID();
runPsql([
  "-c",
  `
    insert into public.month_plan_approvals (
      draft_id, family_id, month_start, final_revision, revision_history
    ) values (
      '${cascadeDraftId}', '${secondFamilyId}', date '2026-12-01', 1, '[]'
    );
    delete from public.families where id = '${secondFamilyId}';
  `,
]);
assert.deepEqual(
  runPsql([
    "-Atc",
    `select count(*) from public.month_plan_approvals where draft_id = '${cascadeDraftId}';`,
  ]).lines,
  ["0"],
  "family deletion did not cascade to month plan approvals",
);

const transactionalTamperCases = [
  [
    "schema",
    "alter table public.month_plan_approvals alter column approved_at drop default",
    /columns differ from the reviewed six-column contract/u,
  ],
  [
    "ACL",
    "grant insert on table public.month_plan_approvals to authenticated",
    /ACL differs from contract/u,
  ],
  [
    "policy",
    `create policy "issue 888 extra policy" on public.month_plan_approvals
      for select to authenticated using (true)`,
    /exactly one reviewed policy/u,
  ],
  [
    "constraint",
    `alter table public.month_plan_approvals
      drop constraint month_plan_approvals_final_revision_check,
      add constraint month_plan_approvals_final_revision_check
        check (final_revision >= 0)`,
    /check constraints differ from contract/u,
  ],
  [
    "index",
    `drop index public.month_plan_approvals_family_month_idx;
     create index month_plan_approvals_family_month_idx
       on public.month_plan_approvals (month_start)`,
    /family-month index differs from contract/u,
  ],
  [
    "ledger",
    `update supabase_migrations.schema_migrations
      set statements = array['select 1']::text[]
      where version = '20260806040000'`,
    /ledger hash evidence is absent or altered/u,
  ],
];

for (const [label, mutation, errorPattern] of transactionalTamperCases) {
  const rejected = runPsql(["-c", `begin; ${mutation};`, "-f", repairPath], 1);
  assert.match(rejected.stderr, errorPattern, `${label} tamper was not rejected`);
  assert.deepEqual(
    repairMarkers(runPsql(["-f", repairPath])),
    ["ISSUE_888_REPAIR=verified_noop"],
    `${label} tamper escaped its failed transaction`,
  );
}

const ledgerMixed = runPsql(
  [
    "-c",
    `begin;
     delete from supabase_migrations.schema_migrations
       where version = '20260806040000';`,
    "-f",
    repairPath,
  ],
  1,
);
assert.match(ledgerMixed.stderr, /migration ledger is mixed/u);

const relationMixed = runPsql(
  [
    "-c",
    "begin; drop index public.month_plan_approvals_family_month_idx;",
    "-f",
    repairPath,
  ],
  1,
);
assert.match(relationMixed.stderr, /relation state is mixed/u);

const tableCollision = runPsql(
  [
    "-c",
    `begin;
     delete from supabase_migrations.schema_migrations
       where version in ('20260801201500', '20260806040000');
     drop table public.month_plan_approvals;
     create view public.month_plan_approvals as select 1 as collision;`,
    "-f",
    repairPath,
  ],
  1,
);
assert.match(tableCollision.stderr, /relation state is mixed/u);

const indexCollision = runPsql(
  [
    "-c",
    `begin;
     delete from supabase_migrations.schema_migrations
       where version in ('20260801201500', '20260806040000');
     drop table public.month_plan_approvals;
     create table public.issue_888_index_collision (family_id uuid);
     create index month_plan_approvals_family_month_idx
       on public.issue_888_index_collision (family_id);`,
    "-f",
    repairPath,
  ],
  1,
);
assert.match(indexCollision.stderr, /relation state is mixed/u);

runPsql([
  "-c",
  `
    delete from supabase_migrations.schema_migrations
    where version in ('20260801201500', '20260806040000');
    drop table public.month_plan_approvals;

    create or replace function public.issue_888_fail_on_grant()
    returns event_trigger
    language plpgsql
    as $failure$
    begin
      if tg_tag = 'GRANT' then
        raise exception 'issue 888 injected mid-migration failure';
      end if;
    end
    $failure$;
    create event trigger issue_888_fail_on_grant
      on ddl_command_start
      execute function public.issue_888_fail_on_grant();
  `,
]);

const injectedFailure = runPsql(["-f", repairPath], 1);
assert.match(injectedFailure.stderr, /injected mid-migration failure/u);

const rollbackState = runPsql([
  "-Atc",
  `
    select concat_ws('|',
      to_regclass('public.month_plan_approvals') is null,
      to_regclass('public.month_plan_approvals_pkey') is null,
      to_regclass('public.month_plan_approvals_family_month_idx') is null,
      not exists (
        select 1 from supabase_migrations.schema_migrations
        where version in ('20260801201500', '20260806040000')
      ));
  `,
]);
assert.deepEqual(
  rollbackState.lines,
  ["t|t|t|t"],
  "mid-migration failure left relation or ledger residue",
);

runPsql([
  "-c",
  `
    drop event trigger issue_888_fail_on_grant;
    drop function public.issue_888_fail_on_grant();
  `,
]);

assert.deepEqual(repairMarkers(runPsql(["-f", repairPath])), [
  "ISSUE_888_REPAIR=repaired",
]);
assert.deepEqual(repairMarkers(runPsql(["-f", repairPath])), [
  "ISSUE_888_REPAIR=verified_noop",
]);

runPsql([
  "-c",
  `
    delete from public.families
    where id in ('${firstFamilyId}', '${secondFamilyId}');
    delete from auth.users
    where id in ('${firstUserId}', '${secondUserId}');
  `,
]);

const residue = runPsql([
  "-Atc",
  `
    select concat_ws('|',
      count(*) filter (where email like 'issue-888-%@invalid.example'),
      (select count(*) from public.families
        where name like 'Issue 888 % harness family'),
      (select count(*) from public.month_plan_approvals
        where family_id in ('${firstFamilyId}', '${secondFamilyId}')))
    from auth.users;
  `,
]);
assert.deepEqual(residue.lines, ["0|0|0"], "issue 888 harness left fixture residue");

console.log(
  "Issue 888 repair passed Supabase-default, application, replay, fresh-session, behavior, tamper, collision, mixed-state, and rollback probes.",
);
