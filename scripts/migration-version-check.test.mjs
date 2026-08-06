import assert from "node:assert/strict";
import test from "node:test";

import { migrationVersionCollisions } from "./migration-version-check.mjs";

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
