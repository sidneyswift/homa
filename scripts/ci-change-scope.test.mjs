import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyCiFiles,
  shouldSkipVercelPreview,
  validateCiResults,
} from "./ci-change-scope.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changeScopeScript = resolve(repositoryRoot, "scripts/ci-change-scope.mjs");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

const success = {
  "classify-changes": "success",
  "light-checks": "success",
  "brand-checks": "success",
  "mobile-checks": "success",
  build: "success",
  checks: "success",
  "db-checks": "success",
  "e2e-checks": "success",
  "browser-checks": "success",
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

test("Vercel checks every commit since the last successful branch deployment", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "homa-vercel-change-scope-"));
  try {
    git(fixture, ["init"]);
    git(fixture, ["config", "user.email", "fixture@invalid.example"]);
    git(fixture, ["config", "user.name", "Fixture"]);
    mkdirSync(resolve(fixture, "docs"), { recursive: true });
    writeFileSync(resolve(fixture, "docs/readme.md"), "base\n");
    git(fixture, ["add", "."]);
    git(fixture, ["commit", "-m", "base"]);
    const previousSha = git(fixture, ["rev-parse", "HEAD"]);

    mkdirSync(resolve(fixture, "apps/web/app"), { recursive: true });
    writeFileSync(resolve(fixture, "apps/web/app/page.tsx"), "export default function Page() {}\n");
    git(fixture, ["add", "."]);
    git(fixture, ["commit", "-m", "change product"]);
    writeFileSync(resolve(fixture, "docs/evidence.json"), "{}\n");
    git(fixture, ["add", "."]);
    git(fixture, ["commit", "-m", "update evidence"]);
    const currentSha = git(fixture, ["rev-parse", "HEAD"]);

    const result = spawnSync(process.execPath, [changeScopeScript, "vercel"], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        ...process.env,
        VERCEL_ENV: "preview",
        VERCEL_GIT_PREVIOUS_SHA: previousSha,
        VERCEL_GIT_COMMIT_SHA: currentSha,
      },
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Vercel change scope: build/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("Vercel builds when the previous deployment SHA is missing, invalid, or unavailable", () => {
  for (const previousSha of [undefined, "not-a-commit", "HEAD^", "0".repeat(40)]) {
    const env = { ...process.env, VERCEL_ENV: "preview" };
    delete env.VERCEL_GIT_COMMIT_SHA;
    if (previousSha) env.VERCEL_GIT_PREVIOUS_SHA = previousSha;
    else delete env.VERCEL_GIT_PREVIOUS_SHA;
    const result = spawnSync(process.execPath, [changeScopeScript, "vercel"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Vercel change scope: build/u);
  }

  const fixture = mkdtempSync(resolve(tmpdir(), "homa-vercel-mismatched-head-"));
  try {
    git(fixture, ["init"]);
    git(fixture, ["config", "user.email", "fixture@invalid.example"]);
    git(fixture, ["config", "user.name", "Fixture"]);
    writeFileSync(resolve(fixture, "first.txt"), "first\n");
    git(fixture, ["add", "."]);
    git(fixture, ["commit", "-m", "first"]);
    const priorCommit = git(fixture, ["rev-parse", "HEAD"]);
    writeFileSync(resolve(fixture, "second.txt"), "second\n");
    git(fixture, ["add", "."]);
    git(fixture, ["commit", "-m", "second"]);

    const mismatchedHead = spawnSync(process.execPath, [changeScopeScript, "vercel"], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        ...process.env,
        VERCEL_ENV: "preview",
        VERCEL_GIT_PREVIOUS_SHA: priorCommit,
        VERCEL_GIT_COMMIT_SHA: priorCommit,
      },
    });
    assert.equal(mismatchedHead.status, 1, mismatchedHead.stderr);
    assert.match(mismatchedHead.stderr, /does not match HEAD/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("Vercel builds for deleted or moved web files", () => {
  for (const scenario of ["delete", "move-to-docs"]) {
    const fixture = mkdtempSync(resolve(tmpdir(), `homa-vercel-${scenario}-`));
    try {
      git(fixture, ["init"]);
      git(fixture, ["config", "user.email", "fixture@invalid.example"]);
      git(fixture, ["config", "user.name", "Fixture"]);
      mkdirSync(resolve(fixture, "apps/web/app"), { recursive: true });
      mkdirSync(resolve(fixture, "docs"), { recursive: true });
      writeFileSync(resolve(fixture, "apps/web/app/page.tsx"), "export default function Page() {}\n");
      writeFileSync(resolve(fixture, "docs/readme.md"), "base\n");
      git(fixture, ["add", "."]);
      git(fixture, ["commit", "-m", "base"]);
      const previousSha = git(fixture, ["rev-parse", "HEAD"]);

      if (scenario === "delete") {
        rmSync(resolve(fixture, "apps/web/app/page.tsx"));
      } else {
        git(fixture, ["mv", "apps/web/app/page.tsx", "docs/page.tsx"]);
      }
      writeFileSync(resolve(fixture, "docs/evidence.json"), "{}\n");
      git(fixture, ["add", "-A"]);
      git(fixture, ["commit", "-m", scenario]);
      const currentSha = git(fixture, ["rev-parse", "HEAD"]);

      const result = spawnSync(process.execPath, [changeScopeScript, "vercel"], {
        cwd: fixture,
        encoding: "utf8",
        env: {
          ...process.env,
          VERCEL_ENV: "preview",
          VERCEL_GIT_PREVIOUS_SHA: previousSha,
          VERCEL_GIT_COMMIT_SHA: currentSha,
        },
      });
      assert.equal(result.status, 1, `${scenario}: ${result.stderr}`);
      assert.match(result.stderr, /Vercel change scope: build/u);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});

test("the required-status gate accepts exactly the jobs for each scope", () => {
  assert.doesNotThrow(() =>
    validateCiResults("full", { ...success, "mobile-checks": "skipped" }),
  );
  assert.doesNotThrow(() =>
    validateCiResults("mobile-only", {
      ...success,
      build: "skipped",
      checks: "skipped",
      "db-checks": "skipped",
      "e2e-checks": "skipped",
      "browser-checks": "skipped",
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
      "browser-checks": "skipped",
    }),
  );
});

test("the required-status gate rejects a missing, failed, or surprising job", () => {
  assert.throws(() => validateCiResults("full", success));
  assert.throws(() => validateCiResults("full", { ...success, checks: "failed" }));
  assert.throws(() => validateCiResults("mobile-only", { ...success, "brand-checks": "failed", build: "skipped", checks: "skipped", "db-checks": "skipped", "e2e-checks": "skipped" }));
  assert.throws(() => validateCiResults("docs-only", { ...success, "brand-checks": "skipped", "mobile-checks": "skipped", build: "skipped", checks: "skipped", "db-checks": "skipped", "e2e-checks": "skipped" }));
  assert.throws(() => validateCiResults("docs-only", success));
  assert.throws(() => validateCiResults("unknown", success));
});
