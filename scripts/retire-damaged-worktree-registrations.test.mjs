import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { acquireRepositoryCleanupLock as acquireOrdinaryCleanupLock } from "./remove-worktree-safely.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const guardSource = join(repositoryRoot, "scripts", "retire-damaged-worktree-registrations.mjs");
const githubOrigin = "https://github.com/sidneyswift/homa.git";
const realGit = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function checked(command, args, options = {}) {
  const result = run(command, args, options);
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  return result.stdout.trim();
}

function git(cwd, args) {
  return checked(realGit, args, { cwd });
}

function makeFakeGit(binPath) {
  mkdirSync(binPath);
  const script = join(binPath, "git");
  writeFileSync(
    script,
    `#!/usr/bin/env node
const { appendFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync, utimesSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const realGit = ${JSON.stringify(realGit)};
const args = process.argv.slice(2);
if (process.env.FAKE_GIT_LOG) appendFileSync(process.env.FAKE_GIT_LOG, JSON.stringify(args) + "\\n");
const worktreeIndex = args.indexOf("worktree");
const action = worktreeIndex === -1 ? null : args[worktreeIndex + 1];
if (action === "prune" && !args.includes("--dry-run") && process.env.FAKE_GIT_LATE_PATH) {
  mkdirSync(process.env.FAKE_GIT_LATE_PATH, { recursive: true });
  writeFileSync(join(process.env.FAKE_GIT_LATE_PATH, "arrived-late.txt"), "late bytes stay here\\n");
}
if (action === "prune" && !args.includes("--dry-run") && process.env.FAKE_GIT_NEW_STALE_PATH) {
  const added = spawnSync(realGit, ["-C", process.env.FAKE_GIT_PRIMARY, "worktree", "add", "--detach", process.env.FAKE_GIT_NEW_STALE_PATH, "HEAD"], {
    encoding: "utf8",
    env: process.env
  });
  if (added.status !== 0) {
    process.stderr.write(added.stderr ?? "could not add late stale worktree\\n");
    process.exit(added.status ?? 1);
  }
  unlinkSync(join(process.env.FAKE_GIT_NEW_STALE_PATH, ".git"));
  const worktreesRoot = join(process.env.FAKE_GIT_COMMON_DIR, "worktrees");
  for (const name of readdirSync(worktreesRoot)) {
    const adminPath = join(worktreesRoot, name);
    let link = "";
    try { link = readFileSync(join(adminPath, "gitdir"), "utf8").trim(); } catch {}
    if (link === join(process.env.FAKE_GIT_NEW_STALE_PATH, ".git")) {
      const future = new Date(Date.now() + 60_000);
      utimesSync(adminPath, future, future);
    }
  }
}
const result = spawnSync(realGit, args, { encoding: "utf8", env: process.env });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
`,
  );
  chmodSync(script, 0o755);
}

