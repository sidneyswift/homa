import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(
  databaseUrl,
  "HOMA_EVAL_DATABASE_URL must point at a disposable database"
);

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repairPath = join(
  repositoryRoot,
  "scripts",
  "issue-878-account-deletion-containment.sql"
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

function historicalRpc(version) {
  const migration = readFileSync(
    join(repositoryRoot, "supabase", "migrations", version),
    "utf8"
  );
  const match = migration.match(
    /create or replace function public\.delete_own_account\(\)[\s\S]*?grant execute on function public\.delete_own_account\(\) to authenticated;/u
  );
  assert.ok(match, `historical RPC is absent from ${version}`);
  return match[0];
}

const firstHistoricalRpc = historicalRpc(
  "20260728180000_self_account_deletion.sql"
);
const secondHistoricalRpc = historicalRpc(
  "20260803100000_account_family_data_deletion.sql"
);

function runPsql(actions, expectedStatus = 0) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "-qX", "-v", "ON_ERROR_STOP=1", ...actions],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180_000,
    }
  );

  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(
      result.status,
      0,
      result.stderr || "account-deletion containment failed"
    );
  } else {
    assert.notEqual(
      result.status,
      0,
      "account-deletion containment unexpectedly succeeded"
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

const baseSetup = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[] not null,
    name text not null
  );
  delete from supabase_migrations.schema_migrations
  where version = '20260809030000';
  delete from public.account_deletion_jobs;

  do $owner$
  begin
    if not exists (
      select 1 from pg_catalog.pg_roles where rolname = 'postgres'
    ) then
      execute 'create role postgres nologin superuser';
    end if;
  end
  $owner$;
`;

function installHistoricalRpc(source) {
  runPsql([
    "-c",
    source,
    "-c",
    `
      alter function public.delete_own_account() owner to postgres;
      grant execute on function public.delete_own_account()
        to public, anon, authenticated, service_role;
    `,
  ]);
}

runPsql(["-c", baseSetup]);
installHistoricalRpc(firstHistoricalRpc);

runPsql([
  "-c",
  `
    insert into public.account_deletion_jobs (status)
    values ('preparing');
  `,
]);
const activeJobBlocked = runPsql(["-f", repairPath], 1);
assert.match(
  activeJobBlocked.stderr,
  /requires zero non-complete deletion jobs/u
);
const blockedState = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      exists (
        select 1 from supabase_migrations.schema_migrations
        where version = '20260809030000'
      ),
      pg_catalog.strpos(
        pg_catalog.pg_get_functiondef(
          'public.delete_own_account()'::regprocedure
        ),
        'delete from auth.users'
      ) > 0
    );
  `,
]);
assert.deepEqual(blockedState.stdout, ["f|t"]);
runPsql(["-c", "delete from public.account_deletion_jobs;"]);

runPsql([
  "-c",
  `
    create or replace function public.fail_issue_878_containment_ledger()
    returns trigger
    language plpgsql
    as $failure$
    begin
      if new.version = '20260809030000' then
        raise exception 'injected containment ledger failure';
      end if;
      return new;
    end
    $failure$;
    create trigger fail_issue_878_containment_ledger
    before insert on supabase_migrations.schema_migrations
    for each row execute function public.fail_issue_878_containment_ledger();
  `,
]);
const injectedFailure = runPsql(["-f", repairPath], 1);
assert.match(injectedFailure.stderr, /injected containment ledger failure/u);
const injectedRollback = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      exists (
        select 1 from supabase_migrations.schema_migrations
        where version = '20260809030000'
      ),
      pg_catalog.strpos(
        pg_catalog.pg_get_functiondef(
          'public.delete_own_account()'::regprocedure
        ),
        'delete from auth.users'
      ) > 0
    );
  `,
]);
assert.deepEqual(injectedRollback.stdout, ["f|t"]);
runPsql([
  "-c",
  `
    drop trigger fail_issue_878_containment_ledger
      on supabase_migrations.schema_migrations;
    drop function public.fail_issue_878_containment_ledger();
  `,
]);

const firstApplication = runPsql(["-f", repairPath]);
assert.ok(
  firstApplication.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied"
  )
);
const firstFreshNoop = runPsql(["-f", repairPath]);
assert.ok(
  firstFreshNoop.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=verified_noop"
  )
);

const privileges = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      pg_catalog.has_function_privilege(
        'anon', 'public.delete_own_account()', 'execute'
      ),
      pg_catalog.has_function_privilege(
        'authenticated', 'public.delete_own_account()', 'execute'
      ),
      pg_catalog.has_function_privilege(
        'service_role', 'public.delete_own_account()', 'execute'
      ),
      exists (
        select 1
        from pg_catalog.aclexplode(
          (select proacl from pg_catalog.pg_proc
           where oid = 'public.delete_own_account()'::regprocedure)
        ) privilege
        where privilege.privilege_type = 'EXECUTE'
          and privilege.grantee = 0
      )
    );
  `,
]);
assert.deepEqual(privileges.stdout, ["f|f|f|f"]);

