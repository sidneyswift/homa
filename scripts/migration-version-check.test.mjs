import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkMigrationVersions,
  migrationVersionCollisions,
} from "./migration-version-check.mjs";

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

test("keeps the corrected issue 873 migration under the permanent version guard", () => {
  const migrationsDirectory = resolve(repositoryRoot, "supabase/migrations");
  const result = checkMigrationVersions(migrationsDirectory);

  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.collisions, []);
  assert.equal(
    existsSync(
      resolve(
        migrationsDirectory,
        "20260805200000_reconcile_trial_claim_migration.sql",
      ),
    ),
    true,
  );
});
