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
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
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
const moveIndex = args.indexOf("move");
if (process.env.FAKE_GIT_LATE_IGNORED_ON_MOVE === "1" && moveIndex > 0 && args[moveIndex - 1] === "worktree") {
  const source = args[moveIndex + 1];
  mkdirSync(join(source, ".late"), { recursive: true });
  writeFileSync(join(source, ".late", "arrived-during-move.txt"), "must survive quarantine\\n");
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
  thinBundle = false,
  ignored = false,
  ignoredFilename = "generated.txt",
  ignoredPath,
  ignoredDisposition = "regenerable",
  taskless = false,
  lateIgnoredDuringFinalGithub = false,
  lateIgnoredDuringMove = false,
  recreateOriginalSymlinkDuringMove = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "homa-worktree-wrapper-"));
  const remote = join(root, "remote.git");
  const primary = join(root, "primary");
  const target = join(root, "lane");
  const fakeBin = join(root, "bin");
  const evidencePath = join(root, "removal-evidence.json");
  const taskSnapshotPath = join(root, "task-snapshot.json");
  const fakeGithubCounterPath = join(root, "fake-gh-counter.txt");
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
    env,
  };

  git(fixture, primary, ["config", "user.name", "Homa cleanup test"]);
  git(fixture, primary, ["config", "user.email", "cleanup-test@example.test"]);
  git(fixture, primary, ["config", `url.file://${remote}.insteadOf`, githubOrigin]);
  writeFileSync(join(primary, "README.md"), "Disposable worktree integration fixture.\n");
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
    FAKE_GH_LATE_IGNORED_CALL: lateIgnoredDuringFinalGithub ? "4" : "0",
    FAKE_GH_LATE_IGNORED_TARGET: target,
    FAKE_GH_ASSOCIATED_PULL: "0",
    FAKE_GIT_LATE_IGNORED_ON_MOVE: lateIgnoredDuringMove ? "1" : "0",
    FAKE_GIT_RECREATE_ORIGINAL_SYMLINK: recreateOriginalSymlinkDuringMove ? "1" : "0",
  };

  const now = new Date().toISOString();
  const head = git(fixture, target, ["rev-parse", "HEAD"]);
  fixture.env.FAKE_GH_ASSOCIATED_HEAD = head;
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
  const taskSnapshot = {
    schemaVersion: 1,
    source: "codex-list-threads",
    coverage: "all-open-and-recent-homa-tasks",
    capturedAt: now,
    repositoryOrigin: githubOrigin,
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

function quarantineRoots(fixture) {
  return readdirSync(fixture.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(".homa-worktree-quarantine-"))
    .map((entry) => join(fixture.root, entry.name));
}

test("the destructive executor removes only the proven disposable worktree", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), { env: fixture.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "REMOVED");
  assert.equal(existsSync(fixture.target), false);
  assert.deepEqual(quarantineRoots(fixture), []);
  assert.doesNotMatch(git(fixture, fixture.primary, ["worktree", "list", "--porcelain"]), /codex\/gh-872-disposable/u);
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

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), { env: fixture.env });
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

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), { env: fixture.env });
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

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), { env: fixture.env });
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
    ".cache/signing.p12",
    ".cache/signing.pfx",
    ".cache/release.jks",
    ".cache/client.ppk",
    ".cache/signing.pkcs12",
    ".cache/release.truststore",
    ".cache/certificate.cer",
    ".cache/private.key",
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

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), {
    env: fixture.env,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ignored file fingerprint changed/iu);
  assert.equal(existsSync(join(fixture.target, ".late", "arrived-during-github.txt")), true);
});

test("content arriving at the move boundary is quarantined and preserved", (t) => {
  const fixture = makeFixture({ lateIgnoredDuringMove: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), {
    env: fixture.env,
  });
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

test("a broken symlink recreated at the original path blocks removal", (t) => {
  const fixture = makeFixture({ recreateOriginalSymlinkDuringMove: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), {
    env: fixture.env,
  });
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
