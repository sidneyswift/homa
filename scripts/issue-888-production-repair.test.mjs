import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  ISSUE_888_RELEASE_SENSITIVE_PATHS,
  validateIssue888ReleaseGitContract,
} from "./issue-888-production-release-git-contract.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/issue-888-production-repair.yml"
);
const repairPath = resolve(
  repositoryRoot,
  "scripts/issue-888-production-repair.sql"
);
const harnessPath = resolve(
  repositoryRoot,
  "scripts/issue-888-production-repair-postgres.mjs"
);
const originalPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260801201500_month_plan_approvals.sql"
);
const boundaryPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql"
);
const releaseContractPath = resolve(
  repositoryRoot,
  "scripts/issue-888-production-release-git-contract.mjs"
);
const monthPlanDraftPath = resolve(
  repositoryRoot,
  "apps/web/lib/month-plan-draft.ts"
);
const captureLoopPath = resolve(
  repositoryRoot,
  "apps/web/lib/capture-loop-events.ts"
);

const workflow = readFileSync(workflowPath, "utf8");
const repair = readFileSync(repairPath, "utf8");
const harness = readFileSync(harnessPath, "utf8");
const original = readFileSync(originalPath);
const boundary = readFileSync(boundaryPath);
const releaseContract = readFileSync(releaseContractPath);
const monthPlanDraft = readFileSync(monthPlanDraftPath, "utf8");
const captureLoop = readFileSync(captureLoopPath, "utf8");
const workflowDocument = parse(workflow);

// Handoff to #876, which lives on another branch. Refresh this exact source
// hash and required-step list in REQUIRED_REPAIR_WORKFLOWS after #888 lands.
// PR #890 tracks #888 but must not close it until the production repair and
// deployed approval, repeat, receipt, isolation, and deletion journeys pass.
const ISSUE_888_CLEANUP_CONSUMER_HANDOFF = Object.freeze({
  workflowSourceSha256:
    "8de4f1ac311ee9e96036cf70f10d2c30c513a2faa88732fcbaf546295b0af185",
  requiredSteps: Object.freeze([
    "Validate authorization and immutable inputs",
    "Confirm PostgreSQL client availability",
    "Prove the reviewed commit is still the main head",
    "Build a masked production database URL",
    "Create an owner-only sanitized evidence log",
    "Prove the production target is an allowed starting state",
    "Apply or recover the exact repair",
    "Prove a fresh connection is a verified no-op",
    "Re-prove main and reviewed inputs after the no-op",
    "Emit sanitized immutable evidence hashes",
  ]),
  requiredDatabaseChecks: Object.freeze([
    "pg_inherits parent and child rejection",
    "partition child rejection",
    "clustered index rejection",
    "replica identity index rejection",
  ]),
});

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

function syntheticReleaseRepository(alteredPath = null) {
  const repository = mkdtempSync(
    join(tmpdir(), "homa-issue-888-git-contract-")
  );
  git(repository, ["init", "--quiet", "--initial-branch=main"]);
  git(repository, ["config", "user.name", "Issue 888 test"]);
  git(repository, ["config", "user.email", "issue-888@invalid.example"]);

  for (const path of ISSUE_888_RELEASE_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `base:${path}`);
  }
  writeRepositoryFile(repository, "unrelated.txt", "base");
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "base"]);
  const baseSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "-b", "reviewed"]);
  for (const path of ISSUE_888_RELEASE_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `reviewed:${path}`);
  }
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "reviewed"]);
  const reviewedSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "main"]);
  assert.equal(git(repository, ["rev-parse", "HEAD"]), baseSha);
  writeRepositoryFile(
    repository,
    "unrelated.txt",
    "main changed independently"
  );
  git(repository, ["add", "unrelated.txt"]);
  git(repository, ["commit", "--quiet", "-m", "main"]);
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

test("reviewed migrations stay byte-exact and executable", () => {
  assert.equal(original.byteLength, 1363);
  assert.equal(
    sha256(original),
    "82e13e2cb85667f8ec9e5d8f561fcc63332e34c90b19b168f2aad462065e8d66"
  );
  assert.equal(boundary.byteLength, 421);
  assert.equal(
    sha256(boundary),
    "9fabf67838a95a6cf6df569d275d0314c8304523ca9a494334da2a80bcab5a12"
  );
  assert.match(
    boundary.toString("utf8"),
    /revoke all privileges[\s\S]*authenticated;[\s\S]*grant select[\s\S]*grant all privileges[\s\S]*service_role;/u
  );
});

