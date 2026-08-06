import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wrapper = join(repositoryRoot, "scripts", "remove-worktree-safely.mjs");
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

function makeFakeGithub(binPath) {
  mkdirSync(binPath);
  const script = join(binPath, "gh");
  writeFileSync(
    script,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
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
  process.stdout.write("[]");
  process.exit(0);
}
process.stderr.write("Unexpected gh call: " + args.join(" ") + "\\n");
process.exit(1);
`,
  );
  chmodSync(script, 0o755);
}

function git(fixture, cwd, args) {
  return checked("git", args, { cwd, env: fixture.env });
}

function makeFixture({ localOnly = false, ignored = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "homa-worktree-wrapper-"));
  const remote = join(root, "remote.git");
  const primary = join(root, "primary");
  const target = join(root, "lane");
  const fakeBin = join(root, "bin");
  const evidencePath = join(root, "removal-evidence.json");
  const taskSnapshotPath = join(root, "task-snapshot.json");

  checked("git", ["init", "--bare", remote]);
  checked("git", ["init", "-b", "main", primary]);
  const env = {
    ...process.env,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${remote}.insteadOf`,
    GIT_CONFIG_VALUE_0: githubOrigin,
  };
  const fixture = { root, remote, primary, target, fakeBin, evidencePath, taskSnapshotPath, env };

  git(fixture, primary, ["config", "user.name", "Homa cleanup test"]);
  git(fixture, primary, ["config", "user.email", "cleanup-test@example.test"]);
  writeFileSync(join(primary, "README.md"), "Disposable worktree integration fixture.\n");
  if (ignored) writeFileSync(join(primary, ".gitignore"), ".cache/\n");
  git(fixture, primary, ["add", "."]);
  git(fixture, primary, ["commit", "-m", "test: create disposable repository"]);
  git(fixture, primary, ["remote", "add", "origin", githubOrigin]);
  git(fixture, primary, ["push", "-u", "origin", "main"]);
  git(fixture, primary, ["fetch", "origin", "main"]);
  git(fixture, primary, ["worktree", "add", "-b", "codex/gh-872-disposable", target, "origin/main"]);
  git(fixture, target, ["config", "user.name", "Homa cleanup test"]);
  git(fixture, target, ["config", "user.email", "cleanup-test@example.test"]);

  if (localOnly) {
    writeFileSync(join(target, "local-only.txt"), "Preserved only in the local bundle.\n");
    git(fixture, target, ["add", "local-only.txt"]);
    git(fixture, target, ["commit", "-m", "test: local-only recovery"]);
  }
  if (ignored) {
    mkdirSync(join(target, ".cache"));
    writeFileSync(join(target, ".cache", "generated.txt"), "regenerable\n");
  }

  makeFakeGithub(fakeBin);
  fixture.env = {
    ...fixture.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_GH_LOCAL_ONLY: localOnly ? "1" : "0",
  };

  const now = new Date().toISOString();
  const head = git(fixture, target, ["rev-parse", "HEAD"]);
  const tree = git(fixture, target, ["rev-parse", "HEAD^{tree}"]);
  const commonGitDir = realpathSync(git(fixture, target, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const gitDir = realpathSync(git(fixture, target, ["rev-parse", "--path-format=absolute", "--git-dir"]));
  const patchSha256 = createHash("sha256").update("").digest("hex");
  let recovery;
  if (localOnly) {
    const bundlePath = join(root, "recovery.bundle");
    git(fixture, target, ["bundle", "create", bundlePath, "codex/gh-872-disposable"]);
    const restored = join(root, "restored");
    checked("git", ["clone", "-b", "codex/gh-872-disposable", bundlePath, restored], { env: fixture.env });
    recovery = {
      kind: "bundle",
      sourceHead: head,
      sourceTree: tree,
      patchSha256,
      artifactPath: bundlePath,
      artifactSha256: sha256File(bundlePath),
      restoredHead: git(fixture, restored, ["rev-parse", "HEAD"]),
      restoredTree: git(fixture, restored, ["rev-parse", "HEAD^{tree}"]),
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
          path: ".cache/",
          disposition: "regenerable",
          reason: "Disposable generated fixture content.",
          decidedAt: now,
        },
      ]
    : [];
  const evidence = {
    schemaVersion: 1,
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
    task: { noMatchingTaskConfirmed: true },
    recovery,
  };
  const taskSnapshot = {
    schemaVersion: 1,
    source: "codex-list-threads",
    coverage: "all-open-and-recent-homa-tasks",
    capturedAt: now,
    repositoryOrigin: githubOrigin,
    tasks: [],
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(taskSnapshotPath, `${JSON.stringify(taskSnapshot, null, 2)}\n`);
  return fixture;
}

function wrapperArgs(fixture, { execute = false } = {}) {
  const args = [
    wrapper,
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
  return args;
}

test("the destructive executor removes only the proven disposable worktree", (t) => {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const result = run(process.execPath, wrapperArgs(fixture, { execute: true }), { env: fixture.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "REMOVED");
  assert.equal(existsSync(fixture.target), false);
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
  assert.match(rejected.stderr, /Exact ignored path inventory changed/u);
});
