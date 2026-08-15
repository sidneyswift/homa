import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import {
  ISSUE_878_ACCOUNT_DELETION_CONTAINMENT_SENSITIVE_PATHS,
  validateIssue878AccountDeletionContainmentGitContract,
} from "./issue-878-account-deletion-containment-git-contract.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  resolve(
    repositoryRoot,
    ".github/workflows/issue-878-account-deletion-containment.yml"
  ),
  "utf8"
);
const repair = readFileSync(
  resolve(repositoryRoot, "scripts/issue-878-account-deletion-containment.sql"),
  "utf8"
);
const contract = readFileSync(
  resolve(
    repositoryRoot,
    "scripts/issue-878-account-deletion-containment-git-contract.mjs"
  )
);
const migration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260809030000_pause_legacy_account_deletion.sql"
  ),
  "utf8"
);
const route = readFileSync(
  resolve(repositoryRoot, "apps/web/app/api/account-deletion/route.ts"),
  "utf8"
);
const webSurface = readFileSync(
  resolve(
    repositoryRoot,
    "apps/web/app/app/settings/delete-family-data-card.tsx"
  ),
  "utf8"
);
const mobileSurface = readFileSync(
  resolve(repositoryRoot, "apps/mobile/src/app/settings/delete-account.tsx"),
  "utf8"
);
const schedule = readFileSync(
  resolve(repositoryRoot, "apps/web/agent/schedules/account-deletions.ts"),
  "utf8"
);
const workflowDocument = parse(workflow);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function git(repository, args) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeRepositoryFile(repository, path, contents) {
  const absolutePath = join(repository, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${contents}\n`, "utf8");
}

function syntheticContainmentRepository(alteredPath = null) {
  const repository = mkdtempSync(
    join(tmpdir(), "homa-issue-878-containment-git-contract-")
  );
  git(repository, ["init", "--quiet", "--initial-branch=main"]);
  git(repository, ["config", "user.name", "Issue 878 containment test"]);
  git(repository, [
    "config",
    "user.email",
    "issue-878-containment@invalid.example",
  ]);

  for (const path of ISSUE_878_ACCOUNT_DELETION_CONTAINMENT_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `base:${path}`);
  }
  writeRepositoryFile(repository, "main-state.txt", "base");
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "base"]);
  const baseSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "-b", "reviewed"]);
  for (const path of ISSUE_878_ACCOUNT_DELETION_CONTAINMENT_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `reviewed:${path}`);
  }
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "reviewed"]);

  git(repository, ["checkout", "--quiet", "main"]);
  assert.equal(git(repository, ["rev-parse", "HEAD"]), baseSha);
  writeRepositoryFile(repository, "main-state.txt", "main advanced");
  git(repository, ["add", "main-state.txt"]);
  git(repository, ["commit", "--quiet", "-m", "main advanced"]);

  const reviewedSha = git(repository, ["rev-parse", "reviewed"]);
  git(repository, ["merge", "--quiet", "--squash", "reviewed"]);
  git(repository, ["commit", "--quiet", "-m", "squash reviewed"]);

  if (alteredPath) {
    writeRepositoryFile(repository, alteredPath, `altered:${alteredPath}`);
    git(repository, ["add", alteredPath]);
    git(repository, ["commit", "--quiet", "--amend", "--no-edit"]);
  }

  return {
    repository,
    reviewedSha,
    finalSha: git(repository, ["rev-parse", "HEAD"]),
  };
}

test("containment Git contract accepts a squash release with reviewed sensitive files", () => {
  assert.deepEqual(ISSUE_878_ACCOUNT_DELETION_CONTAINMENT_SENSITIVE_PATHS, [
    ".github/workflows/ci.yml",
    ".github/workflows/issue-878-account-deletion-containment.yml",
    "apps/mobile/scripts/android-release-guard.mjs",
    "apps/mobile/scripts/android-release-guard.test.mjs",
    "apps/mobile/src/app/settings/delete-account.tsx",
    "apps/web/agent/schedules/account-deletions.ts",
    "apps/web/app/api/account-deletion/route.ts",
    "apps/web/app/app/settings/delete-family-data-card.tsx",
    "apps/web/app/app/settings/page.tsx",
    "apps/web/lib/account-deletion-containment.test.ts",
    "docs/homa-design/evidence/authoring-rails.json",
    "docs/homa-design/evidence/legacy-removal.json",
    "docs/homa-design/evidence/marketing-production.json",
    "docs/homa-design/evidence/surfaces.json",
    "package.json",
    "scripts/issue-878-account-deletion-containment-git-contract.mjs",
    "scripts/issue-878-account-deletion-containment-postgres.mjs",
    "scripts/issue-878-account-deletion-containment.sql",
    "scripts/issue-878-account-deletion-containment.test.mjs",
    "scripts/migration-version-check.mjs",
    "supabase/migrations/20260809030000_pause_legacy_account_deletion.sql",
  ]);

  const fixture = syntheticContainmentRepository();
  try {
    const result = validateIssue878AccountDeletionContainmentGitContract({
      repositoryRoot: fixture.repository,
      finalSha: fixture.finalSha,
      reviewedSha: fixture.reviewedSha,
    });
    assert.notEqual(result.finalTreeSha, result.reviewedTreeSha);
    assert.match(result.sensitiveManifestSha256, /^[0-9a-f]{64}$/u);
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("containment Git contract rejects a sensitive post-review change", () => {
  const fixture = syntheticContainmentRepository(
    ISSUE_878_ACCOUNT_DELETION_CONTAINMENT_SENSITIVE_PATHS[0]
  );
  try {
    assert.throws(
      () =>
        validateIssue878AccountDeletionContainmentGitContract({
          repositoryRoot: fixture.repository,
          finalSha: fixture.finalSha,
          reviewedSha: fixture.reviewedSha,
        }),
      /differs between the reviewed head/u
    );
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("containment Git contract permits an unrelated post-review change", () => {
  const fixture = syntheticContainmentRepository("main-state.txt");
  try {
    assert.doesNotThrow(() =>
      validateIssue878AccountDeletionContainmentGitContract({
        repositoryRoot: fixture.repository,
        finalSha: fixture.finalSha,
        reviewedSha: fixture.reviewedSha,
      })
    );
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("workflow is production-bound, immutable, and cancellation-recoverable", () => {
  assert.equal(
    workflowDocument.jobs.apply.if,
    "github.repository == 'sidneyswift/homa' && github.repository_owner == 'sidneyswift' && github.ref == 'refs/heads/main' && github.ref_name == 'main' && github.event.repository.default_branch == 'main' && github.actor == 'sidneyswift' && github.triggering_actor == 'sidneyswift'"
  );
  assert.equal(workflowDocument.jobs.apply.environment, "production");
  assert.equal(
    workflowDocument.concurrency.group,
    "production-issue-878-account-deletion-containment"
  );
  assert.equal(workflowDocument.concurrency["cancel-in-progress"], false);
  assert.equal(
    workflowDocument.jobs.apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
  );
  assert.equal(workflowDocument.jobs.apply.steps[0].with["fetch-depth"], 0);
  assert.match(workflow, /production_deployed_sha[\s\S]*required: true/u);
  assert.match(workflow, /reviewed_repair_sha[\s\S]*required: true/u);
  assert.match(workflow, /containment-git-contract/u);
  assert.doesNotMatch(workflow, /git rev-list --parents -n 1/u);
  assert.match(workflow, /FINAL_TREE_SHA/u);
  assert.match(workflow, /REVIEWED_TREE_SHA/u);
  assert.match(workflow, /SENSITIVE_MANIFEST_SHA256/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT/u);
  assert.match(workflow, /previous_conclusion/u);
  assert.match(workflow, /cancelled\|failure\|timed_out/u);
  assert.equal(
    workflow.match(/git ls-remote --exit-code origin refs\/heads\/main/g)
      ?.length,
    2
  );
  assert.equal(
    workflow.match(/-f scripts\/issue-878-account-deletion-containment\.sql/g)
      ?.length,
    2
  );
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
  assert.match(workflow, new RegExp(sha256(migration), "u"));
  assert.match(workflow, new RegExp(sha256(repair), "u"));
  assert.match(workflow, new RegExp(sha256(contract), "u"));

  for (const step of workflowDocument.jobs.apply.steps) {
    if (!step.run) continue;
    const syntax = spawnSync("bash", ["-n"], {
      input: step.run,
      encoding: "utf8",
    });
    assert.equal(
      syntax.status,
      0,
      `${step.name ?? "unnamed workflow step"}: ${syntax.stderr}`
    );
  }
});

test("repair applies one migration in one bounded locked transaction", () => {
  assert.deepEqual(repair.match(/^\\ir .*$/gmu), [
    "\\ir ../supabase/migrations/20260809030000_pause_legacy_account_deletion.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf("\\ir "));
  assert.ok(repair.indexOf("\\ir ") < repair.lastIndexOf("commit;"));
  assert.match(repair, /pg_advisory_xact_lock/u);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(
    repair,
    /lock table supabase_migrations\.schema_migrations\s+in share row exclusive mode/u
  );
  assert.match(
    repair,
    /lock table public\.account_deletion_jobs\s+in share row exclusive mode/u
  );
  assert.match(repair, /status <> 'complete'/u);
  assert.match(repair, /zero non-complete deletion jobs/u);
  assert.match(repair, /ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=applied/u);
  assert.match(repair, /ISSUE_878_ACCOUNT_DELETION_CONTAINMENT=verified_noop/u);
  assert.match(repair, new RegExp(sha256(migration), "u"));
});

test("migration and repair verify the exact fail-closed database contract", () => {
  const replaceAt = migration.indexOf(
    "create or replace function public.delete_own_account()"
  );
  const revokeAt = migration.indexOf(
    "revoke all on function public.delete_own_account()"
  );
  assert.ok(replaceAt >= 0 && revokeAt > replaceAt);
  assert.match(migration, /errcode = '55000'/u);
  assert.match(migration, /account deletion is temporarily unavailable/u);
  assert.match(migration, /from public, anon, authenticated, service_role/u);
  assert.match(repair, /pronargs <> 0/u);
  assert.match(repair, /prorettype <> 'void'::regtype/u);
  assert.match(repair, /not function_contract\.prosecdef/u);
  assert.match(repair, /search_path=""/u);
  assert.match(repair, /aclexplode/u);
  assert.match(repair, /privilege\.grantee <> function_contract\.proowner/u);
  assert.match(repair, /perform public\.delete_own_account\(\)/u);
  assert.match(repair, /when sqlstate '55000'/u);
  assert.match(
    repair,
    /statements = pg_temp\.issue_878_containment_ledger_statements/u
  );
});

test("current clients expose only the authenticated deletion protocol", () => {
  assert.doesNotMatch(route, /status: 503/u);
  assert.match(route, /createAccountDeletionPost/u);
  assert.match(route, /requireFamilyWithActorFromRequest/u);
  assert.match(route, /requestAccountDeletion/u);
  assert.match(route, /mapDb\(\)/u);
  assert.match(schedule, /retryPendingAccountDeletions/u);

  for (const [name, surface] of [
    ["web", webSurface],
    ["mobile", mobileSurface],
  ]) {
    assert.doesNotMatch(surface, /Account deletion is paused/u, name);
    assert.match(surface, /permanently deletes/u, name);
    assert.match(surface, /confirms billing/u, name);
  }
  assert.match(webSurface, /Permanently delete this family/u);
  assert.match(mobileSurface, /handleDelete/u);
});
