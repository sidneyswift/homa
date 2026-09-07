#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.argv.length, 2, "This contract accepts no arguments.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// This test substitutes adminDb, which does not honor the eval database URL.
// Supply only local tool-discovery variables, never application credentials.
const environment = Object.fromEntries(
  ["PATH", "HOME", "USER", "TMPDIR", "HOMA_POSTGRES_BIN"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
const result = spawnSync(process.execPath, [
  "--import", "tsx", "--test", "--test-reporter=tap",
  "apps/web/lib/knowledge/gaps-postgres.test.ts",
], { cwd: root, env: environment, stdio: "inherit", timeout: 180_000 });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
