import assert from "node:assert/strict";
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
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const guardSource = join(repositoryRoot, "scripts", "retire-damaged-worktree-registrations.mjs");
const githubOrigin = "https://github.com/sidneyswift/homa.git";
const realGit = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
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

function runGuard(fixture, args, environment = {}) {
  return run(process.execPath, [fixture.guard, ...args], {
    cwd: fixture.primary,
    env: { ...fixture.env, ...environment },
  });
}

function captureEvidence(fixture) {
  const inventory = runGuard(fixture, ["--inventory"]);
  assert.equal(inventory.status, 0, inventory.stderr);
  const evidence = JSON.parse(inventory.stdout);
  evidence.approval = {
    approvedBy: "sidneyswift",
    approvedAt: new Date().toISOString(),
    reason: "Reviewed damaged linked-worktree registrations",
  };
  writeFileSync(fixture.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

function assess(fixture) {
  return runGuard(fixture, ["--evidence", fixture.evidencePath]);
}

function execute(fixture, confirmation, environment = {}) {
  return runGuard(
    fixture,
    [
      "--evidence",
      fixture.evidencePath,
      "--execute",
      "--confirmation",
      confirmation,
    ],
    environment,
  );
}

function withFixture(t, options) {
  const fixture = makeFixture(options);
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  return fixture;
}

test("batch retirement preserves every byte and uses metadata-only prune", (t) => {
  const fixture = withFixture(t, {
    registrations: [{ name: "lane-one" }, { name: "lane-two", detached: true }],
  });
  const evidence = captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const assessment = JSON.parse(inspection.stdout);
  assert.equal(assessment.status, "SAFE_TO_RETIRE_DAMAGED_REGISTRATIONS");

  const result = execute(fixture, assessment.confirmation);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "DAMAGED_REGISTRATIONS_RETIRED");
  assert.equal(report.registrations.length, 2);
  for (const retired of report.registrations) {
    const source = fixture.registrations.find((entry) => entry.target === retired.originalPath);
    assert.equal(existsSync(retired.originalPath), false);
    assert.equal(existsSync(join(retired.preservedPath, "surviving-bytes.txt")), true);
    assert.equal(lstatSync(join(retired.preservedPath, "surviving-bytes.txt")).ino, source.sentinelInode);
    assert.equal(lstatSync(dirname(retired.preservedPath)).mode & 0o777, 0o700);
  }
  assert.equal(git(fixture.primary, ["worktree", "list", "--porcelain", "-z"]).includes("gh-900"), false);
  const commands = readFileSync(fixture.fakeGitLog, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(commands.some((args) => args.includes("prune") && args.includes(`--expire=${evidence.pruneCutoff}`)), true);
  assert.equal(commands.some((args) => args.includes("remove")), false);
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

  const result = runGuard(fixture, ["--evidence", join(evidenceAlias, "approved.json")]);
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

test("retires exactly proven metadata when the registered path is already absent", (t) => {
  const fixture = withFixture(t, { registrations: [{ name: "missing-lane", missingPath: true }] });
  const evidence = captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const result = execute(fixture, JSON.parse(inspection.stdout).confirmation);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.registrations[0].preservedPath, null);
  assert.equal(existsSync(fixture.registrations[0].manuallyPreservedPath), true);
  assert.equal(report.setSha256, evidence.setSha256);
});

test("blocks when a new stale registration makes the approved set incomplete", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  addDamagedRegistration(fixture, "unapproved-lane");
  const result = execute(fixture, `RETIRE DAMAGED REGISTRATIONS ignored`);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exact approved prunable set|set changed/iu);
  assert.equal(existsSync(fixture.registrations[0].target), true);
});

test("preserves and reports a path recreated immediately before prune", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const originalPath = fixture.registrations[0].target;
  const result = execute(fixture, JSON.parse(inspection.stdout).confirmation, {
    FAKE_GIT_LATE_PATH: originalPath,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.lateArrivalPaths, [originalPath]);
  assert.equal(readFileSync(join(originalPath, "arrived-late.txt"), "utf8"), "late bytes stay here\n");
  assert.equal(existsSync(report.registrations[0].preservedPath), true);
});

test("a stale registration created at prune time is too new for the fixed cutoff", (t) => {
  const fixture = withFixture(t);
  captureEvidence(fixture);
  const inspection = assess(fixture);
  assert.equal(inspection.status, 0, inspection.stderr);
  const newStalePath = join(fixture.root, "arrived-stale");
  const result = execute(fixture, JSON.parse(inspection.stdout).confirmation, {
    FAKE_GIT_NEW_STALE_PATH: newStalePath,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.newRegistrations.some((record) => record.path === newStalePath), true);
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
