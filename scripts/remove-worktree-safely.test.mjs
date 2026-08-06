import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { retirementScanSha256 } from "./remove-worktree-safely.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wrapperSource = join(repositoryRoot, "scripts", "remove-worktree-safely.mjs");
const githubOrigin = "https://github.com/sidneyswift/homa.git";

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

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function ignoredFileEvidence(root, path) {
  const absolutePath = join(root, path);
  const stats = lstatSync(absolutePath);
  assert.equal(stats.isFile(), true);
  return {
    path,
    kind: "file",
    sizeBytes: String(stats.size),
    sha256: sha256File(absolutePath),
  };
}

function makeFakeGithub(binPath) {
  mkdirSync(binPath);
  const script = join(binPath, "gh");
  writeFileSync(
    script,
    `#!/usr/bin/env node
const { appendFileSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const args = process.argv.slice(2);
if (process.env.FAKE_ASSERT_GIT_ENV === "1") {
  const allowed = new Set([
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_NOSYSTEM",
    "GIT_NO_REPLACE_OBJECTS",
    "GIT_TERMINAL_PROMPT"
  ]);
  const unexpected = Object.keys(process.env).filter(
    (key) => key.toUpperCase().startsWith("GIT_") && !allowed.has(key)
  );
  if (
    unexpected.length > 0 ||
    process.env.GIT_CONFIG_GLOBAL !== "/dev/null" ||
    process.env.GIT_CONFIG_NOSYSTEM !== "1" ||
    process.env.GIT_NO_REPLACE_OBJECTS !== "1" ||
    process.env.GIT_TERMINAL_PROMPT !== "0"
  ) {
    process.stderr.write("unsafe Git environment reached gh: " + unexpected.join(",") + "\\n");
    process.exit(97);
  }
}
const counterPath = process.env.FAKE_GH_COUNTER_PATH;
let callCount = 0;
if (counterPath) {
  try { callCount = Number(readFileSync(counterPath, "utf8")); } catch {}
  callCount += 1;
  writeFileSync(counterPath, String(callCount));
}
if (callCount === Number(process.env.FAKE_GH_LATE_IGNORED_CALL ?? "0")) {
  const target = process.env.FAKE_GH_LATE_IGNORED_TARGET;
  mkdirSync(join(target, ".late"), { recursive: true });
  writeFileSync(join(target, ".late", "arrived-during-github.txt"), "must survive cleanup\\n");
}
if (args[0] === "pr" && args[1] === "list") {
  process.stdout.write("[]");
  process.exit(0);
}
if (args[0] === "issue" && args[1] === "view") {
  process.stdout.write(JSON.stringify({
    number: 872,
    state: "CLOSED",
    url: "https://github.com/sidneyswift/homa/issues/872"
  }));
  process.exit(0);
}
if (args[0] === "api" && args[1]?.includes("/git/ref/heads/")) {
  const hostnameIndex = args.indexOf("--hostname");
  if (hostnameIndex === -1 || args[hostnameIndex + 1] !== "github.com") {
    process.stderr.write("GitHub reference lookup did not pin github.com.\\n");
    process.exit(98);
  }
  const marker = "/git/ref/heads/";
  const branch = decodeURIComponent(args[1].slice(args[1].indexOf(marker) + marker.length));
  const heads = JSON.parse(process.env.FAKE_GH_REF_HEADS ?? "{}");
  const sha = heads[branch];
  if (process.env.FAKE_GH_REF_LOG) {
    appendFileSync(process.env.FAKE_GH_REF_LOG, args[1] + "\\n");
  }
  if (typeof sha !== "string") {
    process.stderr.write("gh: Not Found (HTTP 404)\\n");
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({
    ref: "refs/heads/" + branch,
    object: { type: "commit", sha }
  }));
  process.exit(0);
}
if (args[0] === "api" && args[1]?.includes("/pulls")) {
  if (process.env.FAKE_GH_LOCAL_ONLY === "1") {
    process.stderr.write("gh: No commit found for SHA (HTTP 422)\\n");
    process.exit(1);
  }
  const pullNumber = Number(process.env.FAKE_GH_ASSOCIATED_PULL ?? "0");
  process.stdout.write(pullNumber > 0 ? JSON.stringify([{
    number: pullNumber,
    state: "closed",
    html_url: "https://github.com/sidneyswift/homa/pull/" + pullNumber,
    head: {
      sha: process.env.FAKE_GH_ASSOCIATED_HEAD,
      ref: "codex/gh-872-disposable"
    }
  }]) : "[]");
  process.exit(0);
}
process.stderr.write("Unexpected gh call: " + args.join(" ") + "\\n");
process.exit(1);
`,
  );
  chmodSync(script, 0o755);
}

