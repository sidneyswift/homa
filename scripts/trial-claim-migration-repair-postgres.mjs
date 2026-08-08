import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(databaseUrl, "HOMA_EVAL_DATABASE_URL must point at a disposable database");

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repairPath = join(repositoryRoot, "scripts", "trial-claim-migration-repair.sql");
const psql = process.env.HOMA_POSTGRES_BIN
  ? join(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

const setup = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[] not null,
    name text not null
  );
  delete from supabase_migrations.schema_migrations
  where version = '20260805200000';
  drop table if exists public.stripe_trial_card_claims;
  create or replace function pg_temp.assert_trial_claim_table(required boolean)
  returns void
  language plpgsql
  as $stale$
  begin
    raise exception 'stale pooled helper was not replaced';
  end
  $stale$;
`;

const helperCheck = `
  select 'ISSUE_873_HELPER_ABSENT=' ||
    (to_regprocedure('pg_temp.assert_trial_claim_table(boolean)') is null)::text;
`;

function runPsql(actions) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "-qX", "-v", "ON_ERROR_STOP=1", ...actions],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    },
  );

  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || "trial claim repair failed");
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

const reusedSession = runPsql([
  "-c",
  setup,
  "-f",
  repairPath,
  "-f",
  repairPath,
  "-c",
  helperCheck,
]);
const reusedMarkers = reusedSession.filter((line) =>
  line.startsWith("ISSUE_873_REPAIR="),
);

assert.deepEqual(reusedMarkers, [
  "ISSUE_873_REPAIR=repaired",
  "ISSUE_873_REPAIR=verified_noop",
]);
assert.ok(reusedSession.includes("ISSUE_873_HELPER_ABSENT=true"));

const freshSession = runPsql([
  "-f",
  repairPath,
  "-c",
  helperCheck,
]);
assert.ok(freshSession.includes("ISSUE_873_REPAIR=verified_noop"));
assert.ok(freshSession.includes("ISSUE_873_HELPER_ABSENT=true"));

console.log(
  "Trial claim repair passed on a stale pooled session, its repeat, and a fresh client.",
);
