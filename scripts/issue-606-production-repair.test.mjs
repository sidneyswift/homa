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
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import {
  ISSUE_606_RELEASE_SENSITIVE_PATHS,
  validateIssue606ReleaseGitContract,
} from "./issue-606-production-release-git-contract.mjs";
import {
  ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS,
  validateIssue606RuntimeDrainContract,
} from "./issue-606-runtime-drain-contract.mjs";
import { classifyIssue606ProductionRun } from "./issue-606-production-run-contract.mjs";
import { validateIssue606VercelDeployment } from "./issue-606-vercel-deployment-contract.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/issue-606-production-repair.yml"
);
const repairPath = resolve(
  repositoryRoot,
  "scripts/issue-606-production-repair.sql"
);
const vercelContractPath = resolve(
  repositoryRoot,
  "scripts/issue-606-vercel-deployment-contract.mjs"
);
const workflow = readFileSync(workflowPath, "utf8");
const repair = readFileSync(repairPath, "utf8");
const vercelContract = readFileSync(vercelContractPath, "utf8");
const workflowDocument = parse(workflow);
const hashedInputs = [
  "supabase/migrations/20260802033000_conversation_privacy_per_adult.sql",
  "supabase/migrations/20260805110000_eve_web_session_owners.sql",
  "supabase/migrations/20260807040000_conversation_privacy_attribution_containment.sql",
  "scripts/issue-606-production-repair.sql",
  "scripts/issue-606-production-release-git-contract.mjs",
  "scripts/issue-606-production-run-contract.mjs",
  "scripts/issue-606-runtime-drain-contract.mjs",
  "scripts/issue-606-vercel-deployment-contract.mjs",
];

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
    join(tmpdir(), "homa-issue-606-git-contract-")
  );
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.name", "Issue 606 test"]);
  git(repository, ["config", "user.email", "issue-606@invalid.example"]);

  for (const path of ISSUE_606_RELEASE_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `base:${path}`);
  }
  writeRepositoryFile(repository, "unrelated.txt", "base");
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "base"]);
  const baseSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "-b", "reviewed"]);
  for (const path of ISSUE_606_RELEASE_SENSITIVE_PATHS) {
    writeRepositoryFile(repository, path, `reviewed:${path}`);
  }
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", "reviewed"]);
  const reviewedSha = git(repository, ["rev-parse", "HEAD"]);

  git(repository, ["checkout", "--quiet", "-b", "production", baseSha]);
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

function readyDeployment() {
  const sha = "a".repeat(40);
  return {
    sha,
    id: "dpl_Issue606ReadyFixture",
    project: { id: "prj_pKBD87W4tmlT7lnYRgrs8WYociTz" },
    readyState: "READY",
    readySubstate: "PROMOTED",
    target: "production",
    aliasAssigned: true,
    alias: ["thankshoma.com"],
    gitSource: {
      type: "github",
      sha,
      ref: "main",
      org: "sidneyswift",
      repo: "homa",
    },
    meta: { githubCommitSha: sha },
  };
}

test("reviewed already-applied migrations remain byte-exact", () => {
  assert.equal(
    sha256(readFileSync(resolve(repositoryRoot, hashedInputs[0]))),
    "df3dfe2bb04fea51cf4751cfea927f600612ee0459a60bcab2f6496ca2a495fd"
  );
  assert.equal(
    sha256(readFileSync(resolve(repositoryRoot, hashedInputs[1]))),
    "0b379d6bfc406ae4b1dac3aafe5c857d7131fd02dc6d3453deb867b7704256d3"
  );
});

test("release Git contract accepts only byte-exact reviewed sensitive paths", () => {
  const fixture = syntheticReleaseRepository();
  try {
    const result = validateIssue606ReleaseGitContract({
      repositoryRoot: fixture.repository,
      finalSha: fixture.finalSha,
      reviewedSha: fixture.reviewedSha,
    });
    assert.match(result.sensitiveManifestSha256, /^[0-9a-f]{64}$/u);
    assert.notEqual(result.finalTreeSha, result.reviewedTreeSha);
  } finally {
    rmSync(fixture.repository, { recursive: true, force: true });
  }

  for (const alteredPath of ISSUE_606_RELEASE_SENSITIVE_PATHS) {
    const altered = syntheticReleaseRepository(alteredPath);
    try {
      assert.throws(
        () =>
          validateIssue606ReleaseGitContract({
            repositoryRoot: altered.repository,
            finalSha: altered.finalSha,
            reviewedSha: altered.reviewedSha,
          }),
        (error) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes(alteredPath));
          return true;
        }
      );
    } finally {
      rmSync(altered.repository, { recursive: true, force: true });
    }
  }
});

