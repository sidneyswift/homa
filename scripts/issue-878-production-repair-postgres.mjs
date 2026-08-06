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
  "issue-878-production-repair.sql",
);
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

const sandboxHash =
  "e1ccac4fab7d7346e91e39ae864d35e82b35ce13894f3ed2d6811492fdf993c7";
const deleteHash =
  "841ce177e122e393a8d5e37590b3290e2c6b3e1f1a813f158995ee0681c854d8";

const setup = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[] not null,
    name text not null
  );
  delete from supabase_migrations.schema_migrations
  where version in ('20260806034000', '20260806035000');

  create or replace function public.create_my_family(
    family_name text default 'My family',
    family_us_state text default null,
    parent_name text default null
  )
  returns table (family_id uuid)
  language plpgsql
  security definer
  set search_path = ''
  as $unsafe$
  declare
    new_family_id uuid;
  begin
    if auth.uid() is null then
      raise exception 'Must be authenticated to create a family';
    end if;
    insert into public.families (name, us_state, parent_display_name, sandbox)
    values (family_name, family_us_state, nullif(trim(parent_name), ''), false)
    returning id into new_family_id;
    insert into public.family_members (family_id, user_id, role)
    values (new_family_id, auth.uid(), 'parent');
    return query select new_family_id;
  end
  $unsafe$;
  revoke all on function public.create_my_family(text, text, text) from public;
  revoke execute on function public.create_my_family(text, text, text) from anon;
  grant execute on function public.create_my_family(text, text, text) to authenticated;
  grant execute on function public.create_my_family(text, text, text) to service_role;

  create or replace function private.pause_check_ins_for_removed_member()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $unsafe$
  begin
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end
  $unsafe$;
  revoke all on function private.pause_check_ins_for_removed_member()
    from public, anon, authenticated;

  do $owner$
  begin
    if not exists (
      select 1 from pg_catalog.pg_roles where rolname = 'postgres'
    ) then
      execute 'create role postgres nologin superuser';
    end if;
  end
  $owner$;
  alter function public.create_my_family(text, text, text) owner to postgres;
  alter function private.pause_check_ins_for_removed_member() owner to postgres;
`;

function runPsql(actions, expectedStatus = 0) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "-qX", "-v", "ON_ERROR_STOP=1", ...actions],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180_000,
    },
  );

  if (result.error) throw result.error;
  if (expectedStatus === 0) {
    assert.equal(result.status, 0, result.stderr || "issue 878 repair failed");
  } else {
    assert.notEqual(result.status, 0, "issue 878 repair unexpectedly succeeded");
  }
  return {
    stdout: result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
    stderr: result.stderr,
  };
}

const reusedSession = runPsql([
  "-c",
  setup,
  "-f",
  repairPath,
  "-f",
  repairPath,
]);
assert.deepEqual(
  reusedSession.stdout.filter((line) => line.startsWith("ISSUE_878_REPAIR=")),
  ["ISSUE_878_REPAIR=repaired", "ISSUE_878_REPAIR=verified_noop"],
);

const createFamilyExecuteGrants = runPsql([
  "-Atc",
  `
    select role.rolname
    from pg_catalog.aclexplode(
      (select proacl
       from pg_catalog.pg_proc
       where oid = 'public.create_my_family(text,text,text)'::regprocedure)
    ) privilege
    join pg_catalog.pg_roles role
      on role.oid = privilege.grantee
    where privilege.privilege_type = 'EXECUTE'
    order by role.rolname;
  `,
]);
assert.deepEqual(createFamilyExecuteGrants.stdout, ["authenticated", "postgres"]);

const freshSession = runPsql(["-f", repairPath]);
assert.ok(freshSession.stdout.includes("ISSUE_878_REPAIR=verified_noop"));

const exactLedger = runPsql([
  "-Atc",
  `
    select concat_ws('|', version, name, statements[2])
    from supabase_migrations.schema_migrations
    where version in ('20260806034000', '20260806035000')
    order by version;
  `,
]);
assert.deepEqual(exactLedger.stdout, [
  `20260806034000|sandbox_live_auth_fixtures|sha256=${sandboxHash}`,
  `20260806035000|family_delete_progress_trigger|sha256=${deleteHash}`,
]);

runPsql([
  "-c",
  "alter function public.create_my_family(text, text, text) owner to homa_eval;",
]);
const wrongCreateOwner = runPsql(["-f", repairPath], 1);
assert.match(wrongCreateOwner.stderr, /create_my_family owner is not postgres/u);
runPsql([
  "-c",
  "alter function public.create_my_family(text, text, text) owner to postgres;",
]);

runPsql([
  "-c",
  "alter function private.pause_check_ins_for_removed_member() owner to homa_eval;",
]);
const wrongPauseOwner = runPsql(["-f", repairPath], 1);
assert.match(
  wrongPauseOwner.stderr,
  /pause_check_ins_for_removed_member owner is not postgres/u,
);
runPsql([
  "-c",
  "alter function private.pause_check_ins_for_removed_member() owner to postgres;",
]);

const residue = runPsql([
  "-Atc",
  `
    select concat_ws('|',
      count(*) filter (
        where email like 'issue-878-%@invalid.example'
           or email like 'issue-878+%+homatest@invalid.example'
      ),
      (select count(*) from public.families where name like 'Issue 878 % probe'),
      (select count(*) from public.events
        where props ->> 'reason' = 'member_removed'
          and props ->> 'family_id' in (
            select id::text from public.families where name like 'Issue 878 % probe'
          ))
    )
    from auth.users;
  `,
]);
assert.ok(residue.stdout.includes("0|0|0"), "rollback-only probes left residue");

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements = array['tampered']::text[]
    where version = '20260806034000';
  `,
]);
const tampered = runPsql(["-f", repairPath], 1);
assert.match(tampered.stderr, /ledger hash evidence is absent or altered/u);

runPsql([
  "-c",
  `
    update supabase_migrations.schema_migrations
    set statements = array[
      'Issue 878 exact migration applied atomically',
      'sha256=${sandboxHash}'
    ]::text[]
    where version = '20260806034000';
    delete from supabase_migrations.schema_migrations
    where version = '20260806035000';
  `,
]);
const mixed = runPsql(["-f", repairPath], 1);
assert.match(mixed.stderr, /migration ledger is mixed/u);

const finalLedger = runPsql([
  "-Atc",
  `
    select concat_ws('|', version, name, statements[2])
    from supabase_migrations.schema_migrations
    where version in ('20260806034000', '20260806035000')
    order by version;
  `,
]);
assert.deepEqual(finalLedger.stdout, [
  `20260806034000|sandbox_live_auth_fixtures|sha256=${sandboxHash}`,
]);

console.log(
  "Issue 878 repair passed application, repeat, fresh-client, tamper, mixed-state, and rollback-only probes.",
);