test("release Git contract accepts an exact reviewed merge with unrelated main changes", () => {
  assert.deepEqual(ISSUE_888_RELEASE_SENSITIVE_PATHS, [
    ".github/workflows/issue-888-production-repair.yml",
    "scripts/issue-888-production-release-git-contract.mjs",
    "scripts/issue-888-production-repair.sql",
    "scripts/migration-version-check.mjs",
    "supabase/migrations/20260801201500_month_plan_approvals.sql",
    "supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql",
  ]);
  const fixture = syntheticReleaseRepository();
  try {
    const result = validateIssue888ReleaseGitContract({
      repositoryRoot: fixture.repository,
      finalSha: fixture.finalSha,
      reviewedSha: fixture.reviewedSha,
    });
    assert.match(result.sensitiveManifestSha256, /^[0-9a-f]{64}$/u);
    assert.notEqual(result.finalTreeSha, result.reviewedTreeSha);
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }
});

test("release Git contract rejects a correct second parent with any altered sensitive input", () => {
  for (const alteredPath of ISSUE_888_RELEASE_SENSITIVE_PATHS) {
    const fixture = syntheticReleaseRepository(alteredPath);
    try {
      const parents = git(fixture.repository, [
        "show",
        "-s",
        "--format=%P",
        fixture.finalSha,
      ]).split(/\s+/u);
      assert.equal(parents[1], fixture.reviewedSha);
      assert.throws(
        () =>
          validateIssue888ReleaseGitContract({
            repositoryRoot: fixture.repository,
            finalSha: fixture.finalSha,
            reviewedSha: fixture.reviewedSha,
          }),
        (error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /differs between the reviewed head/u);
          assert.ok(error.message.includes(alteredPath));
          return true;
        }
      );
    } finally {
      rmSync(fixture.repository, { recursive: true, force: true });
    }
  }
});

