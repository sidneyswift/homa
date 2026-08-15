import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8");

const expectedTimeouts = {
  "classify-changes": 5,
  "light-checks": 10,
  "brand-checks": 20,
  "build-and-check": 5,
  "mobile-checks": 20,
  build: 20,
  checks: 20,
  "db-checks": 35,
  "e2e-checks": 20,
};

test("every CI job has its reviewed timeout", () => {
  for (const [job, minutes] of Object.entries(expectedTimeouts)) {
    const jobPattern = new RegExp(
      `^  ${job}:\\n(?:(?!^  [A-Za-z0-9_-]+:)[\\s\\S])*?^    timeout-minutes: ${minutes}$`,
      "m",
    );
    assert.match(workflow, jobPattern, `${job} must stop within ${minutes} minutes`);
  }
});
