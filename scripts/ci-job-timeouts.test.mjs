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

test("the PostgreSQL package fallback is bounded and only installs missing packages", () => {
  const stepPattern = /      - name: Ensure PostgreSQL 16 and pgvector for disposable clusters\n        timeout-minutes: 5\n        run: \|\n([\s\S]*?)\n\n      - name: Trial claim repair survives a reused PostgreSQL session/m;
  const step = workflow.match(stepPattern)?.[1] ?? "";
  assert.match(step, /if \[ ! -x \/usr\/lib\/postgresql\/16\/bin\/initdb \]; then/);
  assert.match(step, /if \[ ! -f \/usr\/share\/postgresql\/16\/extension\/vector\.control \]; then/);
  assert.match(step, /if \[ "\$\{#packages\[@\]\}" -gt 0 \]; then/);
  assert.match(step, /sudo apt-get install --yes "\$\{packages\[@\]\}"/);
});