test("workflow is owner-only, production-pinned, and hashes inputs before connecting", () => {
  const apply = workflowDocument.jobs.apply;
  assert.equal(
    apply.if,
    "github.repository == 'sidneyswift/homa' && github.repository_owner == 'sidneyswift' && github.ref == 'refs/heads/main' && github.ref_name == 'main' && github.event.repository.default_branch == 'main' && github.actor == 'sidneyswift' && github.triggering_actor == 'sidneyswift'"
  );
  assert.equal(apply.environment, "production");
  assert.equal(apply["timeout-minutes"], 10);
  assert.equal(workflowDocument.permissions.actions, "read");
  assert.equal(workflowDocument.permissions.contents, "read");
  assert.equal(
    workflowDocument.concurrency.group,
    "production-issue-888-repair-v2"
  );
  assert.equal(
    workflowDocument.on.workflow_dispatch.inputs.reviewed_repair_sha.required,
    true
  );
  assert.equal(
    workflowDocument.on.workflow_dispatch.inputs.production_deployed_sha
      .required,
    true
  );
  assert.equal(
    apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
  );
  assert.equal(apply.steps[0].with.ref, "${{ github.sha }}");
  assert.equal(apply.steps[0].with["fetch-depth"], 0);
  assert.match(workflow, /confirmation[\s\S]*APPLY ISSUE 888/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT[\s\S]*positive integer/u);
  assert.match(
    workflow,
    /actions\/runs\/\$GITHUB_RUN_ID\/attempts\/\$previous_attempt/u
  );
  assert.match(workflow, /cancelled\|failure\|timed_out/u);
  assert.match(
    workflow,
    /Only an unsuccessful prior attempt may enter recovery/u
  );
  assert.match(workflow, /previous_attempt_conclusion=%s/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT" = "1/u);
  assert.match(workflow, /Attempt 1 requires the reviewed absent/u);
  assert.match(workflow, /recovery attempt requires the reviewed complete/u);
  assert.match(workflow, /repaired-and-verified-noop/u);
  assert.match(workflow, /verified-existing-and-noop/u);
  assert.match(workflow, /REVIEWED_REPAIR_SHA.*reviewed_repair_sha/u);
  assert.match(workflow, /PRODUCTION_DEPLOYED_SHA.*production_deployed_sha/u);
  assert.match(workflow, /PRODUCTION_DEPLOYED_SHA.*GITHUB_SHA/u);
  assert.match(
    workflow,
    /issue-888-production-release-git-contract\.mjs[\s\S]*--final-sha="\$GITHUB_SHA"[\s\S]*--reviewed-sha="\$REVIEWED_REPAIR_SHA"/u
  );
  assert.match(workflow, new RegExp(sha256(releaseContract), "u"));
  assert.match(workflow, /GITHUB_REPOSITORY.*sidneyswift\/homa/u);
  assert.match(workflow, /GITHUB_REPOSITORY_OWNER.*sidneyswift/u);
  assert.match(workflow, /GITHUB_REF_NAME.*main/u);
  assert.match(workflow, /repository\.default_branch.*main/u);
  assert.match(workflow, /git rev-parse HEAD/u);
  assert.match(workflow, /git ls-remote --exit-code origin refs\/heads\/main/u);
  assert.match(workflow, /fetched_main_sha.*GITHUB_SHA/u);
  assert.match(workflow, /remote_main_sha.*GITHUB_SHA/u);
  assert.match(workflow, /Re-prove main and reviewed inputs after the no-op/u);
  assert.ok(
    workflow.indexOf("Re-prove main and reviewed inputs after the no-op") <
      workflow.indexOf("Emit sanitized immutable evidence hashes")
  );
  assert.match(workflow, /kzplntcdtsvdowntvlza/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.doesNotMatch(workflow, /actions\/checkout@v\d/u);
  assert.match(workflow, new RegExp(sha256(original), "u"));
  assert.match(workflow, new RegExp(sha256(boundary), "u"));
  assert.match(workflow, new RegExp(sha256(repair), "u"));
  assert.ok(
    workflow.indexOf("expected_repair=") <
      workflow.indexOf("Build a masked production database URL")
  );
  assert.equal(
    workflow.match(/-f scripts\/issue-888-production-repair\.sql/g)?.length,
    2
  );
  const firstConnection = apply.steps.find(
    (step) => step.name === "Apply or recover the exact repair"
  )?.run;
  assert.match(firstConnection, /ISSUE_888_EXPECTED_FIRST_MARKER/u);
  assert.match(firstConnection, /repair_markers/u);
  const secondConnection = apply.steps.find(
    (step) => step.name === "Prove a fresh connection is a verified no-op"
  )?.run;
  assert.match(secondConnection, /ISSUE_888_REPAIR=verified_noop/u);
  assert.match(secondConnection, /repair_markers/u);
  assert.match(workflow, /fresh connection is a verified no-op/u);
  assert.match(workflow, /ISSUE_888_SANITIZED_LOG_SHA256=/u);
  assert.match(workflow, /ISSUE_888_RECEIPT_SHA256=/u);
  assert.match(workflow, /contract=homa-issue-888-production-repair-v1/u);
  assert.match(workflow, /workflow_sha256=/u);
  assert.match(workflow, /run_attempt=%s/u);
  assert.match(workflow, /evidence_kind=%s/u);
  assert.match(workflow, /reviewed_repair_sha=%s/u);
  assert.match(workflow, /production_deployed_sha=%s/u);
  assert.match(workflow, /remote_main_sha=%s/u);
  assert.match(workflow, /sensitive_manifest_sha256=%s/u);
  assert.match(workflow, /sanitized_log_sha256=%s/u);
  assert.doesNotMatch(workflow, /echo "\$result"/u);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);
});

test("cleanup consumer handoff pins the final workflow and adversarial database checks", () => {
  assert.equal(
    sha256(workflow),
    ISSUE_888_CLEANUP_CONSUMER_HANDOFF.workflowSourceSha256
  );
  const stepNames = workflowDocument.jobs.apply.steps.map((step) => step.name);
  for (const requiredStep of ISSUE_888_CLEANUP_CONSUMER_HANDOFF.requiredSteps) {
    assert.equal(
      stepNames.filter((stepName) => stepName === requiredStep).length,
      1,
      `cleanup consumer step is not exact: ${requiredStep}`
    );
  }
  for (const requiredCheck of [
    /must have no pg_inherits parent or child relationship/u,
    /table_contract\.relispartition/u,
    /primary_index_contract\.indisclustered/u,
    /family_index_contract\.indisclustered/u,
    /primary_index_contract\.indisreplident/u,
    /family_index_contract\.indisreplident/u,
  ]) {
    assert.match(repair, requiredCheck);
  }
  assert.equal(
    ISSUE_888_CLEANUP_CONSUMER_HANDOFF.requiredDatabaseChecks.length,
    4
  );
});