function makeFakeGithub(binPath) {
  const script = join(binPath, "gh");
  writeFileSync(
    script,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "issue" && args[1] === "view") {
  const number = Number(args[2]);
  process.stdout.write(JSON.stringify({
    number,
    state: "CLOSED",
    url: "https://github.com/sidneyswift/homa/issues/" + number
  }));
  process.exit(0);
}
process.stderr.write("Unexpected gh call: " + args.join(" ") + "\\n");
process.exit(1);
`,
  );
  chmodSync(script, 0o755);
}

function addDamagedRegistration(fixture, name, { detached = false, missingPath = false } = {}) {
  const target = join(fixture.root, name);
  const args = ["worktree", "add"];
  if (detached) args.push("--detach", target, "HEAD");
  else args.push("-b", `codex/gh-900-${name}`, target, "HEAD");
  git(fixture.primary, args);
  const sentinel = join(target, "surviving-bytes.txt");
  writeFileSync(sentinel, `bytes from ${name}\n`);
  const sentinelInode = lstatSync(sentinel).ino;
  unlinkSync(join(target, ".git"));
  let manuallyPreservedPath = null;
  if (missingPath) {
    manuallyPreservedPath = join(fixture.root, `${name}-already-preserved`);
    renameSync(target, manuallyPreservedPath);
  }
  const registration = { target, sentinelInode, manuallyPreservedPath };
  fixture.registrations.push(registration);
  return registration;
}

function administrativeDirectoryForTarget(fixture, target) {
  const expectedGitdir = join(target, ".git");
  const worktreesRoot = join(fixture.commonGitDir, "worktrees");
  for (const name of readdirSync(worktreesRoot)) {
    const adminDir = join(worktreesRoot, name);
    if (readFileSync(join(adminDir, "gitdir"), "utf8").trim() === expectedGitdir) return adminDir;
  }
  assert.fail(`No administrative record found for ${target}`);
}

function makeFixture({ registrations = [{ name: "lane" }] } = {}) {
  const root = mkdtempSync(join(homedir(), ".homa-damaged-registration-test-"));
  const primary = join(root, "primary");
  const fakeBin = join(root, "bin");
  const evidencePath = join(root, "approved-damaged-registrations.json");
  const fakeGitLog = join(root, "git-commands.jsonl");

  git(root, ["init", "-b", "main", primary]);
  git(primary, ["config", "user.name", "Homa cleanup test"]);
  git(primary, ["config", "user.email", "cleanup-test@example.test"]);
  git(primary, ["remote", "add", "origin", githubOrigin]);
  mkdirSync(join(primary, "scripts"));
  copyFileSync(guardSource, join(primary, "scripts", "retire-damaged-worktree-registrations.mjs"));
  writeFileSync(join(primary, "README.md"), "Damaged registration fixture.\n");
  git(primary, ["add", "."]);
  git(primary, ["commit", "-m", "fixture"]);

  makeFakeGit(fakeBin);
  makeFakeGithub(fakeBin);
  const commonGitDir = realpathSync(join(primary, ".git"));
  const fixture = {
    root,
    primary,
    commonGitDir,
    fakeBin,
    fakeGitLog,
    evidencePath,
    guard: join(primary, "scripts", "retire-damaged-worktree-registrations.mjs"),
    registrations: [],
    env: {
      ...process.env,
      PATH: `${fakeBin}${delimiter}${process.env.PATH}`,
      FAKE_GIT_COMMON_DIR: commonGitDir,
      FAKE_GIT_LOG: fakeGitLog,
      FAKE_GIT_PRIMARY: primary,
    },
  };
  for (const registration of registrations) {
    addDamagedRegistration(fixture, registration.name, registration);
  }
  const oldAdministrativeTime = new Date(Date.now() - 10_000);
  for (const name of readdirSync(join(commonGitDir, "worktrees"))) {
    const adminDir = join(commonGitDir, "worktrees", name);
    utimesSync(join(adminDir, "gitdir"), oldAdministrativeTime, oldAdministrativeTime);
    utimesSync(join(adminDir, "index"), oldAdministrativeTime, oldAdministrativeTime);
    utimesSync(adminDir, oldAdministrativeTime, oldAdministrativeTime);
  }
  return fixture;
}

function runGuard(fixture, args, environment = {}, input) {
  return run(process.execPath, [fixture.guard, ...args], {
    cwd: fixture.primary,
    env: { ...fixture.env, ...environment },
    input: input === undefined ? undefined : `${JSON.stringify(input)}\n`,
  });
}

function writeEvidence(fixture, evidence) {
  writeFileSync(fixture.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  chmodSync(fixture.evidencePath, 0o600);
}

function writeTaskSnapshot(fixture) {
  writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(fixture.taskSnapshot, null, 2)}\n`);
}

function tasklessArgs(confirmations) {
  return confirmations.flatMap((confirmation) => ["--legacy-taskless-confirmation", confirmation]);
}

