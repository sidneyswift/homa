import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalMigrationContract,
  canonicalMigrationStatements,
} from "./production-schema-contract.mjs";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(databaseUrl, "HOMA_EVAL_DATABASE_URL must point at a disposable database");

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reconcilePath = resolve(repositoryRoot, "scripts/production-schema-reconcile.mjs");
const psql = process.env.HOMA_POSTGRES_BIN
  ? resolve(process.env.HOMA_POSTGRES_BIN, "psql")
  : "psql";

function runPsql(command) {
  const result = spawnSync(
    psql,
    ["--dbname", databaseUrl, "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1"],
    { encoding: "utf8", input: command, timeout: 30_000 },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
}

function runReconciliation(expectedStatus = 0) {
  const result = spawnSync(process.execPath, [reconcilePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, HOMA_SCHEMA_DATABASE_URL: databaseUrl },
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, expectedStatus, result.stderr);
  return result;
}

const migrations = canonicalMigrationContract();
runPsql(`
  create schema if not exists supabase_migrations;
  create table supabase_migrations.schema_migrations (
    version text primary key,
    statements text[] not null,
    name text not null
  );
`);

const values = migrations
  .map(
    ({ version, name, filename }) => {
      const statements = canonicalMigrationStatements(
        resolve(repositoryRoot, "supabase", "migrations", filename),
      )
        .map((statement) => `'${statement.replaceAll("'", "''")}'`)
        .join(", ");
      return `('${version}', array[${statements}]::text[], '${name.replaceAll("'", "''")}')`;
    },
  )
  .join(",\n");
runPsql(`
  insert into supabase_migrations.schema_migrations (version, statements, name)
  values ${values};
`);

const healthy = runReconciliation();
assert.match(healthy.stdout, /Production schema reconciliation passed/u);

runPsql("drop table public.family_billing_subscriptions cascade;");
const missingBilling = runReconciliation(1);
assert.match(missingBilling.stderr, /missing relation public\.family_billing_subscriptions/u);

console.log("Production schema reconciliation blocks a missing billing relation on a disposable database.");