test("workflow state matrix separates first repair from cancellation recovery", () => {
  const startingStateStep = workflowDocument.jobs.apply.steps.find(
    (step) =>
      step.name === "Prove the production target is an allowed starting state"
  )?.run;
  assert.ok(startingStateStep);
  const recoveryBoundary = startingStateStep.indexOf("else");
  assert.ok(recoveryBoundary > 0);
  const firstAttempt = startingStateStep.slice(0, recoveryBoundary);
  const recoveryAttempt = startingStateStep.slice(recoveryBoundary);
  assert.match(firstAttempt, /true\|true\|true\|true\|true\|true\|true/u);
  assert.match(firstAttempt, /ISSUE_888_REPAIR=repaired/u);
  assert.match(firstAttempt, /repaired-and-verified-noop/u);
  assert.doesNotMatch(firstAttempt, /verified-existing-and-noop/u);
  assert.match(
    recoveryAttempt,
    /false\|false\|false\|false\|false\|true\|true/u
  );
  assert.match(recoveryAttempt, /ISSUE_888_REPAIR=verified_noop/u);
  assert.match(recoveryAttempt, /verified-existing-and-noop/u);
  assert.doesNotMatch(recoveryAttempt, /ISSUE_888_REPAIR=repaired/u);
  assert.match(firstAttempt, /exit 1/u);
  assert.match(recoveryAttempt, /exit 1/u);
});