function captureEvidence(fixture) {
  const inventory = runGuard(fixture, ["--inventory"]);
  assert.equal(inventory.status, 0, inventory.stderr);
  const evidence = JSON.parse(inventory.stdout);
  const now = new Date().toISOString();
  const tasks = [];
  for (const registration of evidence.registrations) {
    const branch = registration.branch?.replace(/^refs\/heads\//u, "") ?? null;
    if (registration.detached) {
      const recoveryReference = `refs/homa/recovery/tests/${registration.adminName}`;
      git(fixture.primary, ["update-ref", recoveryReference, registration.head]);
      registration.recovery = {
        kind: "retained-ref",
        reference: recoveryReference,
        sourceHead: registration.head,
        sourceTree: registration.tree,
      };
      registration.issue = {
        number: 900,
        state: "CLOSED",
        url: "https://github.com/sidneyswift/homa/issues/900",
        disposition: "closed",
      };
    }
    tasks.push({
      id: `completed-${registration.adminName}`,
      status: "completed",
      branch,
      worktree: registration.path,
      handoff: {
        outcome: "Fixture lane is fully preserved and ready for metadata retirement.",
        issue: `#${registration.issue.number}`,
        branch: branch ?? "",
        worktree: registration.path,
        commitOrPr: registration.head,
        checks: {
          executed: true,
          status: "passed",
          commands: ["node --test damaged-registration-fixture.test.mjs"],
          completedAt: now,
        },
        productionState: "No production effect.",
        nextStep: "cleanup-coordinator-remove-worktree",
        handoffComplete: true,
        recordedAt: now,
      },
    });
  }
  evidence.approval = {
    approvedBy: "sidneyswift",
    approvedAt: now,
    reason: "Reviewed damaged linked-worktree registrations",
    scanNonce: evidence.scan.nonce,
    scanSha256: evidence.scan.sha256,
  };
  writeEvidence(fixture, evidence);
  fixture.taskSnapshot = {
    schemaVersion: 1,
    source: "codex-list-threads",
    coverage: "all-open-and-recent-homa-tasks",
    capturedAt: now,
    repositoryOrigin: githubOrigin,
    retirementScan: evidence.scan,
    tasks,
  };
  fixture.taskSnapshotPath = join(fixture.root, "task-snapshot.json");
  writeTaskSnapshot(fixture);
  return evidence;
}

function assess(fixture, confirmations = []) {
  return runGuard(fixture, [
    "--evidence",
    fixture.evidencePath,
    "--task-snapshot",
    fixture.taskSnapshotPath,
    ...tasklessArgs(confirmations),
  ]);
}

function runAfterReady(command, args, options, snapshotFactory) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let sent = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (sent) return;
      const match = stderr.match(/READY_FOR_FINAL_CODEX_TASK_SNAPSHOT (\{[^\n]+\})\n/u);
      if (!match) return;
      sent = true;
      try {
        const ready = JSON.parse(match[1]);
        child.stdin.end(`${JSON.stringify(snapshotFactory(ready))}\n`);
      } catch (error) {
        child.kill();
        reject(error);
      }
    });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve({
        status: status ?? 1,
        signal,
        stdout,
        stderr,
        readyObserved: sent,
      });
    });
  });
}