test("runtime drain is longer than the repository's maximum old request", () => {
  const result = validateIssue606RuntimeDrainContract(repositoryRoot);
  assert.equal(ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS, 1020);
  assert.equal(result.drainSeconds, 1020);
  assert.match(result.contractSha256, /^[0-9a-f]{64}$/u);
});

test("recovery is bound to the original run that could have repaired", () => {
  assert.equal(
    classifyIssue606ProductionRun({
      runAttempt: "1",
      state: "false|false|false|false|false|false",
    }).firstConnectionMode,
    "repair-required"
  );
  assert.equal(
    classifyIssue606ProductionRun({
      runAttempt: "2",
      state: "true|true|true|true|true|true",
    }).firstConnectionMode,
    "recovery"
  );
  assert.throws(() =>
    classifyIssue606ProductionRun({
      runAttempt: "1",
      state: "true|true|true|true|true|false",
    })
  );
  assert.throws(
    () =>
      classifyIssue606ProductionRun({
        runAttempt: "2",
        state: "true|true|true|true|true|false",
      }),
    /bound to this exact GitHub run/u
  );
});

test("Vercel contract accepts only the exact promoted Homa main deployment", () => {
  const fixture = readyDeployment();
  const accepted = validateIssue606VercelDeployment({
    deployment: fixture,
    deploymentId: fixture.id,
    finalSha: fixture.sha,
  });
  assert.match(accepted.contractSha256, /^[0-9a-f]{64}$/u);
  for (const mutation of [
    { readyState: "BUILDING" },
    { readySubstate: "ROLLING" },
    { target: "staging" },
    { alias: ["preview.example"] },
    { gitSource: { ...fixture.gitSource, sha: "b".repeat(40) } },
  ]) {
    assert.throws(() =>
      validateIssue606VercelDeployment({
        deployment: { ...fixture, ...mutation },
        deploymentId: fixture.id,
        finalSha: fixture.sha,
      })
    );
  }
});