test("repair applies only the reviewed pair inside one bounded transaction", () => {
  const includes = repair.match(/^\\ir .*$/gmu) ?? [];
  assert.deepEqual(includes, [
    "\\ir ../supabase/migrations/20260801201500_month_plan_approvals.sql",
    "\\ir ../supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf(includes[0]));
  assert.ok(repair.indexOf(includes[1]) < repair.lastIndexOf("commit;"));
  const advisoryLock = repair.indexOf("pg_advisory_xact_lock");
  const migrationLedgerLock = repair.indexOf(
    "lock table supabase_migrations.schema_migrations"
  );
  const familiesLock = repair.indexOf(
    "lock table public.families in share row exclusive mode"
  );
  const existingReceiptLock = repair.indexOf(
    "lock table public.month_plan_approvals in share row exclusive mode"
  );
  const firstStateRead = repair.indexOf("insert into issue_888_repair_state");
  assert.ok(advisoryLock > repair.indexOf("begin;"));
  assert.ok(advisoryLock < migrationLedgerLock);
  assert.ok(migrationLedgerLock < familiesLock);
  assert.ok(familiesLock < existingReceiptLock);
  assert.ok(existingReceiptLock < firstStateRead);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(
    repair,
    /set local idle_in_transaction_session_timeout = '150s'/u
  );
  assert.match(repair, /both reviewed versions must be absent or present/u);
  assert.match(
    repair,
    /absent ledger rows require all reviewed relation names to be absent/u
  );
  assert.match(repair, /ISSUE_888_REPAIR=[\s\S]*verified_noop/u);
});

test("ledger arrays retain all executable statements and source hashes", () => {
  assert.equal(repair.match(/\$original_[1-6]\$/gu)?.length, 12);
  assert.equal(repair.match(/\$boundary_[1-3]\$/gu)?.length, 6);
  assert.match(repair, /source_sha256=82e13e2c/u);
  assert.match(repair, /source_sha256=9fabf678/u);
  assert.match(
    repair,
    /issue_888_original_statements\(\)[\s\S]*create table if not exists[\s\S]*create policy[\s\S]*revoke insert/u
  );
  assert.match(
    repair,
    /issue_888_boundary_statements\(\)[\s\S]*revoke all privileges[\s\S]*grant select[\s\S]*grant all privileges/u
  );
  assert.match(harness, /string_agg\([\s\S]*array_to_string\(statements/u);
  assert.match(harness, /runPsql\(\["-c", fetchedMigration\]\)/u);
});

test("repair verifies the complete schema, policy, index, and dynamic ACL contract", () => {
  assert.match(repair, /columns differ from the reviewed six-column contract/u);
  assert.match(repair, /table_contract\.relispartition/u);
  assert.match(repair, /pg_catalog\.pg_inherits inheritance/u);
  assert.match(repair, /inheritance\.inhrelid = table_oid/u);
  assert.match(repair, /inheritance\.inhparent = table_oid/u);
  assert.match(
    repair,
    /must have no pg_inherits parent or child relationship/u
  );
  assert.match(repair, /exactly five reviewed constraints/u);
  assert.match(repair, /confdeltype = 'c'/u);
  assert.match(repair, /exactly two reviewed indexes/u);
  assert.match(repair, /indkey::text <> '2 3'/u);
  assert.match(repair, /indoption::text <> '0 3'/u);
  assert.match(repair, /operator_classes/u);
  assert.equal(repair.match(/indimmediate/g)?.length, 2);
  assert.equal(repair.match(/indnullsnotdistinct/g)?.length, 2);
  assert.equal(repair.match(/indisclustered/g)?.length, 2);
  assert.equal(repair.match(/indisreplident/g)?.length, 2);
  assert.match(repair, /exactly one reviewed policy/u);
  assert.match(repair, /is_family_member\(family_id\)/u);
  assert.match(repair, /pg_catalog\.acldefault\('r'/u);
  assert.match(repair, /expected_all_privilege_count/u);
  assert.match(repair, /privilege_type <> 'SELECT'/u);
  assert.match(repair, /privilege\.grantor <> expected_owner_oid/u);
  assert.match(repair, /privilege\.is_grantable/u);
  assert.match(repair, /attribute\.attacl is not null/u);
  assert.match(repair, /attribute\.attisdropped/u);
  assert.match(repair, /service_role_oid/u);
  assert.match(repair, /authenticated truncate was not denied/u);
});

test("database contract matches the production approval and receipt readers", () => {
  assert.match(
    monthPlanDraft,
    /select draft_id from public\.month_plan_approvals[\s\S]*where draft_id = \$\{payload\.draftId\} and family_id = \$\{input\.familyId\}/u
  );
  assert.match(
    monthPlanDraft,
    /insert into public\.month_plan_approvals[\s\S]*\(draft_id, family_id, month_start, final_revision, revision_history\)[\s\S]*payload\.draftId[\s\S]*input\.familyId[\s\S]*snapshot\.plan\.monthStart[\s\S]*snapshot\.revision[\s\S]*payload\.history/u
  );
  assert.match(
    captureLoop,
    /from public\.month_plan_approvals receipt[\s\S]*receipt\.draft_id = \$\{props\.receipt_id\}[\s\S]*receipt\.family_id = \$\{familyId\}[\s\S]*receipt\.final_revision = \$\{props\.revision\}/u
  );
});

test("disposable harness covers behavior, tampering, collisions, and rollback", () => {
  assert.match(harness, /reproduce Supabase default table grants/u);
  assert.match(harness, /ISSUE_888_REPAIR=repaired/u);
  assert.match(harness, /ISSUE_888_REPAIR=verified_noop/u);
  assert.match(harness, /family RLS did not isolate receipts/u);
  assert.match(
    harness,
    /\["truncate", "truncate table public\.month_plan_approvals"\]/u
  );
  assert.match(harness, /service_role/u);
  assert.match(harness, /invalidCases/u);
  assert.match(harness, /family deletion did not cascade/u);
  assert.match(harness, /transactionalTamperCases/u);
  assert.match(harness, /tableCollision/u);
  assert.match(harness, /indexCollision/u);
  assert.match(harness, /primaryIndexCollision/u);
  assert.match(harness, /ACL grant option/u);
  assert.match(harness, /ACL grantor/u);
  assert.match(harness, /column ACL/u);
  assert.match(harness, /dropped column/u);
  assert.match(harness, /clustered index/u);
  assert.match(harness, /replica identity index/u);
  assert.match(harness, /issue_888_partition_parent/u);
  assert.match(harness, /issue_888_inheritance_parent/u);
  assert.match(harness, /issue_888_inherited_receipts/u);
  assert.match(
    harness,
    /family deletion unexpectedly removed an unconstrained inherited child row/u
  );
  assert.match(harness, /migration ledger is mixed/u);
  assert.match(harness, /relation state is mixed/u);
  assert.match(harness, /injected mid-migration failure/u);
  assert.match(
    harness,
    /mid-migration failure left relation or ledger residue/u
  );
});