function execute(
  fixture,
  confirmation,
  environment = {},
  { confirmations = [], input = fixture.taskSnapshot, mutateSnapshot, bindToReady = true } = {},
) {
  return runAfterReady(
    process.execPath,
    [
      fixture.guard,
      "--evidence",
      fixture.evidencePath,
      "--task-snapshot",
      "-",
      "--execute",
      "--confirmation",
      confirmation,
      ...tasklessArgs(confirmations),
    ],
    { cwd: fixture.primary, env: { ...fixture.env, ...environment } },
    (ready) => {
      const snapshot = structuredClone(input);
      if (bindToReady) {
        snapshot.capturedAt = new Date(Math.max(Date.now(), Date.parse(ready.readyAt))).toISOString();
        snapshot.executionBoundary = {
          nonce: ready.executionNonce,
          readyAt: ready.readyAt,
        };
      }
      if (mutateSnapshot) mutateSnapshot(snapshot, ready);
      return snapshot;
    },
  );
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function withFixture(t, options) {
  const fixture = makeFixture(options);
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  return fixture;
}

test("generator writes private schema-v2 evidence and a concrete review queue", (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "attached-lane" }, { name: "detached-lane", detached: true }],
  });
  const evidenceOut = join(fixture.root, "generated-evidence.json");
  const reviewQueueOut = join(fixture.root, "generated-review-queue.json");
  const result = runGuard(fixture, ["--generate", "--evidence-out", evidenceOut, "--review-queue-out", reviewQueueOut]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statSync(evidenceOut).mode & 0o777, 0o600);
  assert.equal(statSync(reviewQueueOut).mode & 0o777, 0o600);

  const evidence = JSON.parse(readFileSync(evidenceOut, "utf8"));
  const reviewQueue = JSON.parse(readFileSync(reviewQueueOut, "utf8"));
  assert.equal(evidence.schemaVersion, 2);
  assert.match(evidence.scan.nonce, /^[a-f0-9]{64}$/u);
  assert.equal(evidence.approval.scanNonce, evidence.scan.nonce);
  assert.equal(evidence.approval.scanSha256, evidence.scan.sha256);
  assert.equal(evidence.registrations.length, 2);
  for (const registration of evidence.registrations) {
    assert.equal(typeof registration.path, "string");
    assert.match(registration.head, /^[a-f0-9]{40}$/u);
    assert.match(registration.tree, /^[a-f0-9]{40}$/u);
    assert.equal(typeof registration.issue, "object");
    assert.equal(typeof registration.task, "object");
    assert.equal(typeof registration.recovery, "object");
    assert.equal(typeof registration.pathInventory.manifestSha256, "string");
  }
  assert.deepEqual(reviewQueue.scan, evidence.scan);
  assert.equal(
    reviewQueue.items.some((item) => item.kind === "issue" && item.path.endsWith("detached-lane")),
    true,
  );
  assert.equal(
    reviewQueue.items.some((item) => item.kind === "recovery" && item.path.endsWith("detached-lane")),
    true,
  );
  assert.equal(reviewQueue.items.filter((item) => item.kind === "task-ownership").length, 2);

  const collision = runGuard(fixture, ["--generate", "--evidence-out", evidenceOut, "--review-queue-out", evidenceOut]);
  assert.equal(collision.status, 2);
  assert.match(collision.stderr, /must be different/iu);
});

