import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrationVersionCollisions } from "./migration-version-check.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("accepts one migration for each version", () => {
  assert.deepEqual(
    migrationVersionCollisions([
      "20260804090000_first_change.sql",
      "20260804100000_second_change.sql",
    ]),
    [],
  );
});

test("reports every filename that shares a version", () => {
  assert.deepEqual(
    migrationVersionCollisions([
      "20260804090000_first_change.sql",
      "20260804090000_second_change.sql",
      "20260804100000_third_change.sql",
    ]),
    [
      [
        "20260804090000",
        [
          "20260804090000_first_change.sql",
          "20260804090000_second_change.sql",
        ],
      ],
    ],
  );
});

test("ignores non-migration files when checking version collisions", () => {
  assert.deepEqual(
    migrationVersionCollisions([
      "README.md",
      "20260804090000_first_change.sql",
      "20260804090000_first_change.sql.bak",
    ]),
    [],
  );
});

test("keeps the issue 873 schema and ledger repair in one transaction", () => {
  const repairSql = readFileSync(
    resolve(repositoryRoot, "scripts/trial-claim-migration-repair.sql"),
    "utf8",
  );
  const migrationInclude = repairSql.indexOf(
    "\\ir ../supabase/migrations/20260805200000_reconcile_trial_claim_migration.sql",
  );
  const ledgerInsert = repairSql.indexOf(
    "insert into supabase_migrations.schema_migrations",
  );

  assert.ok(repairSql.startsWith("\\set ON_ERROR_STOP on"));
  assert.ok(repairSql.indexOf("begin;") < migrationInclude);
  assert.ok(migrationInclude < ledgerInsert);
  assert.ok(ledgerInsert < repairSql.lastIndexOf("commit;"));
  assert.match(
    repairSql,
    /create or replace function pg_temp\.assert_trial_claim_table\(required boolean\)/u,
  );
  assert.match(repairSql, /perform pg_temp\.assert_trial_claim_table\(false\)/u);
  assert.match(repairSql, /select pg_temp\.assert_trial_claim_table\(true\)/u);
  assert.match(
    repairSql,
    /drop function pg_temp\.assert_trial_claim_table\(boolean\)/u,
  );
  assert.match(repairSql, /on conflict \(version\) do nothing/u);
});

test("binds the production workflow to the audited repair and proves a no-op rerun", () => {
  const workflow = readFileSync(
    resolve(repositoryRoot, ".github/workflows/trial-claim-migration-repair.yml"),
    "utf8",
  );
  const repairSql = readFileSync(
    resolve(repositoryRoot, "scripts/trial-claim-migration-repair.sql"),
  );
  const repairHash = createHash("sha256").update(repairSql).digest("hex");

  assert.match(workflow, /environment: production/u);
  assert.match(workflow, /GITHUB_REPOSITORY.*sidneyswift\/homa/u);
  assert.match(workflow, /kzplntcdtsvdowntvlza/u);
  assert.equal(
    workflow.match(/-f scripts\/trial-claim-migration-repair\.sql/g)?.length,
    2,
  );
  assert.match(workflow, /ISSUE_873_REPAIR=verified_noop/u);
  assert.doesNotMatch(workflow, /supabase migration repair/u);
  assert.match(workflow, new RegExp(repairHash, "u"));
});