test("workflow is founder-only and bound to reviewed Git and Vercel production", () => {
  const apply = workflowDocument.jobs.apply;
  assert.equal(apply.environment, "production");
  assert.equal(apply["timeout-minutes"], 40);
  assert.equal(
    apply.steps[0].uses,
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262"
  );
  assert.equal(apply.steps[0].with["fetch-depth"], 0);
  assert.equal(
    workflowDocument.on.workflow_dispatch.inputs.reviewed_repair_sha.required,
    true
  );
  assert.equal(
    workflowDocument.on.workflow_dispatch.inputs.production_deployment_id
      .required,
    true
  );
  assert.match(workflow, /github\.repository == 'sidneyswift\/homa'/u);
  assert.match(workflow, /github\.actor == 'sidneyswift'/u);
  assert.match(workflow, /github\.triggering_actor == 'sidneyswift'/u);
  assert.match(workflow, /GITHUB_RUN_ATTEMPT[\s\S]*positive integer/u);
  assert.match(workflow, /GITHUB_RUN_ID[\s\S]*positive integer/u);
  assert.match(workflow, /production_deployed_sha/u);
  assert.match(workflow, /production_deployment_id/u);
  assert.match(workflow, /withGitRepoInfo=true/u);
  assert.match(vercelContract, /thankshoma\.com/u);
  assert.match(workflow, /issue-606-production-release-git-contract\.mjs/u);
  assert.match(workflow, /--reviewed-sha="\$REVIEWED_REPAIR_SHA"/u);
  assert.match(workflow, /git ls-remote --exit-code origin refs\/heads\/main/u);
  assert.match(workflow, /confirmation[\s\S]*APPLY ISSUE 606/u);
  assert.match(workflow, /kzplntcdtsvdowntvlza/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.doesNotMatch(workflow, /actions\/checkout@v\d/u);
  assert.doesNotMatch(workflow, /supabase\s+db\s+push/u);

  for (const input of hashedInputs) {
    assert.match(
      workflow,
      new RegExp(sha256(readFileSync(resolve(repositoryRoot, input))), "u")
    );
  }
});

test("workflow is cancellation-recoverable and closes the old-instance race", () => {
  assert.match(workflow, /issue-606-production-run-contract\.mjs/u);
  assert.match(workflow, /workflow_run_id=[\s\S]*GITHUB_RUN_ID/u);
  assert.equal(
    workflow.match(/-v issue_606_run_id="\$GITHUB_RUN_ID"/g)?.length,
    3
  );
  assert.match(
    workflow,
    /sed -n 's\/\^ISSUE_606_FIRST_CONNECTION_MODE=\/\/p'/u
  );
  assert.match(
    workflow,
    /\$ISSUE_606_FIRST_CONNECTION_MODE" = "repair-required"/u
  );
  assert.match(workflow, /ISSUE_606_REPAIR=repaired/u);
  assert.match(workflow, /ISSUE_606_REPAIR=verified_noop/u);
  assert.match(workflow, /sleep "\$ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS"/u);
  assert.match(workflow, /ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS.*1020/u);
  assert.ok(
    workflow.indexOf("Wait beyond every old production request") <
      workflow.indexOf("Run the final cleanup after the old-instance drain")
  );
  assert.ok(
    workflow.indexOf("Run the final cleanup after the old-instance drain") <
      workflow.indexOf("Prove a fresh connection is a verified no-op")
  );
  assert.equal(
    workflow.match(/-f scripts\/issue-606-production-repair\.sql/g)?.length,
    3
  );
  assert.doesNotMatch(workflow, /echo "\$result"/u);
});

test("workflow logs only counts and false safety booleans", () => {
  assert.match(workflow, /ISSUE_606_ASSISTANTS_CLEARED/u);
  assert.match(workflow, /ISSUE_606_EPISODES_CLEARED/u);
  assert.match(workflow, /ISSUE_606_CALLS_CLEARED/u);
  assert.match(workflow, /ISSUE_606_UNSAFE_ASSISTANTS=false/u);
  assert.match(workflow, /ISSUE_606_UNSAFE_EPISODES=false/u);
  assert.match(workflow, /ISSUE_606_OWNED_CALLS=false/u);
  assert.match(workflow, /ISSUE_606_SANITIZED_LOG_SHA256/u);
  assert.match(workflow, /ISSUE_606_RECEIPT_SHA256/u);
  assert.doesNotMatch(workflow, /echo "\$result"/u);
});

test("repair is one bounded, locked transaction over the exact correction", () => {
  const includes = repair.match(/^\\ir .*$/gmu) ?? [];
  assert.deepEqual(includes, [
    "\\ir ../supabase/migrations/20260807040000_conversation_privacy_attribution_containment.sql",
  ]);
  assert.ok(repair.indexOf("begin;") < repair.indexOf(includes[0]));
  assert.ok(repair.indexOf(includes[0]) < repair.lastIndexOf("commit;"));
  assert.match(repair, /pg_advisory_xact_lock/u);
  assert.match(repair, /set local lock_timeout = '5s'/u);
  assert.match(repair, /set local statement_timeout = '120s'/u);
  assert.match(
    repair,
    /lock table public\.conversation_messages in access exclusive mode/u
  );
  assert.match(
    repair,
    /lock table public\.conversation_episodes in access exclusive mode/u
  );
  assert.match(
    repair,
    /lock table public\.call_transcripts in access exclusive mode/u
  );
});

test("repair proves exact ownership, grants, cleanup, and ledger evidence", () => {
  assert.match(
    repair,
    /bool_and\(member_user_id is not null and known_family_member\)/u
  );
  assert.match(repair, /count\(distinct member_user_id\) = 1/u);
  assert.match(repair, /proowner <> expected_owner_oid/u);
  assert.match(repair, /prosecdef/u);
  assert.match(repair, /aclexplode/u);
  assert.match(repair, /conversation_session_owned_by_caller/u);
  assert.match(repair, /conversation_episode_owned_by_caller/u);
  assert.match(repair, /workflow_run_id=%s/u);
  assert.match(repair, /conversation_deliveries'\) = 0/u);
  assert.match(
    repair,
    /sha256=a158765ad96a27830f7c92f80c038adfcc43b32e0971b3624f12302e579a3db9/u
  );
  assert.match(repair, /correction ledger evidence is absent or altered/u);
});