function makeFakeGit(binPath, realGitPath) {
  const script = join(binPath, "git");
  writeFileSync(
    script,
    `#!/usr/bin/env node
const { mkdirSync, symlinkSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (process.env.FAKE_ASSERT_GIT_ENV === "1") {
  const allowed = new Set([
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_NOSYSTEM",
    "GIT_NO_REPLACE_OBJECTS",
    "GIT_TERMINAL_PROMPT"
  ]);
  const unexpected = Object.keys(process.env).filter(
    (key) => key.toUpperCase().startsWith("GIT_") && !allowed.has(key)
  );
  if (
    unexpected.length > 0 ||
    process.env.GIT_CONFIG_GLOBAL !== "/dev/null" ||
    process.env.GIT_CONFIG_NOSYSTEM !== "1" ||
    process.env.GIT_NO_REPLACE_OBJECTS !== "1" ||
    process.env.GIT_TERMINAL_PROMPT !== "0"
  ) {
    process.stderr.write("unsafe Git environment reached git: " + unexpected.join(",") + "\\n");
    process.exit(97);
  }
}
if (process.env.FAKE_GIT_REJECT_LS_REMOTE === "1" && args.includes("ls-remote")) {
  process.stderr.write("Git network authentication is intentionally unavailable in this fixture.\\n");
  process.exit(96);
}
const moveIndex = args.indexOf("move");
if (process.env.FAKE_GIT_LATE_IGNORED_ON_MOVE === "1" && moveIndex > 0 && args[moveIndex - 1] === "worktree") {
  const source = args[moveIndex + 1];
  mkdirSync(join(source, ".late"), { recursive: true });
  writeFileSync(join(source, ".late", "arrived-during-move.txt"), "must survive quarantine\\n");
}
const removeIndex = args.indexOf("remove");
if (process.env.FAKE_GIT_LATE_IGNORED_ON_REMOVE === "1" && removeIndex > 0 && args[removeIndex - 1] === "worktree") {
  const source = args[removeIndex + 1];
  mkdirSync(join(source, ".late"), { recursive: true });
  writeFileSync(join(source, ".late", "arrived-during-remove.txt"), "must survive removal\\n");
}
const result = spawnSync(${JSON.stringify(realGitPath)}, args, {
  encoding: "utf8",
  env: process.env
});
if (
  result.status === 0 &&
  process.env.FAKE_GIT_RECREATE_ORIGINAL_SYMLINK === "1" &&
  moveIndex > 0 &&
  args[moveIndex - 1] === "worktree"
) {
  symlinkSync("/definitely/missing/homa-worktree", args[moveIndex + 1]);
}
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
`,
  );
  chmodSync(script, 0o755);
}

function git(fixture, cwd, args) {
  return checked("git", args, { cwd, env: fixture.env });
}

