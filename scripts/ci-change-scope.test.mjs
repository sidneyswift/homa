import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCiFiles,
  shouldSkipVercelPreview,
  validateCiResults,
} from "./ci-change-scope.mjs";

const success = {
  "classify-changes": "success",
  "light-checks": "success",
  "brand-checks": "success",
  "mobile-checks": "success",
  build: "success",
  checks: "success",
  "db-checks": "success",
  "e2e-checks": "success",
};

test("documentation-only changes take the light CI path", () => {
  assert.equal(
    classifyCiFiles(["AGENTS.md", "docs/homa-planning/audit.md", ".agents/skills/foo/SKILL.md"]),
    "docs-only",
  );
});

test("mobile-only changes run mobile CI without web CI", () => {
  assert.equal(
    classifyCiFiles(["apps/mobile/src/app.tsx", "apps/mobile/README.md"]),
    "mobile-only",
  );
});

test("runtime, dependency, database, and unknown changes run full CI", () => {
  for (const file of [
    "apps/web/app/page.tsx",
    "packages/core/src/index.ts",
    ".cosmo/references/index.json",
    "pnpm-lock.yaml",
    "supabase/migrations/20260731000000_example.sql",
    "something-new.txt",
  ]) {
    assert.equal(classifyCiFiles([file]), "full", file);
  }
});

test("a runtime file prevents a mixed documentation change from taking a fast path", () => {
  assert.equal(classifyCiFiles(["docs/note.md", "apps/web/app/page.tsx"]), "full");
});

test("workflow, mobile, and documentation changes may skip a web preview", () => {
  assert.equal(
    shouldSkipVercelPreview([
      ".github/workflows/ci.yml",
      "apps/mobile/src/app.tsx",
      "docs/homa-planning/audit.md",
    ]),
    true,
  );
});

test("web preview skipping fails closed for build inputs", () => {
  for (const file of [
    "apps/web/vercel.json",
    "apps/web/next.config.ts",
    "packages/taxonomy/src/index.ts",
    ".vercelignore",
    "turbo.json",
  ]) {
    assert.equal(shouldSkipVercelPreview([file]), false, file);
  }
});

test("an empty or malformed diff never skips work", () => {
  assert.equal(classifyCiFiles([]), "full");
  assert.equal(shouldSkipVercelPreview([]), false);
});

test("the required-status gate accepts exactly the jobs for each scope", () => {
  assert.doesNotThrow(() => validateCiResults("full", success));
  assert.doesNotThrow(() =>
    validateCiResults("mobile-only", {
      ...success,
      build: "skipped",
      checks: "skipped",
      "db-checks": "skipped",
      "e2e-checks": "skipped",
    }),
  );
  assert.doesNotThrow(() =>
    validateCiResults("docs-only", {
      ...success,
      "mobile-checks": "skipped",
      build: "skipped",
      checks: "skipped",
      "db-checks": "skipped",
      "e2e-checks": "skipped",
    }),
  );
});

test("the required-status gate rejects a missing, failed, or surprising job", () => {
  assert.throws(() => validateCiResults("full", { ...success, checks: "failed" }));
  assert.throws(() => validateCiResults("mobile-only", { ...success, "brand-checks": "failed", build: "skipped", checks: "skipped", "db-checks": "skipped", "e2e-checks": "skipped" }));
  assert.throws(() => validateCiResults("docs-only", { ...success, "brand-checks": "skipped", "mobile-checks": "skipped", build: "skipped", checks: "skipped", "db-checks": "skipped", "e2e-checks": "skipped" }));
  assert.throws(() => validateCiResults("docs-only", success));
  assert.throws(() => validateCiResults("unknown", success));
});