test("an unexpected administrative file blocks the complete retirement inventory", (t) => {
  const fixture = withFixture(t);
  const adminDir = administrativeDirectoryForTarget(fixture, fixture.registrations[0].target);
  writeFileSync(join(adminDir, "unreviewed-state"), "must not be pruned silently\n");
  const result = runGuard(fixture, ["--inventory"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unexpected path.*unreviewed-state.*extend the allowlist/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("a distinct committed staged and working version blocks damaged retirement", (t) => {
  const fixture = withFixture(t);
  const registration = fixture.registrations[0];
  const adminDir = administrativeDirectoryForTarget(fixture, registration.target);
  const threeVersionPath = join(registration.target, "three-version.txt");
  assert.notEqual(run(realGit, ["--git-dir", adminDir, "show", "HEAD:three-version.txt"]).status, 0);
  writeFileSync(threeVersionPath, "staged version\n");
  checked(realGit, [`--git-dir=${adminDir}`, `--work-tree=${registration.target}`, "add", "three-version.txt"]);
  assert.equal(checked(realGit, [`--git-dir=${adminDir}`, "show", ":three-version.txt"]), "staged version");
  writeFileSync(threeVersionPath, "working version\n");
  assert.equal(readFileSync(threeVersionPath, "utf8"), "working version\n");

  const result = runGuard(fixture, ["--inventory"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /staged index tree.*differs from committed tree.*not independently recoverable/iu);
  assert.equal(readFileSync(threeVersionPath, "utf8"), "working version\n");
  assert.equal(checked(realGit, [`--git-dir=${adminDir}`, "show", ":three-version.txt"]), "staged version");
});

test("a prebuffered damaged-lane snapshot cannot satisfy READY", (t) => {
  const fixture = withFixture(t);
  const evidence = captureEvidence(fixture);
  const result = runGuard(
    fixture,
    [
      "--evidence",
      fixture.evidencePath,
      "--task-snapshot",
      "-",
      "--execute",
      "--confirmation",
      `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`,
    ],
    {},
    fixture.taskSnapshot,
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /READY_FOR_FINAL_CODEX_TASK_SNAPSHOT/u);
  assert.match(result.stderr, /executionBoundary|predates READY/iu);
  const backupRoots = readdirSync(fixture.root).filter((name) =>
    name.startsWith(".homa-damaged-registration-backups-"),
  );
  assert.equal(backupRoots.length, 1);
  assert.equal(lstatSync(join(fixture.root, backupRoots[0])).mode & 0o777, 0o700);
  assert.match(result.stderr, new RegExp(backupRoots[0], "u"));
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("damaged-lane execution timestamps and bindings fail closed", async (t) => {
  const cases = [
    [
      "earlier than READY",
      (snapshot, ready) => {
        snapshot.capturedAt = new Date(Date.parse(ready.readyAt) - 1).toISOString();
      },
      /predates READY/iu,
    ],
    [
      "malformed",
      (snapshot) => {
        snapshot.capturedAt = "not-a-time";
      },
      /ISO timestamp/iu,
    ],
    [
      "non-normalized timezone",
      (snapshot, ready) => {
        snapshot.capturedAt = ready.readyAt.replace(/Z$/u, "+00:00");
      },
      /normalized ISO timestamp/iu,
    ],
    [
      "stale",
      (snapshot) => {
        snapshot.capturedAt = new Date(Date.now() - 31_000).toISOString();
      },
      /snapshot is stale/iu,
    ],
    [
      "future",
      (snapshot) => {
        snapshot.capturedAt = new Date(Date.now() + 31_000).toISOString();
      },
      /capturedAt is in the future/iu,
    ],
    [
      "wrong execution nonce",
      (snapshot) => {
        snapshot.executionBoundary.nonce = "f".repeat(64);
      },
      /execution boundary nonce changed/iu,
    ],
    [
      "wrong scan nonce",
      (snapshot) => {
        snapshot.retirementScan.nonce = "f".repeat(64);
      },
      /scan nonce changed/iu,
    ],
    [
      "wrong scan digest",
      (snapshot) => {
        snapshot.retirementScan.sha256 = "f".repeat(64);
      },
      /scan digest changed/iu,
    ],
  ];
  for (const [name, mutateSnapshot, expected] of cases) {
    await t.test(name, async (t) => {
      const fixture = withFixture(t);
      const evidence = captureEvidence(fixture);
      const result = await execute(
        fixture,
        `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`,
        {},
        { mutateSnapshot },
      );
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, expected);
      assert.equal(existsSync(fixture.registrations[0].target), true);
    });
  }
});

test("a damaged snapshot cannot be replayed across READY events", async (t) => {
  const fixture = withFixture(t);
  const evidence = captureEvidence(fixture);
  let replayedSnapshot;
  const first = await execute(
    fixture,
    `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`,
    {},
    {
      mutateSnapshot(snapshot) {
        replayedSnapshot = structuredClone(snapshot);
        snapshot.retirementScan.sha256 = "f".repeat(64);
      },
    },
  );
  assert.equal(first.status, 2, first.stderr);
  const second = await execute(
    fixture,
    `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`,
    {},
    { input: replayedSnapshot, bindToReady: false },
  );
  assert.equal(second.status, 2, second.stderr);
  assert.match(second.stderr, /execution boundary (?:nonce|readyAt) changed|predates READY/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("the damaged executor holds the shared lock while waiting for task proof", async (t) => {
  const fixture = withFixture(t);
  const evidence = captureEvidence(fixture);
  let contentionObserved = false;
  const result = await execute(
    fixture,
    `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`,
    {},
    {
      mutateSnapshot() {
        assert.equal(existsSync(join(fixture.commonGitDir, "homa-repository-cleanup.lock")), true);
        assert.throws(
          () => acquireOrdinaryCleanupLock(fixture.commonGitDir, "concurrent-ordinary-attempt"),
          /already exists/iu,
        );
        contentionObserved = true;
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(contentionObserved, true);
});

test("streams a surviving file larger than the subprocess output limit", (t) => {
  const fixture = withFixture(t);
  const largePath = join(fixture.registrations[0].target, "large-surviving-file.bin");
  writeFileSync(largePath, Buffer.alloc(21 * 1024 * 1024, 0x61));
  const evidence = captureEvidence(fixture);
  assert.equal(BigInt(evidence.registrations[0].pathInventory.totalBytes) > 20n * 1024n * 1024n, true);
  const result = assess(fixture);
  assert.equal(result.status, 0, result.stderr);
});

test("one active task blocks the complete batch before any path moves", async (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "lane-one" }, { name: "lane-two" }],
  });
  const evidence = captureEvidence(fixture);
  fixture.taskSnapshot.tasks[1].status = "running";
  fixture.taskSnapshot.capturedAt = new Date().toISOString();
  const result = await execute(fixture, `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /batch retirement.*task.*still running/iu);
  assert.equal(
    fixture.registrations.every((registration) => existsSync(registration.target)),
    true,
  );
});

test("a taskless override is lane-specific and needs its exact separate confirmation", async (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "legacy-lane" }, { name: "tracked-lane" }],
  });
  const evidence = captureEvidence(fixture);
  const legacy = evidence.registrations.find((registration) => registration.path.endsWith("legacy-lane"));
  const approvedAt = new Date().toISOString();
  legacy.task.legacyTasklessOverride = {
    approvedBy: "sidneyswift",
    approvedAt,
    reason: "legacy-lane-predates-task-tracking",
    scanNonce: evidence.scan.nonce,
  };
  fixture.taskSnapshot.tasks = fixture.taskSnapshot.tasks.filter((task) => task.worktree !== legacy.path);
  fixture.taskSnapshot.capturedAt = approvedAt;
  writeEvidence(fixture, evidence);
  writeTaskSnapshot(fixture);

  const missingConfirmation = assess(fixture);
  assert.equal(missingConfirmation.status, 2);
  assert.match(missingConfirmation.stderr, /needs --legacy-taskless-confirmation/iu);
  assert.equal(
    fixture.registrations.every((registration) => existsSync(registration.target)),
    true,
  );

  const separateConfirmation = `ALLOW TASKLESS ${legacy.path}`;
  const inspection = assess(fixture, [separateConfirmation]);
  assert.equal(inspection.status, 0, inspection.stderr);
  const assessment = JSON.parse(inspection.stdout);
  assert.equal(assessment.tasks.overrideCount, 1);
  fixture.taskSnapshot.capturedAt = new Date().toISOString();
  const result = await execute(
    fixture,
    assessment.confirmation,
    {},
    {
      confirmations: [separateConfirmation],
    },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("a changed retained recovery reference blocks retirement", (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "detached-lane", detached: true }],
  });
  const evidence = captureEvidence(fixture);
  git(fixture.primary, ["update-ref", "-d", evidence.registrations[0].recovery.reference]);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /recovery reference.*does not exist/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("a durable bundle must restore the exact detached HEAD and tree in an empty repository", (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "detached-lane", detached: true }],
  });
  const evidence = captureEvidence(fixture);
  const registration = evidence.registrations[0];
  const retainedReference = registration.recovery.reference;
  const artifactPath = join(fixture.root, "detached-lane.bundle");
  git(fixture.primary, ["bundle", "create", artifactPath, retainedReference]);
  chmodSync(artifactPath, 0o600);
  registration.recovery = {
    kind: "bundle",
    artifactPath,
    artifactSha256: sha256File(artifactPath),
    artifactSizeBytes: String(statSync(artifactPath, { bigint: true }).size),
    advertisedHead: registration.head,
    restoredHead: registration.head,
    restoredTree: registration.tree,
    restoreTestedAt: new Date().toISOString(),
    sourceHead: registration.head,
    sourceTree: registration.tree,
  };
  git(fixture.primary, ["update-ref", "-d", retainedReference]);
  writeEvidence(fixture, evidence);
  const result = assess(fixture);
  assert.equal(result.status, 0, result.stderr);
});

test("a changed surviving directory blocks the whole approved set", (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "lane-one" }, { name: "lane-two" }],
  });
  captureEvidence(fixture);
  writeFileSync(join(fixture.registrations[1].target, "changed-after-scan.txt"), "new bytes\n");
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exact approved prunable set.*changed/iu);
  assert.equal(
    fixture.registrations.every((registration) => existsSync(registration.target)),
    true,
  );
});

test("execution refuses a task snapshot file instead of boundary-fresh stdin", (t) => {
  const fixture = withFixture(t);
  const evidence = captureEvidence(fixture);
  const result = runGuard(fixture, [
    "--evidence",
    fixture.evidencePath,
    "--task-snapshot",
    fixture.taskSnapshotPath,
    "--execute",
    "--confirmation",
    `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`,
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires --task-snapshot -/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("batch retirement preserves every byte and uses metadata-only prune", async (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "lane-one" }, { name: "lane-two", detached: true }],
  });
  const evidence = captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const assessment = JSON.parse(inspection.stdout);
  assert.equal(assessment.status, "SAFE_TO_RETIRE_DAMAGED_REGISTRATIONS");

  let restoreProofObservedAtReady = false;
  const result = await execute(
    fixture,
    assessment.confirmation,
    {},
    {
      mutateSnapshot() {
        const commandsAtReady = readFileSync(fixture.fakeGitLog, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        restoreProofObservedAtReady = commandsAtReady.some((args) =>
          args.some((argument) => typeof argument === "string" && argument.includes(".homa-admin-restore-")),
        );
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(restoreProofObservedAtReady, true);
  assert.match(result.stderr, /READY_FOR_FINAL_CODEX_TASK_SNAPSHOT/u);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "DAMAGED_REGISTRATIONS_RETIRED");
  assert.equal(report.registrations.length, 2);
  assert.equal(report.pruneDeletedOriginalAdministrativeBytes, true);
  assert.equal(report.administrativeBytesPreserved, true);
  assert.equal(lstatSync(report.administrativeBackupRoot).mode & 0o777, 0o700);
  for (const retired of report.registrations) {
    const source = fixture.registrations.find((entry) => entry.target === retired.originalPath);
    assert.equal(existsSync(retired.originalPath), false);
    assert.equal(existsSync(join(retired.preservedPath, "surviving-bytes.txt")), true);
    assert.equal(lstatSync(join(retired.preservedPath, "surviving-bytes.txt")).ino, source.sentinelInode);
    assert.equal(lstatSync(dirname(retired.preservedPath)).mode & 0o777, 0o700);
    assert.equal(retired.workingTreeRestoreTested, true);
    assert.equal(retired.administrativeBackup.indexBytesPreserved, true);
    assert.equal(retired.administrativeBackup.restoreTested, true);
    assert.equal(retired.administrativeBackup.restoredCommittedTree, retired.administrativeBackup.restoredStagedTree);
    assert.equal(
      sha256File(join(retired.administrativeBackup.backupPath, "index")),
      retired.administrativeBackup.indexSha256,
    );
    assert.equal(lstatSync(join(retired.administrativeBackup.backupPath, "index")).mode & 0o777, 0o600);
  }
  assert.equal(git(fixture.primary, ["worktree", "list", "--porcelain", "-z"]).includes("gh-900"), false);
  const commands = readFileSync(fixture.fakeGitLog, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(
    commands.some((args) => args.includes("prune") && args.includes(`--expire=${evidence.pruneCutoff}`)),
    true,
  );
  assert.equal(
    commands.some((args) => args.includes("remove")),
    false,
  );
});

test("blocks parent-repository fallback without moving bytes", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  git(fixture.root, ["init"]);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /inside another Git worktree|parent repository/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("blocks a standalone clone collision at the registered path", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  git(fixture.registrations[0].target, ["init"]);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /root \.git|standalone/iu);
  assert.equal(existsSync(join(fixture.registrations[0].target, ".git")), true);
});

test("blocks evidence reached through a symbolic-link parent", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const evidenceDirectory = join(fixture.root, "durable-evidence");
  const evidenceAlias = join(fixture.root, "durable-evidence-alias");
  const evidenceFile = join(evidenceDirectory, "approved.json");
  mkdirSync(evidenceDirectory);
  renameSync(fixture.evidencePath, evidenceFile);
  symlinkSync(evidenceDirectory, evidenceAlias);

  const result = runGuard(fixture, [
    "--evidence",
    join(evidenceAlias, "approved.json"),
    "--task-snapshot",
    fixture.taskSnapshotPath,
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /evidence path|symbolic-link|path-alias/iu);
});

test("blocks nested Git metadata", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const nested = join(fixture.registrations[0].target, "nested");
  mkdirSync(nested);
  git(nested, ["init"]);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Nested \.git/iu);
});

test("blocks a nested bare repository", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  git(fixture.registrations[0].target, ["init", "--bare", "history.git"]);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Nested bare Git repository/iu);
});

test("blocks a symlink collision at the registered path", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const registration = fixture.registrations[0];
  const backing = join(fixture.root, "collision-backing");
  renameSync(registration.target, backing);
  symlinkSync(backing, registration.target);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /symbolic[- ]link|symlink/iu);
  assert.equal(lstatSync(registration.target).isSymbolicLink(), true);
});

test("retires exactly proven metadata when the registered path is already absent", async (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "missing-lane", missingPath: true }],
  });
  const evidence = captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const result = await execute(fixture, JSON.parse(inspection.stdout).confirmation);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.registrations[0].preservedPath, null);
  assert.equal(existsSync(fixture.registrations[0].manuallyPreservedPath), true);
  assert.equal(report.setSha256, evidence.setSha256);
});

test("blocks when a new stale registration makes the approved set incomplete", async (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  addDamagedRegistration(fixture, "unapproved-lane");
  const result = await execute(fixture, `RETIRE DAMAGED REGISTRATIONS ignored`);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exact approved prunable set|set changed/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("preserves and reports a path recreated immediately before prune", async (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const originalPath = fixture.registrations[0].target;
  const result = await execute(fixture, JSON.parse(inspection.stdout).confirmation, {
    FAKE_GIT_LATE_PATH: originalPath,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.lateArrivalPaths, [originalPath]);
  assert.equal(readFileSync(join(originalPath, "arrived-late.txt"), "utf8"), "late bytes stay here\n");
  assert.equal(existsSync(report.registrations[0].preservedPath), true);
});

test("a stale registration created at prune time is too new for the fixed cutoff", async (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const newStalePath = join(fixture.root, "arrived-stale");
  const result = await execute(fixture, JSON.parse(inspection.stdout).confirmation, {
    FAKE_GIT_NEW_STALE_PATH: newStalePath,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(
    report.newRegistrations.some((record) => record.path === newStalePath),
    true,
  );
  assert.match(git(fixture.primary, ["worktree", "list", "--porcelain"]), /arrived-stale/u);
});

test("blocks changed administrative HEAD evidence", (t) => {
  const fixture = withFixture(t);
  const evidence = captureEvidence(fixture);
  writeFileSync(join(evidence.registrations[0].adminDir, "HEAD"), `${"1".repeat(40)}\n`);
  const result = assess(fixture);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /HEAD|administrative record|set changed/iu);
});

test("blocks changed repository origin and script identity", async (t) => {
  await t.test("origin", () => {
    const fixture = withFixture(t);
    captureEvidence(fixture);
    git(fixture.primary, ["remote", "set-url", "origin", "https://github.com/example/not-homa.git"]);
    const result = assess(fixture);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /origin/iu);
  });
  await t.test("script", () => {
    const fixture = withFixture(t);
    captureEvidence(fixture);
    writeFileSync(fixture.guard, `${readFileSync(fixture.guard, "utf8")}\n// changed after approval\n`);
    const result = assess(fixture);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /script/iu);
  });
});
