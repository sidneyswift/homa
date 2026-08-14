import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import {
  ISSUE_878_ACCOUNT_DELETION_SCHEMA_RELEASE_SENSITIVE_PATHS,
  validateIssue878AccountDeletionSchemaReleaseGitContract,
} from "./issue-878-account-deletion-schema-release-git-contract.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/issue-878-account-deletion-schema-release.yml",
);
const releasePath = resolve(
  repositoryRoot,
  "scripts/issue-878-account-deletion-schema-release.sql",
);
const contractPath = resolve(
  repositoryRoot,
  "scripts/issue-878-account-deletion-schema-release-git-contract.mjs",
);
const harnessPath = resolve(
  repositoryRoot,
  "scripts/issue-878-account-deletion-schema-release-postgres.mjs",
);
const evalSandboxPath = resolve(repositoryRoot, "scripts/eval-sandbox.mts");

const migrationPaths = [
  "supabase/migrations/20260808170000_family_hard_delete_protocol.sql",
  "supabase/migrations/20260808171500_account_deletion_avatar_cleanup.sql",
  "supabase/migrations/20260808183000_folded_family_artifact_prefixes.sql",
  "supabase/migrations/20260808184500_apple_purchase_interlock.sql",
  "supabase/migrations/20260809030000_pause_legacy_account_deletion.sql",
];
const expectedMigrationHashes = [
  "2f7c819b27e77195aef1db8a4068aea03fd10dd578cf07d3d8c86f9bafda12a6",
  "915b6bc4bd5e644718f7364f886a331b8a20bcb674610e42ee71091c50471a25",
  "6eb9de43748106f4e6af46e9b188ece91ce5adab5b57ccc1c52e8da0821c35aa",
  "58d41cc2a770cd64e9c5968565e25a9317bf2b10c07a59b519369cd29a3e6e28",
  "d654b9c3666a67fadcf667861063850394e805aee5d9522e9ea62407c075b96a",
];

const workflow = readFileSync(workflowPath, "utf8");
const release = readFileSync(releasePath, "utf8");
const contract = readFileSync(contractPath);
const harness = readFileSync(harnessPath, "utf8");
const evalSandbox = readFileSync(evalSandboxPath, "utf8");
const migrations = migrationPaths.map((path) =>
  readFileSync(resolve(repositoryRoot, path)),
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

function syntheticExactReleaseRepository(alteredPath = null) {
  const repository = mkdtempSync(
    join(tmpdir(), "homa-issue-878-schema-git-contract-"),
  );
  git(repository, ["init", "--quiet", "--initial-branch=main"]);
  git(repository, ["config", "user.name", "Issue 878 schema test"]);
  git(repository, ["config", "user.email", "issue-878-schema@invalid.example"]);

  for (const path of ISSUE_878_ACCOUNT_DELETION_SCHEMA_RELEASE_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `base:${path}`);
  }
  writeRepositoryFile(repository, "main-state.txt", "base");
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "base"]);
  const baseSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "-b", "reviewed"]);
  for (const path of ISSUE_878_ACCOUNT_DELETION_SCHEMA_RELEASE_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `reviewed:${path}`);
  }
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "reviewed"]);

  git(repository, ["checkout", "--quiet", "main"]);
  assert.equal(git(repository, ["rev-parse", "HEAD"]), baseSha);
  writeRepositoryFile(repository, "main-state.txt", "main advanced");
  git(repository, ["add", "main-state.txt"]);
  git(repository, ["commit", "--quiet", "-m", "main advanced"]);

  git(repository, ["checkout", "--quiet", "reviewed"]);
  git(repository, ["merge", "--quiet", "main", "-m", "review main"]);
  const reviewedSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "main"]);
  git(repository, ["merge", "--quiet", "--no-ff", "reviewed", "-m", "merge"]);

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

test("reviewed migrations stay byte-exact", () => {
  assert.deepEqual(migrations.map(sha256), expectedMigrationHashes);
  for (const hash of expectedMigrationHashes) {
    assert.match(workflow, new RegExp(hash, "u"));
    assert.match(release, new RegExp(hash, "u"));
  }
});