function makeFixture({
  localOnly = false,
  remoteBranch = false,
  thinBundle = false,
  ignored = false,
  ignoredFilename = "generated.txt",
  ignoredPath,
  ignoredDisposition = "regenerable",
  taskless = false,
  lateIgnoredDuringFinalGithub = false,
  lateIgnoredDuringMove = false,
  lateIgnoredDuringRemove = false,
  recreateOriginalSymlinkDuringMove = false,
  trackedBareRepository = false,
} = {}) {
  assert.equal(localOnly && remoteBranch, false, "A fixture cannot use two recovery kinds.");
  const root = mkdtempSync(join(homedir(), ".homa-worktree-wrapper-"));
  const remote = join(root, "remote.git");
  const primary = join(root, "primary");
  const target = join(root, "lane");
  const fakeBin = join(root, "bin");
  const evidencePath = join(root, "removal-evidence.json");
  const taskSnapshotPath = join(root, "task-snapshot.json");
  const fakeGithubCounterPath = join(root, "fake-gh-counter.txt");
  const fakeGithubRefLogPath = join(root, "fake-gh-ref-log.txt");
  const fixtureIgnoredPath = ignoredPath ?? join(".cache", ignoredFilename);

  checked("git", ["init", "--bare", remote]);
  checked("git", ["init", "-b", "main", primary]);
  const env = { ...process.env };
  const fixture = {
    root,
    remote,
    primary,
    target,
    fakeBin,
    evidencePath,
    taskSnapshotPath,
    fakeGithubCounterPath,
    fakeGithubRefLogPath,
    env,
  };

  git(fixture, primary, ["config", "user.name", "Homa cleanup test"]);
  git(fixture, primary, ["config", "user.email", "cleanup-test@example.test"]);
  git(fixture, primary, ["config", `url.file://${remote}.insteadOf`, githubOrigin]);
  writeFileSync(join(primary, "README.md"), "Disposable worktree integration fixture.\n");
  mkdirSync(join(primary, "tracked-container"));
  writeFileSync(
    join(primary, "tracked-container", "history.txt"),
    "Outer repository tracks this exact file.\n",
  );
  const ordinarySource = join(primary, "ordinary-source.git");
  mkdirSync(join(ordinarySource, "objects"), { recursive: true });
  mkdirSync(join(ordinarySource, "refs"), { recursive: true });
  writeFileSync(join(ordinarySource, "HEAD"), "export const pageHead = 'ordinary source';\n");
  writeFileSync(join(ordinarySource, "config"), "export const config = { bare: false };\n");
  writeFileSync(join(ordinarySource, "objects", "index.ts"), "export const objects = [];\n");
  writeFileSync(join(ordinarySource, "refs", "routes.ts"), "export const refs = [];\n");
  if (trackedBareRepository) {
    const nestedSource = join(root, "nested-history-source");
    const nestedBareRepository = join(primary, "history.git");
    checked("git", ["init", "-b", "nested-main", nestedSource]);
    git(fixture, nestedSource, ["config", "user.name", "Nested bare history test"]);
    git(fixture, nestedSource, ["config", "user.email", "nested-bare@example.test"]);
    writeFileSync(join(nestedSource, "unique-history.txt"), "Only the nested bare repository has this commit.\n");
    git(fixture, nestedSource, ["add", "unique-history.txt"]);
    git(fixture, nestedSource, ["commit", "-m", "test: unique bare history"]);
    fixture.nestedBareHead = git(fixture, nestedSource, ["rev-parse", "HEAD"]);
    checked("git", ["init", "--bare", nestedBareRepository]);
    git(fixture, nestedSource, ["remote", "add", "nested-bare", nestedBareRepository]);
    git(fixture, nestedSource, ["push", "nested-bare", "nested-main"]);
    checked("git", ["--git-dir", nestedBareRepository, "symbolic-ref", "HEAD", "refs/heads/nested-main"]);
    rmSync(nestedSource, { recursive: true, force: true });
  }
  writeFileSync(
    join(primary, ".gitignore"),
    ".cache/\n.late/\n.next/\n.output/\nbuild/\ncoverage/\ndist/\ngenerated/\n*.scratch\n",
  );
  mkdirSync(join(primary, "scripts"));
  copyFileSync(wrapperSource, join(primary, "scripts", "remove-worktree-safely.mjs"));
  git(fixture, primary, ["add", "."]);
  git(fixture, primary, ["commit", "-m", "test: create disposable repository"]);
  git(fixture, primary, ["remote", "add", "origin", githubOrigin]);
  git(fixture, primary, ["push", "-u", "origin", "main"]);
  git(fixture, primary, ["fetch", "origin", "main"]);
  git(fixture, primary, ["worktree", "add", "-b", "codex/gh-872-disposable", target, "origin/main"]);
  fixture.wrapper = join(target, "scripts", "remove-worktree-safely.mjs");
  git(fixture, target, ["config", "user.name", "Homa cleanup test"]);
  git(fixture, target, ["config", "user.email", "cleanup-test@example.test"]);

  if (localOnly) {
    writeFileSync(join(target, "local-only.txt"), "Preserved only in the local bundle.\n");
    git(fixture, target, ["add", "local-only.txt"]);
    git(fixture, target, ["commit", "-m", "test: local-only recovery"]);
  }
  if (remoteBranch) {
    writeFileSync(join(target, "remote-branch.txt"), "Preserved by the private remote branch.\n");
    git(fixture, target, ["add", "remote-branch.txt"]);
    git(fixture, target, ["commit", "-m", "test: remote branch recovery"]);
    git(fixture, target, ["push", "-u", "origin", "codex/gh-872-disposable"]);
  }
  if (ignored) {
    mkdirSync(dirname(join(target, fixtureIgnoredPath)), { recursive: true });
    writeFileSync(join(target, fixtureIgnoredPath), "regenerable\n");
  }

  const realGitPath = checked("which", ["git"]);
  makeFakeGithub(fakeBin);
  makeFakeGit(fakeBin, realGitPath);
  fixture.env = {
    ...fixture.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_GH_LOCAL_ONLY: localOnly ? "1" : "0",
    FAKE_GH_COUNTER_PATH: fakeGithubCounterPath,
    FAKE_GH_LATE_IGNORED_CALL: lateIgnoredDuringFinalGithub ? "5" : "0",
    FAKE_GH_LATE_IGNORED_TARGET: target,
    FAKE_GH_REF_LOG: fakeGithubRefLogPath,
    FAKE_GH_ASSOCIATED_PULL: "0",
    FAKE_GIT_LATE_IGNORED_ON_MOVE: lateIgnoredDuringMove ? "1" : "0",
    FAKE_GIT_LATE_IGNORED_ON_REMOVE: lateIgnoredDuringRemove ? "1" : "0",
    FAKE_GIT_RECREATE_ORIGINAL_SYMLINK: recreateOriginalSymlinkDuringMove ? "1" : "0",
  };

  const now = new Date().toISOString();
  const head = git(fixture, target, ["rev-parse", "HEAD"]);
  fixture.env.FAKE_GH_ASSOCIATED_HEAD = head;
  const baseHead = git(fixture, target, ["rev-parse", "origin/main"]);
  fixture.env.FAKE_GH_REF_HEADS = JSON.stringify({
    main: baseHead,
    ...(remoteBranch ? { "codex/gh-872-disposable": head } : {}),
  });
  const tree = git(fixture, target, ["rev-parse", "HEAD^{tree}"]);
  const commonGitDir = realpathSync(git(fixture, target, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const gitDir = realpathSync(git(fixture, target, ["rev-parse", "--path-format=absolute", "--git-dir"]));
  const patchSha256 = createHash("sha256").update("").digest("hex");
  let recovery;
  if (localOnly) {
    const bundlePath = join(root, "recovery.bundle");
    const bundleArgs = thinBundle
      ? ["bundle", "create", bundlePath, "codex/gh-872-disposable", "^origin/main"]
      : ["bundle", "create", bundlePath, "codex/gh-872-disposable"];
    git(fixture, target, bundleArgs);
    let restoredHead = head;
    let restoredTree = tree;
    if (!thinBundle) {
      const restored = join(root, "restored");
      checked("git", ["clone", "-b", "codex/gh-872-disposable", bundlePath, restored], {
        env: fixture.env,
      });
      restoredHead = git(fixture, restored, ["rev-parse", "HEAD"]);
      restoredTree = git(fixture, restored, ["rev-parse", "HEAD^{tree}"]);
    }
    recovery = {
      kind: "bundle",
      sourceHead: head,
      sourceTree: tree,
      patchSha256,
      artifactPath: bundlePath,
      artifactSha256: sha256File(bundlePath),
      restoredHead,
      restoredTree,
      restoreTestedAt: now,
    };
  } else if (remoteBranch) {
    recovery = {
      kind: "remote-branch",
      reference: "refs/heads/codex/gh-872-disposable",
      sourceHead: head,
      sourceTree: tree,
      patchSha256,
      restoredHead: head,
      restoredTree: tree,
      restoreTestedAt: now,
    };
  } else {
    recovery = {
      kind: "integrated",
      sourceHead: head,
      sourceTree: tree,
      patchSha256,
      restoredHead: head,
      restoredTree: tree,
      restoreTestedAt: now,
    };
  }

  const ignoredDispositions = ignored
    ? [
        {
          ...ignoredFileEvidence(target, fixtureIgnoredPath),
          disposition: ignoredDisposition,
          reason: "Disposable generated fixture content.",
          decidedAt: now,
        },
      ]
    : [];
  if (ignoredDispositions[0]?.disposition === "backed-up-private") {
    const backupRoot = join(root, "private-backup");
    const backupPath = join(backupRoot, "ignored-file.backup");
    mkdirSync(backupRoot, { mode: 0o700 });
    chmodSync(backupRoot, 0o700);
    copyFileSync(join(target, fixtureIgnoredPath), backupPath);
    chmodSync(backupPath, 0o600);
    const backupFingerprint = ignoredFileEvidence(backupRoot, "ignored-file.backup");
    ignoredDispositions[0].backup = {
      artifactPath: backupPath,
      artifactSha256: backupFingerprint.sha256,
      artifactSizeBytes: backupFingerprint.sizeBytes,
      sourceSha256: ignoredDispositions[0].sha256,
      sourceSizeBytes: ignoredDispositions[0].sizeBytes,
      checkedAt: now,
    };
    fixture.privateBackupPath = backupPath;
  }
  const evidence = {
    schemaVersion: 2,
    capturedAt: now,
    repository: {
      root: realpathSync(primary),
      commonGitDir,
      origin: githubOrigin,
    },
    worktree: {
      path: realpathSync(target),
      registeredPath: realpathSync(target),
      gitDir,
      head,
      tree,
      branch: "codex/gh-872-disposable",
      baseRef: "origin/main",
      patchSha256,
      ignoredDispositions,
    },
    issue: {
      number: 872,
      state: "CLOSED",
      url: "https://github.com/sidneyswift/homa/issues/872",
      disposition: "closed",
    },
    task: taskless
      ? {
          legacyTasklessOverride: {
            approvedBy: "sidneyswift",
            reason: "legacy-lane-predates-task-tracking",
            approvedAt: now,
          },
        }
      : {},
    recovery,
  };
  const scan = {
    version: 1,
    nonce: "a".repeat(64),
    sha256: retirementScanSha256({
      target: realpathSync(target),
      registeredPath: realpathSync(target),
      repositoryRoot: realpathSync(primary),
      commonGitDir,
      origin: "https://github.com/sidneyswift/homa",
      head,
      tree,
      branch: "codex/gh-872-disposable",
      baseRef: "origin/main",
      uniqueCommitCount: localOnly || remoteBranch ? 1 : 0,
      integrated: !localOnly && !remoteBranch,
      statusLines: [],
      ignoredEntries: ignoredDispositions.map(({ path, kind, sizeBytes, sha256 }) => ({
        path,
        kind,
        sizeBytes,
        sha256,
      })),
      patchSha256,
      remoteHead: remoteBranch ? head : null,
      bundle: localOnly && !thinBundle
        ? {
            artifactSha256: recovery.artifactSha256,
            restoredHead: recovery.restoredHead,
            restoredTree: recovery.restoredTree,
          }
        : null,
    }),
  };
  evidence.scan = scan;
  evidence.approval = {
    approvedBy: "sidneyswift",
    approvedAt: now,
    reason: "Reviewed the exact generated cleanup evidence.",
    scanNonce: scan.nonce,
    scanSha256: scan.sha256,
  };
  const taskSnapshot = {
    schemaVersion: 1,
    source: "codex-list-threads",
    coverage: "all-open-and-recent-homa-tasks",
    capturedAt: now,
    repositoryOrigin: githubOrigin,
    retirementScan: {
      nonce: scan.nonce,
      sha256: scan.sha256,
    },
    tasks: taskless
      ? []
      : [
          {
            id: "completed-cleanup-task",
            status: "completed",
            branch: "codex/gh-872-disposable",
            worktree: target,
            handoff: {
              outcome: "Disposable cleanup fixture completed.",
              issue: "#872",
              branch: "codex/gh-872-disposable",
              worktree: target,
              commitOrPr: head,
              checks: {
                executed: true,
                status: "passed",
                commands: ["node --test disposable-cleanup.test.mjs"],
                completedAt: now,
              },
              productionState: "No production effect.",
              nextStep: "cleanup-coordinator-remove-worktree",
              handoffComplete: true,
              recordedAt: now,
            },
          },
        ],
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(taskSnapshotPath, `${JSON.stringify(taskSnapshot, null, 2)}\n`);
  return fixture;
}

function wrapperArgs(
  fixture,
  { execute = false, legacyTaskless = false, wrapper = fixture.wrapper } = {},
) {
  const args = [
    realpathSync(wrapper),
    "--target",
    fixture.target,
    "--evidence",
    fixture.evidencePath,
    "--task-snapshot",
    fixture.taskSnapshotPath,
  ];
  if (execute) {
    args[args.indexOf(fixture.taskSnapshotPath)] = "-";
    args.push(
      "--execute",
      "--remote-branch-action",
      "keep",
      "--confirmation",
      `REMOVE ${realpathSync(fixture.target)}`,
    );
  }
  if (legacyTaskless) {
    args.push("--legacy-taskless-confirmation", `ALLOW TASKLESS ${realpathSync(fixture.target)}`);
  }
  return args;
}

function executionOptions(fixture, environment = fixture.env) {
  return {
    env: environment,
    input: readFileSync(fixture.taskSnapshotPath),
  };
}

function quarantineRoots(fixture) {
  return readdirSync(fixture.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(".homa-worktree-quarantine-"))
    .map((entry) => join(fixture.root, entry.name));
}

test("execution removes the registration and preserves sealed checkout content", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 0, result.stderr);
  const outcome = JSON.parse(result.stdout);
  assert.equal(outcome.status, "WORKTREE_REGISTRATION_REMOVED");
  assert.equal(existsSync(fixture.target), false);
  const roots = quarantineRoots(fixture);
  assert.equal(roots.length, 1);
  assert.equal(outcome.preservedPath, join(roots[0], "preserved-worktree"));
  assert.equal(existsSync(outcome.preservedPath), true);
  assert.equal(existsSync(join(outcome.preservedPath, ".git")), true);
  assert.doesNotMatch(git(fixture, fixture.primary, ["worktree", "list", "--porcelain"]), /codex\/gh-872-disposable/u);
});

test("the generator writes bound mode-0600 evidence and a review queue", (t) => {
  const fixture = makeFixture({ ignored: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const evidenceOut = join(fixture.root, "generated-evidence.json");
  const reviewQueueOut = join(fixture.root, "generated-review-queue.json");

  const result = run(
    process.execPath,
    [
      fixture.wrapper,
      "--generate",
      "--target",
      fixture.target,
      "--evidence-out",
      evidenceOut,
      "--review-queue-out",
      reviewQueueOut,
    ],
    { env: fixture.env },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(lstatSync(evidenceOut).mode & 0o777, 0o600);
  assert.equal(lstatSync(reviewQueueOut).mode & 0o777, 0o600);
  const evidence = JSON.parse(readFileSync(evidenceOut, "utf8"));
  const queue = JSON.parse(readFileSync(reviewQueueOut, "utf8"));
  assert.equal(evidence.schemaVersion, 2);
  assert.match(evidence.scan.nonce, /^[a-f0-9]{64}$/u);
  assert.equal(evidence.scan.sha256, queue.scan.sha256);
  assert.equal(queue.items.some((item) => item.kind === "approval"), true);
  assert.equal(queue.items.some((item) => item.kind === "execution-task-snapshot"), true);
});

test("private origin references use authenticated GitHub API without Git credentials", (t) => {
  const fixture = makeFixture({ remoteBranch: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const env = {
    ...fixture.env,
    FAKE_ASSERT_GIT_ENV: "1",
    FAKE_GIT_REJECT_LS_REMOTE: "1",
  };

  const result = run(process.execPath, wrapperArgs(fixture), { env });
  assert.equal(result.status, 0, result.stderr);
  const assessment = JSON.parse(result.stdout);
  assert.equal(assessment.status, "SAFE_TO_REMOVE");
  assert.equal(assessment.recovery, "remote-branch");
  assert.deepEqual(
    readFileSync(fixture.fakeGithubRefLogPath, "utf8").trim().split("\n"),
    [
      "repos/sidneyswift/homa/git/ref/heads/main",
      "repos/sidneyswift/homa/git/ref/heads/codex%2Fgh-872-disposable",
    ],
  );
});

test("a nested Git directory with unique history blocks a clean outer worktree", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const nestedRoot = join(fixture.target, "tracked-container");

  git(fixture, nestedRoot, ["init", "-b", "nested-main"]);
  git(fixture, nestedRoot, ["config", "user.name", "Nested history test"]);
  git(fixture, nestedRoot, ["config", "user.email", "nested-history@example.test"]);
  git(fixture, nestedRoot, ["add", "history.txt"]);
  git(fixture, nestedRoot, ["commit", "-m", "test: unique nested history"]);
  const nestedHead = git(fixture, nestedRoot, ["rev-parse", "HEAD"]);

  assert.equal(git(fixture, fixture.target, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
  assert.notEqual(
    run("git", ["cat-file", "-e", `${nestedHead}^{commit}`], {
      cwd: fixture.target,
      env: fixture.env,
    }).status,
    0,
  );

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /nested \.git entry/iu);
  assert.equal(git(fixture, nestedRoot, ["rev-parse", "HEAD"]), nestedHead);
});

test("a nested .git file blocks a clean outer worktree", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  writeFileSync(
    join(fixture.target, "tracked-container", ".git"),
    "gitdir: /durable/private/nested-history.git\n",
  );

  assert.equal(git(fixture, fixture.target, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /nested \.git entry/iu);
  assert.equal(existsSync(join(fixture.target, "tracked-container", ".git")), true);
});

test("a tracked nested bare repository with unique history blocks cleanup", (t) => {
  const fixture = makeFixture({ trackedBareRepository: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const nestedBareRepository = join(fixture.target, "history.git");

  assert.equal(git(fixture, fixture.target, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
  assert.notEqual(
    run("git", ["cat-file", "-e", `${fixture.nestedBareHead}^{commit}`], {
      cwd: fixture.target,
      env: fixture.env,
    }).status,
    0,
  );
  assert.equal(
    git(fixture, fixture.target, ["--git-dir", nestedBareRepository, "rev-parse", "HEAD"]),
    fixture.nestedBareHead,
  );

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /nested bare Git repository/iu);
  assert.equal(
    git(fixture, fixture.target, ["--git-dir", nestedBareRepository, "rev-parse", "HEAD"]),
    fixture.nestedBareHead,
  );
});

test("an ordinary source folder with Git-shaped names is not a bare repository", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "SAFE_TO_REMOVE");
  assert.equal(existsSync(join(fixture.target, "ordinary-source.git", "objects", "index.ts")), true);
});

test("a fresh active task blocks the destructive executor and preserves the worktree", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const taskSnapshot = JSON.parse(readFileSync(fixture.taskSnapshotPath, "utf8"));
  taskSnapshot.capturedAt = new Date().toISOString();
  taskSnapshot.tasks = [
    {
      id: "active-cleanup-task",
      status: "running",
      branch: "codex/gh-872-disposable",
      worktree: fixture.target,
    },
  ];
  writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(taskSnapshot, null, 2)}\n`);

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /still running/u);
  assert.equal(existsSync(fixture.target), true);
  assert.match(git(fixture, fixture.primary, ["worktree", "list", "--porcelain"]), /codex\/gh-872-disposable/u);
});

test("execution rejects a task snapshot older than thirty seconds", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const taskSnapshot = JSON.parse(readFileSync(fixture.taskSnapshotPath, "utf8"));
  taskSnapshot.capturedAt = new Date(Date.now() - 31_000).toISOString();
  writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(taskSnapshot, null, 2)}\n`);

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Task snapshot capturedAt is stale/u);
  assert.equal(existsSync(fixture.target), true);
});

test("execution rejects a task snapshot captured in the future", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const taskSnapshot = JSON.parse(readFileSync(fixture.taskSnapshotPath, "utf8"));
  taskSnapshot.capturedAt = new Date(Date.now() + 60_000).toISOString();
  writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(taskSnapshot, null, 2)}\n`);

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Task snapshot capturedAt is in the future/u);
  assert.equal(existsSync(fixture.target), true);
});

test("a verified bundle preserves a local-only commit when GitHub returns 422", (t) => {
  const fixture = makeFixture({ localOnly: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 0, result.stderr);
  const assessment = JSON.parse(result.stdout);
  assert.equal(assessment.status, "SAFE_TO_REMOVE");
  assert.equal(assessment.recovery, "bundle");
  assert.equal(existsSync(fixture.target), true);
});

test("bundle recovery rejects the operating system temporary directory", (t) => {
  const fixture = makeFixture({ localOnly: true });
  const temporaryRoot = mkdtempSync(join(tmpdir(), "homa-temporary-bundle-"));
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const evidence = JSON.parse(readFileSync(fixture.evidencePath, "utf8"));
  const temporaryBundle = join(temporaryRoot, "recovery.bundle");
  copyFileSync(evidence.recovery.artifactPath, temporaryBundle);
  evidence.recovery.artifactPath = temporaryBundle;
  writeFileSync(fixture.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  if (process.platform === "darwin") {
    assert.match(
      realpathSync(temporaryBundle),
      /^\/private\/var\/folders\/[^/]+\/[^/]+\/T\//u,
    );
  }
  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ephemeral operating-system temporary storage/iu);
  assert.equal(existsSync(fixture.target), true);
});

test("evidence rejects every available operating system temporary root", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const temporaryRoots = [
    ...new Set(
      [tmpdir(), "/private/tmp", "/var/tmp"]
        .filter((candidate) => existsSync(candidate))
        .map((candidate) => realpathSync(candidate)),
    ),
  ];

  for (const temporaryBase of temporaryRoots) {
    const temporaryRoot = mkdtempSync(join(temporaryBase, "homa-temporary-evidence-"));
    try {
      const temporaryEvidence = join(temporaryRoot, "removal-evidence.json");
      copyFileSync(fixture.evidencePath, temporaryEvidence);
      const result = run(
        process.execPath,
        wrapperArgs({ ...fixture, evidencePath: temporaryEvidence }),
        { env: fixture.env },
      );
      assert.equal(result.status, 2, `${temporaryBase}: ${result.stderr}`);
      assert.match(
        result.stderr,
        /ephemeral operating-system temporary storage/iu,
        temporaryBase,
      );
      assert.equal(existsSync(fixture.target), true);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
});

test("ignored content needs an exact recorded disposition", (t) => {
  const fixture = makeFixture({ ignored: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const accepted = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).ignoredPathDecisions, 1);

  const evidence = JSON.parse(readFileSync(fixture.evidencePath, "utf8"));
  evidence.worktree.ignoredDispositions = [];
  writeFileSync(fixture.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  const rejected = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /Exact ignored file fingerprint changed/u);
});

test("changed ignored content invalidates the recorded fingerprint", (t) => {
  const fixture = makeFixture({ ignored: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  writeFileSync(join(fixture.target, ".cache", "generated.txt"), "different bytes\n");

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ignored file fingerprint changed/iu);
});

test("sensitive files nested under ignored directories cannot be called regenerable", () => {
  for (const ignoredPath of [
    ".cache/.env.local",
    ".cache/.env",
    ".cache/.envrc",
    ".cache/.envrc.local",
    ".cache/production.env",
    ".cache/tool.envrc",
    ".cache/environment.local.json",
    ".cache/.pgpass",
    ".cache/.docker/config.json",
    ".cache/AuthKey_ABC123.p8",
    ".cache/service-account.json",
    ".cache/serviceAccountKey.json",
    ".cache/release.keystore",
    ".cache/config.local",
    ".cache/stripe-client-secret.json",
    ".cache/github-token.json",
    ".cache/tls.pem",
    ".cache/tls.pem.bak",
    ".cache/signing.p12",
    ".cache/signing.p12.backup",
    ".cache/signing.pfx",
    ".cache/release.jks",
    ".cache/release.jks.old",
    ".cache/client.ppk",
    ".cache/signing.pkcs12",
    ".cache/release.truststore",
    ".cache/certificate.cer",
    ".cache/server.crt.old",
    ".cache/private.key",
    ".cache/private.key.bak",
    ".cache/id_rsa",
    ".cache/id_ed25519",
    ".cache/application-default-credentials.json",
    ".cache/application_default_credentials.json",
    ".cache/applicationDefaultCredentials.json",
  ]) {
    const fixture = makeFixture({ ignored: true, ignoredPath });
    try {
      const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
      assert.equal(result.status, 2, `${ignoredPath}: ${result.stderr}`);
      assert.match(result.stderr, /cannot be classified as regenerable/iu, ignoredPath);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("known sensitive filenames stay sensitive through backup suffix chains", () => {
  for (const ignoredPath of [
    ".cache/.npmrc.bak",
    ".cache/.pgpass.bak",
    ".cache/.netrc.old",
    ".cache/auth.json.backup",
    ".cache/google-services.json.backup",
    ".cache/googleservice-info.plist.old",
    ".cache/kubeconfig.bak",
  ]) {
    const fixture = makeFixture({ ignored: true, ignoredPath });
    try {
      const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
      assert.equal(result.status, 2, `${ignoredPath}: ${result.stderr}`);
      assert.match(result.stderr, /cannot be classified as regenerable/iu, ignoredPath);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("ordinary tokenizer caches and build artifacts can be recorded as regenerable", () => {
  for (const ignoredPath of [
    ".cache/tokenizer-cache.json",
    ".next/cache/webpack/client.pack",
    ".output/server/index.mjs",
    "build/chunks/app-123.js",
    "coverage/lcov.info",
    "dist/assets/site.css",
    "generated/schema-types.ts",
  ]) {
    const fixture = makeFixture({ ignored: true, ignoredPath });
    try {
      const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
      assert.equal(result.status, 0, `${ignoredPath}: ${result.stderr}`);
      assert.equal(JSON.parse(result.stdout).ignoredPathDecisions, 1, ignoredPath);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

test("a root ignored file cannot be called regenerable", (t) => {
  const fixture = makeFixture({ ignored: true, ignoredPath: "draft.scratch" });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /approved generated, cache, build, or output directory/iu);
});

test("ignored filenames containing newlines are inventoried without ambiguity", (t) => {
  const fixture = makeFixture({ ignored: true, ignoredFilename: "line\nbreak.txt" });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ignoredPathDecisions, 1);
});

test("a thin bundle that cannot restore into an empty repository is rejected", (t) => {
  const fixture = makeFixture({ localOnly: true, thinBundle: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /prerequisite|restore|fetch/iu);
  assert.equal(existsSync(fixture.target), true);
});

test("an exact owner-only private backup is revalidated", (t) => {
  const fixture = makeFixture({ ignored: true, ignoredDisposition: "backed-up-private" });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const accepted = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(accepted.status, 0, accepted.stderr);

  writeFileSync(fixture.privateBackupPath, "changed backup bytes\n");
  const changed = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(changed.status, 2);
  assert.match(changed.stderr, /private backup|backup checksum|exact private backup/iu);
});

test("a private backup with group access is rejected", (t) => {
  const fixture = makeFixture({ ignored: true, ignoredDisposition: "backed-up-private" });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  chmodSync(fixture.privateBackupPath, 0o640);

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /readable or writable by another user/iu);
});

test("an ambient alternate object directory cannot make a thin bundle look complete", (t) => {
  const fixture = makeFixture({ localOnly: true, thinBundle: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const env = {
    ...fixture.env,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(fixture.primary, ".git", "objects"),
  };

  const result = run(process.execPath, wrapperArgs(fixture), { env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /prerequisite|restore|fetch|missing/iu);
  assert.equal(existsSync(fixture.target), true);
});

test("ambient Git repository overrides cannot redirect inspection", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const poison = join(fixture.root, "poison.git");
  checked("git", ["init", "--bare", poison]);
  const env = {
    ...fixture.env,
    GIT_DIR: poison,
    GIT_WORK_TREE: fixture.primary,
    GIT_OBJECT_DIRECTORY: join(poison, "objects"),
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "remote.origin.url",
    GIT_CONFIG_VALUE_0: "https://github.com/attacker/other.git",
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(fixture.primary, ".git", "objects"),
    GIT_COMMON_DIR: join(fixture.primary, ".git"),
    GIT_REPLACE_REF_BASE: "refs/evil/",
    GIT_TEMPLATE_DIR: fixture.primary,
    GIT_FAKE_ESCAPE: "must-not-survive",
    git_LOWER_POISON: "must-not-survive",
    FAKE_ASSERT_GIT_ENV: "1",
  };

  const result = run(process.execPath, wrapperArgs(fixture), { env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "SAFE_TO_REMOVE");
});

test("evidence decisions and recovery timestamps cannot be in the future", (t) => {
  const fixture = makeFixture({ ignored: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const baseline = JSON.parse(readFileSync(fixture.evidencePath, "utf8"));
  const future = new Date(Date.now() + 60_000).toISOString();
  const cases = [
    ["capturedAt", (evidence) => { evidence.capturedAt = future; }, /Evidence capturedAt.*future/iu],
    [
      "ignored decision",
      (evidence) => { evidence.worktree.ignoredDispositions[0].decidedAt = future; },
      /decision is in the future/iu,
    ],
    [
      "restore test",
      (evidence) => { evidence.recovery.restoreTestedAt = future; },
      /restoreTestedAt is in the future/iu,
    ],
  ];

  for (const [label, mutate, expected] of cases) {
    const evidence = structuredClone(baseline);
    mutate(evidence);
    writeFileSync(fixture.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
    assert.equal(result.status, 2, `${label}: ${result.stderr}`);
    assert.match(result.stderr, expected, label);
  }
});

test("a task handoff needs exact completion evidence", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const baseline = JSON.parse(readFileSync(fixture.taskSnapshotPath, "utf8"));
  const future = new Date(Date.now() + 60_000).toISOString();
  const cases = [
    ["cancelled status", (task) => { task.status = "cancelled"; }, /status|completed/iu],
    ["partial issue token", (task) => { task.handoff.issue = "#8720"; }, /different issue/iu],
    ["suffixed commit", (task) => { task.handoff.commitOrPr += "-extra"; }, /commitOrPr/iu],
    ["unexecuted checks", (task) => { task.handoff.checks.executed = false; }, /checks\.executed/iu],
    ["failed checks", (task) => { task.handoff.checks.status = "failed"; }, /checks\.status/iu],
    ["empty check commands", (task) => { task.handoff.checks.commands = []; }, /checks\.commands/iu],
    ["future check time", (task) => { task.handoff.checks.completedAt = future; }, /checks\.completedAt.*future/iu],
    ["wrong next step", (task) => { task.handoff.nextStep = "delete-it"; }, /nextStep/iu],
    ["incomplete handoff", (task) => { task.handoff.handoffComplete = false; }, /handoffComplete/iu],
    ["future handoff", (task) => { task.handoff.recordedAt = future; }, /recordedAt.*future/iu],
  ];

  for (const [label, mutate, expected] of cases) {
    const snapshot = structuredClone(baseline);
    mutate(snapshot.tasks[0]);
    writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
    assert.equal(result.status, 2, `${label}: ${result.stderr}`);
    assert.match(result.stderr, expected, label);
  }
});

test("a handoff can point exactly to its commit URL or an associated pull request", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const snapshot = JSON.parse(readFileSync(fixture.taskSnapshotPath, "utf8"));
  const head = snapshot.tasks[0].handoff.commitOrPr;

  snapshot.tasks[0].handoff.commitOrPr = `https://github.com/sidneyswift/homa/commit/${head}`;
  writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const commitResult = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(commitResult.status, 0, commitResult.stderr);

  snapshot.tasks[0].handoff.commitOrPr = "https://github.com/sidneyswift/homa/pull/912";
  writeFileSync(fixture.taskSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const pullResult = run(process.execPath, wrapperArgs(fixture), {
    env: { ...fixture.env, FAKE_GH_ASSOCIATED_PULL: "912" },
  });
  assert.equal(pullResult.status, 0, pullResult.stderr);

  const wrongHeadResult = run(process.execPath, wrapperArgs(fixture), {
    env: {
      ...fixture.env,
      FAKE_GH_ASSOCIATED_PULL: "912",
      FAKE_GH_ASSOCIATED_HEAD: "0000000000000000000000000000000000000000",
    },
  });
  assert.equal(wrongHeadResult.status, 2);
  assert.match(wrongHeadResult.stderr, /commitOrPr/iu);
});

test("automatic removal rejects a hand-written empty task snapshot", (t) => {
  const fixture = makeFixture({ taskless: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture), { env: fixture.env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /matching finished task/iu);
  assert.equal(existsSync(fixture.target), true);
});

test("a taskless legacy lane needs a separate exact confirmation", (t) => {
  const fixture = makeFixture({ taskless: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture, { legacyTaskless: true }), {
    env: fixture.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "SAFE_TO_REMOVE");
});

test("a taskless override needs the exact approver, reason, and a nonfuture timestamp", (t) => {
  const fixture = makeFixture({ taskless: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const baseline = JSON.parse(readFileSync(fixture.evidencePath, "utf8"));
  const cases = [
    ["approver", (override) => { override.approvedBy = "someone-else"; }, /approvedBy/iu],
    ["reason", (override) => { override.reason = "seems safe"; }, /reason/iu],
    [
      "future approval",
      (override) => { override.approvedAt = new Date(Date.now() + 60_000).toISOString(); },
      /approvedAt.*future/iu,
    ],
  ];

  for (const [label, mutate, expected] of cases) {
    const evidence = structuredClone(baseline);
    mutate(evidence.task.legacyTasklessOverride);
    writeFileSync(fixture.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const result = run(process.execPath, wrapperArgs(fixture, { legacyTaskless: true }), {
      env: fixture.env,
    });
    assert.equal(result.status, 2, `${label}: ${result.stderr}`);
    assert.match(result.stderr, expected, label);
  }
});

test("ignored content created during final GitHub checks blocks removal", (t) => {
  const fixture = makeFixture({ lateIgnoredDuringFinalGithub: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ignored file fingerprint changed/iu);
  assert.equal(existsSync(join(fixture.target, ".late", "arrived-during-github.txt")), true);
});

test("content arriving at the move boundary is quarantined and preserved", (t) => {
  const fixture = makeFixture({ lateIgnoredDuringMove: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /moved to quarantine/iu);
  assert.equal(existsSync(fixture.target), false);
  const roots = quarantineRoots(fixture);
  assert.equal(roots.length, 1);
  const quarantinedWorktree = join(roots[0], "worktree");
  assert.equal(existsSync(join(quarantinedWorktree, ".late", "arrived-during-move.txt")), true);
  assert.match(
    git(fixture, fixture.primary, ["worktree", "list", "--porcelain"]),
    new RegExp(quarantinedWorktree.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
  );
});

test("ignored content arriving after quarantine reinspection is never deleted", (t) => {
  const fixture = makeFixture({ lateIgnoredDuringRemove: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /content is preserved.*Git refused normal registration removal/iu);
  assert.equal(existsSync(fixture.target), false);
  const roots = quarantineRoots(fixture);
  assert.equal(roots.length, 1);
  assert.equal(existsSync(join(roots[0], "preserved-worktree", "README.md")), true);
  assert.equal(
    existsSync(join(roots[0], "worktree", ".late", "arrived-during-remove.txt")),
    true,
  );
  assert.match(
    git(fixture, fixture.primary, ["worktree", "list", "--porcelain"]),
    /codex\/gh-872-disposable/u,
  );
});

test("a broken symlink recreated at the original path blocks removal", (t) => {
  const fixture = makeFixture({ recreateOriginalSymlinkDuringMove: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { execute: true }),
    executionOptions(fixture),
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /original|atomic move|quarantine/iu);
  assert.equal(lstatSync(fixture.target).isSymbolicLink(), true);
  const roots = quarantineRoots(fixture);
  assert.equal(roots.length, 1);
  assert.equal(existsSync(join(roots[0], "worktree")), true);
});

test("the Homa wrapper rejects a target from a different common Git directory", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(
    process.execPath,
    wrapperArgs(fixture, { wrapper: wrapperSource }),
    { env: fixture.env },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /script repository common Git directory/iu);
  assert.equal(existsSync(fixture.target), true);
});