const ownerProbe = runPsql(
  ["-c", "set role postgres; select public.delete_own_account();"],
  1
);
assert.match(ownerProbe.stderr, /account deletion is temporarily unavailable/u);

const ledger = runPsql([
  "-Atc",
  `
    select concat_ws(
      '|',
      version,
      name,
      pg_catalog.cardinality(statements),
      pg_catalog.strpos(
        statements[1],
        'sha256=d654b9c3666a67fadcf667861063850394e805aee5d9522e9ea62407c075b96a'
      ) > 0
    )
    from supabase_migrations.schema_migrations
    where version = '20260809030000';
  `,
]);
assert.deepEqual(ledger.stdout, [
  "20260809030000|pause_legacy_account_deletion|2|t",
]);

const reconstructed = runPsql([
  "-Atc",
  `
    select pg_catalog.array_to_string(statements, E';\\n') || E';\\n'
    from supabase_migrations.schema_migrations
    where version = '20260809030000';
  `,
]).rawStdout;
assert.match(
  reconstructed,
  /sha256=d654b9c3666a67fadcf667861063850394e805aee5d9522e9ea62407c075b96a/u
);

installHistoricalRpc(secondHistoricalRpc);
const restoredDestructiveBody = runPsql(["-f", repairPath], 1);
assert.match(restoredDestructiveBody.stderr, /body differs from containment/u);
runPsql(["-c", reconstructed]);
const fetchedReplay = runPsql(["-f", repairPath]);
assert.ok(
  fetchedReplay.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=verified_noop"
  )
);

runPsql([
  "-c",
  "alter function public.delete_own_account() owner to homa_eval;",
]);
const wrongOwner = runPsql(["-f", repairPath], 1);
assert.match(wrongOwner.stderr, /owner is not postgres/u);
runPsql([
  "-c",
  "alter function public.delete_own_account() owner to postgres;",
]);

runPsql([
  "-c",
  "alter function public.delete_own_account() set search_path = public;",
]);
const wrongSearchPath = runPsql(["-f", repairPath], 1);
assert.match(wrongSearchPath.stderr, /metadata differs from containment/u);
runPsql(["-c", reconstructed]);

runPsql([
  "-c",
  `
    create function public.delete_own_account(target_user_id uuid)
    returns void
    language plpgsql
    as $overload$
    begin
      return;
    end
    $overload$;
  `,
]);
const extraOverload = runPsql(["-f", repairPath], 1);
assert.match(extraOverload.stderr, /exactly one reviewed signature/u);
runPsql(["-c", "drop function public.delete_own_account(uuid);"]);

runPsql([
  "-c",
  "grant execute on function public.delete_own_account() to authenticated;",
]);
const unexpectedGrant = runPsql(["-f", repairPath], 1);
assert.match(unexpectedGrant.stderr, /unexpected execute grant/u);
runPsql(["-c", reconstructed]);

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements = array['tampered']::text[]
    where version = '20260809030000';
  `,
]);
const tamperedLedger = runPsql(["-f", repairPath], 1);
assert.match(tamperedLedger.stderr, /ledger evidence is absent or altered/u);

runPsql([
  "-c",
  `
    delete from supabase_migrations.schema_migrations
    where version = '20260809030000';
  `,
]);
installHistoricalRpc(secondHistoricalRpc);
const secondApplication = runPsql(["-f", repairPath]);
assert.ok(
  secondApplication.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied"
  )
);
const secondFreshNoop = runPsql(["-f", repairPath]);
assert.ok(
  secondFreshNoop.stdout.includes(
    "ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=verified_noop"
  )
);

console.log(
  "Issue 878 account-deletion containment passed historical RPC, active-job, rollback, ACL, ledger, replay, tamper, and fresh-repeat probes."
);