test("release Git contract requires a normal merge with the reviewed exact tree", () => {
  assert.deepEqual(
    ISSUE_878_ACCOUNT_DELETION_SCHEMA_RELEASE_SENSITIVE_PATHS,
    [
      ".github/workflows/issue-878-account-deletion-schema-release.yml",
      "scripts/issue-878-account-deletion-schema-release-git-contract.mjs",
      "scripts/issue-878-account-deletion-schema-release.sql",
      "scripts/migration-version-check.mjs",
      ...migrationPaths,
    ],
  );

  const fixture = syntheticExactReleaseRepository();
  try {
    const result = validateIssue878AccountDeletionSchemaReleaseGitContract({
      repositoryRoot: fixture.repository,
      finalSha: fixture.finalSha,
      reviewedSha: fixture.reviewedSha,
    });
    assert.equal(result.finalTreeSha, result.reviewedTreeSha);
    assert.match(result.sensitiveManifestSha256, /^[0-9a-f]{64}$/u);
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("release Git contract rejects any post-review tree change", () => {
  for (const alteredPath of [
    ISSUE_878_ACCOUNT_DELETION_SCHEMA_RELEASE_SENSITIVE_PATHS[0],
    "main-state.txt",
  ]) {
    const fixture = syntheticExactReleaseRepository(alteredPath);
    try {
      assert.throws(
        () =>
          validateIssue878AccountDeletionSchemaReleaseGitContract({
            repositoryRoot: fixture.repository,
            finalSha: fixture.finalSha,
            reviewedSha: fixture.reviewedSha,
          }),
        /differs between the reviewed head|not byte-exactly/u,
      );
    } finally {
      rmSync(fixture.repository, { recursive: true, force: true });
    }
  }
});

test("workflow is production-bound, exact, recoverable, and sanitized", () => {
  const apply = workflowDocument.jobs.apply;
  assert.equal(
    apply.if,
    "github.repository == 'sidneyswift/homa' && github.repository_owner == 'sidneyswift' && github.ref == 'refs/heads/main' && github.ref_name == 'main' && github.event.repository.default_branch == 'main' && github.actor == 'sidneyswift' && github.triggering_actor == 'sidneyswift'",
  );
  assert.equal(apply.environment, "production");
  assert.equal(apply["timeout-minutes"], 10);
  assert.equal(workflowDocument.permissions.actions, "read");
  assert.equal(workflowDocument.permissions.contents, "read");
  assert.equal(
    workflowDocument.concurrency.group,
    "production-issue-878-account-deletion-schema-release",
  );
  assert.equal(workflowDocument.concurrency["cancel-in-progress"], false);
  assert.equal(
    apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  );
  assert.equal(apply.steps[0].with.ref, "${{ github.sha }}");
  assert.equal(apply.steps[0].with["fetch-depth"], 0);

  const inputs = workflowDocument.on.workflow_dispatch.inputs;
  assert.deepEqual(Object.keys(inputs), [
    "confirmation",
    "reviewed_release_sha",
    "production_deployed_sha",
  ]);
  assert.equal(inputs.confirmation.type, "string");
  assert.equal(inputs.reviewed_release_sha.type, "string");
  assert.equal(inputs.production_deployed_sha.type, "string");
  assert.match(workflow, /APPLY ISSUE 878 ACCOUNT DELETION SCHEMA ONLY/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT/u);
  assert.match(workflow, /previous_conclusion/u);
  assert.match(workflow, /cancelled\|failure\|timed_out/u);
  assert.match(workflow, /git rev-list|release-git-contract/u);
  assert.match(workflow, /FINAL_TREE_SHA/u);
  assert.match(workflow, /REVIEWED_TREE_SHA/u);
  assert.match(workflow, /SENSITIVE_MANIFEST_SHA256/u);
  assert.equal(
    workflow.match(
      /-f scripts\/issue-878-account-deletion-schema-release\.sql/g,
    )?.length,
    2,
  );
  assert.match(workflow, /ISSUE_878_ACCOUNT_DELETION_SCHEMA=applied/u);
  assert.match(workflow, /ISSUE_878_ACCOUNT_DELETION_SCHEMA=verified_noop/u);
  assert.equal(
    workflow.match(/git ls-remote --exit-code origin refs\/heads\/main/g)
      ?.length,
    2,
  );
  assert.match(workflow, /owner-only sanitized evidence log/u);
  assert.match(workflow, /sanitized_log_sha256/u);
  assert.match(workflow, /if: always\(\)/u);
  assert.doesNotMatch(workflow, /echo "\$result"/u);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
  assert.doesNotMatch(workflow, /actions\/checkout@v\d/u);
  assert.match(workflow, new RegExp(sha256(release), "u"));
  assert.match(workflow, new RegExp(sha256(contract), "u"));

  for (const step of apply.steps) {
    if (!step.run) continue;
    const syntax = spawnSync("bash", ["-n"], {
      input: step.run,
      encoding: "utf8",
    });
    assert.equal(
      syntax.status,
      0,
      `${step.name ?? "unnamed workflow step"}: ${syntax.stderr}`,
    );
  }
});

test("SQL wrapper applies exactly four migrations and containment in one transaction", () => {
  const includes = release.match(/^\\ir .*$/gmu) ?? [];
  assert.deepEqual(includes, [
    "\\ir ../supabase/migrations/20260808170000_family_hard_delete_protocol.sql",
    "\\ir ../supabase/migrations/20260808171500_account_deletion_avatar_cleanup.sql",
    "\\ir ../supabase/migrations/20260808183000_folded_family_artifact_prefixes.sql",
    "\\ir ../supabase/migrations/20260808184500_apple_purchase_interlock.sql",
    "\\ir ../supabase/migrations/20260809030000_pause_legacy_account_deletion.sql",
  ]);
  assert.ok(release.indexOf("begin;") < release.indexOf(includes[0]));
  assert.ok(release.indexOf(includes[4]) < release.lastIndexOf("commit;"));
  assert.match(release, /pg_advisory_xact_lock/u);
  assert.match(release, /set local lock_timeout = '5s'/u);
  assert.match(release, /lock table supabase_migrations\.schema_migrations/u);
  assert.match(release, /all four reviewed ledger rows must be absent or present/u);
  assert.match(release, /zero non-complete account deletion jobs/u);
  assert.match(release, /zero active App Store billing records/u);
  assert.match(release, /pause_legacy_account_deletion/u);
  assert.match(release, /family_hard_delete_protocol/u);
  assert.match(release, /account_deletion_avatar_cleanup/u);
  assert.match(release, /folded_family_artifact_prefixes/u);
  assert.match(release, /apple_purchase_interlock/u);
  assert.match(release, /source_sha256=/u);
});

test("SQL wrapper verifies catalog reality and rollback-only behavior", () => {
  assert.match(release, /prosecdef/u);
  assert.match(release, /search_path=""/u);
  assert.match(release, /has_function_privilege/u);
  assert.match(release, /relrowsecurity/u);
  assert.match(release, /aclexplode/u);
  assert.match(release, /pg_constraint/u);
  assert.match(release, /confdeltype = 'r'/u);
  assert.match(release, /assert_issue_878_check_fragment/u);
  assert.match(release, /pg_get_indexdef/u);
  assert.match(release, /pg_policy/u);
  assert.match(release, /tgfoid/u);
  assert.match(release, /tgenabled <> 'O'/u);
  assert.match(release, /tgnargs <> 0/u);
  assert.match(release, /tgqual is not null/u);
  assert.match(release, /savepoint issue_878_schema_behavior_probes/u);
  assert.match(release, /rollback to savepoint issue_878_schema_behavior_probes/u);
  assert.match(release, /primary account deletion protocol probe failed/u);
  assert.match(release, /family fold artifact-prefix protocol probe failed/u);
  assert.match(release, /folded artifact tombstone expansion probe failed/u);
  assert.match(release, /active App Store interlock did not block deletion/u);
  assert.match(release, /schema release left behavior-probe residue/u);
});

test("disposable harness starts at the production boundary and exercises drift", () => {
  assert.match(
    evalSandbox,
    /--stop-before-migration must name one exact Supabase migration file/u,
  );
  assert.match(evalSandbox, /migrations\.slice\(0, stopIndex\)/u);
  assert.match(
    harness,
    /issue-878-account-deletion-containment\.sql/u,
  );
  assert.match(harness, /injected schema ledger failure/u);
  assert.match(harness, /assertAllTargetArtifactsAbsent/u);
  assert.match(harness, /candidateBackfill/u);
  assert.match(harness, /ledgerTamper/u);
  assert.match(harness, /ownerDrift/u);
  assert.match(harness, /searchPathDrift/u);
  assert.match(harness, /aclDrift/u);
  assert.match(harness, /policyDrift/u);
  assert.match(harness, /indexDrift/u);
  assert.match(harness, /disabledTrigger/u);
  assert.match(harness, /conditionalTrigger/u);
  assert.match(harness, /reboundTrigger/u);
  assert.match(harness, /constraintDrift/u);
  assert.match(harness, /foreignKeyDrift/u);
});

test("clients use the authenticated deletion protocol while the legacy direct RPC stays paused", () => {
  const route = readFileSync(
    resolve(repositoryRoot, "apps/web/app/api/account-deletion/route.ts"),
    "utf8",
  );
  const webSurface = readFileSync(
    resolve(
      repositoryRoot,
      "apps/web/app/app/settings/delete-family-data-card.tsx",
    ),
    "utf8",
  );
  const mobileSurface = readFileSync(
    resolve(repositoryRoot, "apps/mobile/src/app/settings/delete-account.tsx"),
    "utf8",
  );
  const schedule = readFileSync(
    resolve(repositoryRoot, "apps/web/agent/schedules/account-deletions.ts"),
    "utf8",
  );
  const guardedMigration = migrations[1].toString("utf8");

  assert.doesNotMatch(route, /status: 503/u);
  assert.match(route, /createAccountDeletionPost/u);
  assert.match(route, /requireFamilyWithActorFromRequest/u);
  assert.match(route, /requestAccountDeletion/u);
  assert.match(route, /mapDb\(\)/u);
  assert.match(schedule, /retryPendingAccountDeletions/u);
  for (const surface of [webSurface, mobileSurface]) {
    assert.doesNotMatch(surface, /Account deletion is paused/u);
    assert.match(surface, /permanently deletes/u);
    assert.match(surface, /confirms billing/u);
  }
  assert.match(guardedMigration, /account deletion is temporarily unavailable/u);
  assert.match(
    guardedMigration,
    /from public, anon, authenticated, service_role/u,
  );
});
