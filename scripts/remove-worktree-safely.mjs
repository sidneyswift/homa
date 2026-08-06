#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;
const TASK_SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;
const EXECUTION_TASK_REFRESH_MAX_AGE_MS = 30 * 1000;
const ACTIVE_TASK_STATES = new Set([
  "active",
  "idle",
  "in_progress",
  "needs_input",
  "pending",
  "running",
  "waiting",
]);
const IGNORED_DISPOSITIONS = new Set([
  "backed-up-private",
  "discard-approved",
  "regenerable",
]);
const IGNORED_FILE_KINDS = new Set(["file", "symlink"]);
const SENSITIVE_IGNORED_FILENAMES = new Set([
  ".git-credentials",
  ".netrc",
  ".npmrc",
  ".pgpass",
  "auth.json",
  "google-services.json",
  "googleservice-info.plist",
  "kubeconfig",
  "release.keystore",
  "service-account.json",
  "service_account.json",
]);
const SENSITIVE_IGNORED_NAME =
  /(?:^|[._-])(?:access[_-]?token|api[_-]?(?:key|token)|client[_-]?secret|credentials?|passw(?:or)?d|private[_-]?key|refresh[_-]?token|secrets?|service[_-]?account|tokens?)(?:[._-]|$)/u;
const TASKLESS_APPROVER = "sidneyswift";
const TASKLESS_REASON = "legacy-lane-predates-task-tracking";
const CLEANUP_NEXT_STEP = "cleanup-coordinator-remove-worktree";
const SCRIPT_PATH = realpathSync(fileURLToPath(import.meta.url));

export class RemovalBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "RemovalBlockedError";
  }
}

function block(message) {
  throw new RemovalBlockedError(message);
}

function sanitizedSubprocessEnvironment(inputEnvironment = process.env) {
  const environment = {};
  for (const [key, value] of Object.entries(inputEnvironment)) {
    if (!key.toUpperCase().startsWith("GIT_")) environment[key] = value;
  }
  return {
    ...environment,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function commandResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: sanitizedSubprocessEnvironment(options.env ?? process.env),
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) block(`Could not run ${command}: ${result.error.message}`);
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function checked(command, args, options) {
  const result = commandResult(command, args, options);
  if (result.status !== 0) {
    block(`${command} ${args.join(" ")} failed: ${result.stderr.trim() || "no error text"}`);
  }
  return result.stdout;
}

function git(path, args) {
  return checked("git", ["-C", path, ...args]);
}

function gitResult(path, args) {
  return commandResult("git", ["-C", path, ...args]);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    block(`${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    block(`${label} must contain one JSON object.`);
  }
  return parsed;
}

function parseCommandJson(output, label) {
  try {
    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object") block(`${label} returned no JSON object.`);
    return parsed;
  } catch (error) {
    block(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    block(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    block(`${label} changed. Expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`);
  }
}

function parsedTime(value, label) {
  const time = Date.parse(requiredString(value, label));
  if (!Number.isFinite(time)) block(`${label} must be an ISO timestamp.`);
  return time;
}

function assertFresh(value, label, maxAgeMs, now) {
  const time = parsedTime(value, label);
  if (time > now) block(`${label} is in the future.`);
  if (now - time > maxAgeMs) block(`${label} is stale. Capture it again immediately before removal.`);
  return time;
}

function isInside(path, parent) {
  const pathFromParent = relative(parent, path);
  return pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== "..");
}

function absoluteRealPath(path, label) {
  if (!isAbsolute(path)) block(`${label} must be an absolute path.`);
  try {
    return realpathSync(path);
  } catch (error) {
    block(`${label} does not resolve: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function pathEntryExists(path, label) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    block(`Could not inspect ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function normalizeOrigin(value) {
  const origin = requiredString(value, "origin").trim();
  if (origin.startsWith("file://")) return realpathSync(new URL(origin));
  if (origin.startsWith("/")) return absoluteRealPath(origin, "origin");
  const withoutGitSuffix = origin.replace(/\.git$/u, "");
  const sshMatch = withoutGitSuffix.match(/^git@([^:]+):(.+)$/u);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;
  return withoutGitSuffix.replace(/\/$/u, "");
}

export function githubRepositoryFromOrigin(value) {
  const origin = normalizeOrigin(value);
  const match = origin.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/u);
  if (!match) block(`Origin ${origin} is not a GitHub repository.`);
  return `${match[1]}/${match[2]}`;
}

export function parseWorktreePorcelain(output) {
  const records = [];
  let record = null;
  for (const token of output.split("\0")) {
    if (token === "") {
      if (record) records.push(record);
      record = null;
      continue;
    }
    const separator = token.indexOf(" ");
    const key = separator === -1 ? token : token.slice(0, separator);
    const value = separator === -1 ? true : token.slice(separator + 1);
    if (key === "worktree") record = { worktree: value };
    else if (record) record[key] = value;
  }
  if (record) records.push(record);
  return records;
}

function comparePaths(left, right) {
  if (left.path < right.path) return -1;
  if (left.path > right.path) return 1;
  return 0;
}

function isSensitiveIgnoredPath(path) {
  const segments = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const leaf = lowerSegments.at(-1) ?? "";
  const parent = lowerSegments.at(-2) ?? "";

  if (lowerSegments.some((segment) => segment === ".aws" || segment === ".ssh")) return true;
  if (parent === ".docker" && leaf === "config.json") return true;
  if (/^\.env(?:\.|$)/u.test(leaf)) return true;
  if (/^config\.local(?:\.|$)/u.test(leaf)) return true;
  if (/\.(?:crt|jks|key|keystore|p12|pem|pfx)$/u.test(leaf)) return true;
  if (SENSITIVE_IGNORED_FILENAMES.has(leaf)) return true;
  if (/^id_(?:dsa|ecdsa|ed25519|rsa)(?:\.pub)?$/u.test(leaf)) return true;
  return lowerSegments.some((segment) => SENSITIVE_IGNORED_NAME.test(segment));
}

function sameFileState(left, right) {
  return ["dev", "ino", "mode", "size", "mtimeNs"].every(
    (field) => String(left[field]) === String(right[field]),
  );
}

function ignoredFileFingerprint(target, path) {
  if (isAbsolute(path)) block(`Ignored path ${JSON.stringify(path)} must be relative.`);
  const absolutePath = resolve(target, path);
  if (absolutePath === target || !isInside(absolutePath, target)) {
    block(`Ignored path ${JSON.stringify(path)} escapes the target worktree.`);
  }

  let before;
  try {
    before = lstatSync(absolutePath, { bigint: true });
  } catch (error) {
    block(
      `Ignored path ${JSON.stringify(path)} disappeared during inspection: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let kind;
  let content;
  if (before.isFile()) {
    kind = "file";
    content = readFileSync(absolutePath);
  } else if (before.isSymbolicLink()) {
    kind = "symlink";
    content = readlinkSync(absolutePath, { encoding: "buffer" });
  } else {
    block(`Ignored path ${JSON.stringify(path)} has unsupported file type.`);
  }

  const after = lstatSync(absolutePath, { bigint: true });
  if (!sameFileState(before, after)) {
    block(`Ignored path ${JSON.stringify(path)} changed while it was being fingerprinted.`);
  }
  return {
    path,
    kind,
    sizeBytes: String(before.size),
    sha256: sha256(content),
  };
}

function ignoredEntriesFromGit(target) {
  const output = git(target, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "-z",
  ]);
  const paths = output.split("\0").filter(Boolean);
  if (new Set(paths).size !== paths.length) block("Git returned a duplicate ignored path.");
  return paths.map((path) => ignoredFileFingerprint(target, path)).sort(comparePaths);
}

function inspectScriptRepository() {
  const scriptDirectory = dirname(SCRIPT_PATH);
  const root = absoluteRealPath(
    git(scriptDirectory, ["rev-parse", "--show-toplevel"]).trim(),
    "script repository root",
  );
  return {
    root,
    commonGitDir: absoluteRealPath(
      git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim(),
      "script repository common Git directory",
    ),
    origin: normalizeOrigin(git(root, ["config", "--get", "remote.origin.url"]).trim()),
  };
}

function currentBranch(path) {
  const result = gitResult(path, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (result.status === 1) return null;
  if (result.status !== 0) block(`Could not resolve the branch: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function branchIssueNumber(branch) {
  if (!branch) return null;
  const match = branch.match(/^codex\/gh-(\d+)-/u);
  return match ? Number(match[1]) : null;
}

function inspectBundle(path, target, expectedHead, expectedTree, objectFormat) {
  const artifact = absoluteRealPath(path, "recovery.artifactPath");
  const privateTmp = resolve("/private/tmp");
  if (isInside(artifact, privateTmp)) block("The recovery artifact is under /private/tmp and is not durable.");
  if (isInside(artifact, target)) block("The recovery artifact is inside the worktree it protects.");
  if (!statSync(artifact).isFile()) block("The recovery artifact must be a file.");
  const artifactSha256 = sha256(readFileSync(artifact));
  checked("git", ["bundle", "verify", artifact], { cwd: target });
  const advertisedHeads = checked("git", ["bundle", "list-heads", artifact], { cwd: target })
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [head, reference] = line.split(/\s+/u);
      return { head, reference };
    });
  const advertised = advertisedHeads.find((entry) => entry.head === expectedHead);
  if (!advertised) block("The recovery bundle does not advertise the source HEAD.");

  const restoreRoot = mkdtempSync(join(tmpdir(), "homa-worktree-bundle-restore-"));
  const restoreRepository = join(restoreRoot, "restored.git");
  try {
    checked("git", ["init", "--bare", "--template=", `--object-format=${objectFormat}`, restoreRepository]);
    for (const name of ["alternates", "http-alternates"]) {
      if (existsSync(join(restoreRepository, "objects", "info", name))) {
        block(`The empty restore repository inherited ${name} object indirection.`);
      }
    }
    checked("git", [
      "-C",
      restoreRepository,
      "-c",
      "fetch.fsckObjects=true",
      "fetch",
      "--no-tags",
      artifact,
      `${advertised.reference}:refs/heads/recovered`,
    ]);
    for (const name of ["alternates", "http-alternates"]) {
      if (existsSync(join(restoreRepository, "objects", "info", name))) {
        block(`The bundle restore introduced ${name} object indirection.`);
      }
    }
    checked("git", [
      "-C",
      restoreRepository,
      "fsck",
      "--full",
      "--strict",
      "--no-dangling",
      "refs/heads/recovered",
    ]);
    const restoredHead = checked("git", ["-C", restoreRepository, "rev-parse", "refs/heads/recovered"]).trim();
    const restoredTree = checked(
      "git",
      ["-C", restoreRepository, "rev-parse", "refs/heads/recovered^{tree}"],
    ).trim();
    assertEqual(restoredHead, expectedHead, "Restored bundle head");
    assertEqual(restoredTree, expectedTree, "Restored bundle tree");
    assertEqual(sha256(readFileSync(artifact)), artifactSha256, "Recovery bundle content during restore");
    return {
      artifact,
      artifactSha256,
      heads: advertisedHeads.map((entry) => entry.head),
      restoredHead,
      restoredTree,
    };
  } finally {
    rmSync(restoreRoot, { recursive: true, force: true });
  }
}

export function inspectLocalState(targetInput, evidence, expectedRepository = inspectScriptRepository()) {
  const target = absoluteRealPath(targetInput, "target");
  const topLevel = absoluteRealPath(git(target, ["rev-parse", "--show-toplevel"]).trim(), "worktree root");
  assertEqual(target, topLevel, "Target worktree root");

  const worktrees = parseWorktreePorcelain(git(target, ["worktree", "list", "--porcelain", "-z"]));
  if (worktrees.length === 0) block("Git reported no registered worktrees.");
  const repositoryRoot = absoluteRealPath(worktrees[0].worktree, "primary worktree");
  if (target === repositoryRoot) block("The primary integration worktree cannot be removed by this wrapper.");
  const exactRecords = worktrees.filter((record) => {
    try {
      return absoluteRealPath(record.worktree, "registered worktree") === target;
    } catch {
      return false;
    }
  });
  if (exactRecords.length !== 1) block(`Expected one exact registered worktree record, found ${exactRecords.length}.`);
  const registeredPath = resolve(exactRecords[0].worktree);

  const gitDir = absoluteRealPath(
    git(target, ["rev-parse", "--path-format=absolute", "--git-dir"]).trim(),
    "Git directory",
  );
  const commonGitDir = absoluteRealPath(
    git(target, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim(),
    "common Git directory",
  );
  const repositoryCommonGitDir = absoluteRealPath(
    git(repositoryRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim(),
    "primary common Git directory",
  );
  assertEqual(commonGitDir, repositoryCommonGitDir, "Common Git directory");
  assertEqual(
    commonGitDir,
    expectedRepository.commonGitDir,
    "Target compared with script repository common Git directory",
  );

  const origin = normalizeOrigin(git(target, ["config", "--get", "remote.origin.url"]).trim());
  const repositoryOrigin = normalizeOrigin(
    git(repositoryRoot, ["config", "--get", "remote.origin.url"]).trim(),
  );
  assertEqual(origin, repositoryOrigin, "Origin identity");
  assertEqual(origin, expectedRepository.origin, "Target compared with script repository origin");

  const head = git(target, ["rev-parse", "HEAD"]).trim();
  const tree = git(target, ["rev-parse", "HEAD^{tree}"]).trim();
  const objectFormat = git(target, ["rev-parse", "--show-object-format"]).trim();
  const branch = currentBranch(target);
  const baseRef = evidence?.worktree?.baseRef ?? "origin/main";
  const baseBranchMatch = baseRef.match(/^origin\/(.+)$/u);
  if (!baseBranchMatch) block("The base reference must name a trusted origin branch.");
  const baseResult = gitResult(target, ["rev-parse", "--verify", baseRef]);
  if (baseResult.status !== 0) block(`Base reference ${baseRef} cannot be verified.`);
  const localBaseHead = baseResult.stdout.trim();
  const remoteBase = git(target, ["ls-remote", "--heads", "origin", `refs/heads/${baseBranchMatch[1]}`]).trim();
  const remoteBaseHead = remoteBase ? remoteBase.split(/\s+/u)[0] : null;
  assertEqual(localBaseHead, remoteBaseHead, `Local base ${baseRef} compared with its remote`);

  const uniqueCommitCount = Number(git(target, ["rev-list", "--count", `${baseRef}..HEAD`]).trim());
  const integrated = gitResult(target, ["merge-base", "--is-ancestor", "HEAD", baseRef]).status === 0;
  let remoteHead = null;
  let bundle = null;
  if (evidence?.recovery?.kind === "remote-branch") {
    if (!branch) block("A detached worktree cannot use remote-branch recovery.");
    const reference = requiredString(evidence.recovery.reference, "recovery.reference");
    const remote = git(target, ["ls-remote", "--heads", "origin", reference]).trim();
    remoteHead = remote ? remote.split(/\s+/u)[0] : null;
  } else if (evidence?.recovery?.kind === "bundle") {
    bundle = inspectBundle(evidence.recovery.artifactPath, target, head, tree, objectFormat);
  }

  const statusLines = git(target, ["status", "--porcelain=v2", "--untracked-files=all"])
    .split("\n")
    .filter(Boolean);
  const patchSha256 = sha256(git(target, ["diff", "--binary", "HEAD", "--"]));
  const ignoredEntries = ignoredEntriesFromGit(target);

  return {
    target,
    registeredPath,
    repositoryRoot,
    gitDir,
    commonGitDir,
    origin,
    head,
    tree,
    branch,
    baseRef,
    uniqueCommitCount,
    integrated,
    statusLines,
    ignoredEntries,
    patchSha256,
    remoteHead,
    bundle,
  };
}

function inspectGithub(current, issueNumber, handoffUrl, recoveryKind) {
  const repository = githubRepositoryFromOrigin(current.origin);
  const branchPulls = current.branch
    ? parseCommandJson(
        checked("gh", [
          "pr",
          "list",
          "--repo",
          repository,
          "--state",
          "open",
          "--head",
          current.branch,
          "--json",
          "number,url,headRefOid,headRefName",
        ]),
        "GitHub pull request lookup",
      )
    : [];

  const commitPullResult = commandResult("gh", [
    "api",
    `repos/${repository}/commits/${current.head}/pulls`,
    "--header",
    "Accept: application/vnd.github+json",
  ]);
  let associatedPullRequests = [];
  if (commitPullResult.status === 0) {
    associatedPullRequests = parseCommandJson(commitPullResult.stdout, "GitHub commit pull request lookup")
      .map((pull) => ({
        number: pull.number,
        url: pull.html_url,
        headRefOid: pull.head?.sha ?? null,
        headRefName: pull.head?.ref ?? null,
        state: pull.state,
      }));
  } else {
    const missingLocalOnlyCommit = /\(HTTP (?:404|422)\)/u.test(commitPullResult.stderr);
    if (recoveryKind !== "bundle" || !missingLocalOnlyCommit) {
      block(`Could not inspect pull requests for ${current.head}: ${commitPullResult.stderr.trim()}`);
    }
  }

  const pullMap = new Map();
  for (const pull of [
    ...branchPulls,
    ...associatedPullRequests.filter((pull) => pull.state === "open"),
  ]) {
    pullMap.set(pull.number, pull);
  }
  const issue = parseCommandJson(
    checked("gh", ["issue", "view", String(issueNumber), "--repo", repository, "--json", "number,state,url"]),
    "GitHub issue lookup",
  );

  let handoffComment = null;
  if (typeof handoffUrl === "string" && handoffUrl !== "") {
    const commentMatch = handoffUrl.match(/#issuecomment-(\d+)$/u);
    if (!commentMatch) block("The issue handoff URL has no GitHub issue comment ID.");
    const comment = parseCommandJson(
      checked("gh", ["api", `repos/${repository}/issues/comments/${commentMatch[1]}`]),
      "GitHub issue handoff lookup",
    );
    handoffComment = { url: comment.html_url, issueUrl: comment.issue_url, body: comment.body };
  }
  return {
    repository,
    openPullRequests: [...pullMap.values()],
    associatedPullRequests,
    issue,
    handoffComment,
  };
}

function validateHandoff(handoff, taskId, current, github, now) {
  if (!handoff || typeof handoff !== "object") block(`Task ${taskId} has no recorded handoff.`);
  for (const field of [
    "outcome",
    "issue",
    "branch",
    "worktree",
    "commitOrPr",
    "productionState",
    "nextStep",
  ]) {
    requiredString(handoff[field], `Task ${taskId} handoff.${field}`);
  }
  const recordedAt = parsedTime(handoff.recordedAt, `Task ${taskId} handoff.recordedAt`);
  if (recordedAt > now) block(`Task ${taskId} handoff.recordedAt is in the future.`);
  if (current.branch) assertEqual(handoff.branch, current.branch, `Task ${taskId} handoff branch`);
  assertEqual(
    absoluteRealPath(handoff.worktree, `Task ${taskId} handoff worktree`),
    current.target,
    `Task ${taskId} handoff worktree`,
  );
  const exactIssueReferences = new Set([`#${github.issue.number}`, github.issue.url]);
  if (!exactIssueReferences.has(handoff.issue)) {
    block(`Task ${taskId} handoff points to a different issue.`);
  }

  const commitUrl = `https://github.com/${github.repository}/commit/${current.head}`;
  const associatedPull = github.associatedPullRequests.find(
    (pull) => pull.url === handoff.commitOrPr && pull.headRefOid === current.head,
  );
  if (handoff.commitOrPr !== current.head && handoff.commitOrPr !== commitUrl && !associatedPull) {
    block(`Task ${taskId} handoff.commitOrPr must exactly name HEAD or an associated pull request.`);
  }

  const checks = handoff.checks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    block(`Task ${taskId} handoff.checks must be an object that records executed checks.`);
  }
  if (checks.executed !== true) block(`Task ${taskId} handoff.checks.executed must be true.`);
  if (checks.status !== "passed") block(`Task ${taskId} handoff.checks.status must be passed.`);
  if (
    !Array.isArray(checks.commands) ||
    checks.commands.length === 0 ||
    checks.commands.some((command) => typeof command !== "string" || command.trim() === "")
  ) {
    block(`Task ${taskId} handoff.checks.commands must list at least one executed command.`);
  }
  const checksCompletedAt = parsedTime(
    checks.completedAt,
    `Task ${taskId} handoff.checks.completedAt`,
  );
  if (checksCompletedAt > now) block(`Task ${taskId} handoff.checks.completedAt is in the future.`);
  assertEqual(handoff.nextStep, CLEANUP_NEXT_STEP, `Task ${taskId} handoff nextStep`);
  if (handoff.handoffComplete !== true) {
    block(`Task ${taskId} handoff.handoffComplete must be true.`);
  }
}

export function validateTaskSnapshot(
  snapshot,
  current,
  evidence,
  {
    now = Date.now(),
    maxAgeMs = TASK_SNAPSHOT_MAX_AGE_MS,
    legacyTasklessConfirmation,
    github,
  } = {},
) {
  if (snapshot.schemaVersion !== 1) block("Task snapshot schemaVersion must be 1.");
  if (snapshot.source !== "codex-list-threads") {
    block("Task snapshot source must be codex-list-threads.");
  }
  if (snapshot.coverage !== "all-open-and-recent-homa-tasks") {
    block("Task snapshot must cover all open and recent Homa tasks.");
  }
  assertFresh(snapshot.capturedAt, "Task snapshot capturedAt", maxAgeMs, now);
  assertEqual(normalizeOrigin(snapshot.repositoryOrigin), current.origin, "Task snapshot repository origin");
  if (!Array.isArray(snapshot.tasks)) block("Task snapshot tasks must be an array.");
  if (!github || typeof github !== "object") block("Verified GitHub state is required for task validation.");

  const matchingTasks = snapshot.tasks.filter((task) => {
    let taskWorktree = null;
    if (typeof task.worktree === "string") {
      try {
        taskWorktree = realpathSync(task.worktree);
      } catch {
        taskWorktree = resolve(task.worktree);
      }
    }
    return task.branch === current.branch || taskWorktree === current.target;
  });
  for (const task of matchingTasks) {
    const taskId = requiredString(task.id, "task.id");
    const status = requiredString(task.status, `Task ${taskId} status`);
    if (ACTIVE_TASK_STATES.has(status.toLowerCase())) block(`Task ${taskId} is still ${status} in this lane.`);
    if (status !== "completed") {
      block(`Task ${taskId} status must be completed, found ${status}.`);
    }
    if (current.branch) assertEqual(task.branch, current.branch, `Task ${taskId} branch`);
    assertEqual(
      absoluteRealPath(requiredString(task.worktree, `Task ${taskId} worktree`), `Task ${taskId} worktree`),
      current.target,
      `Task ${taskId} worktree`,
    );
    validateHandoff(task.handoff, taskId, current, github, now);
  }
  if (matchingTasks.length === 0) {
    const expectedConfirmation = `ALLOW TASKLESS ${current.target}`;
    if (legacyTasklessConfirmation !== expectedConfirmation) {
      block(
        "Automatic removal requires a matching finished task with a handoff. " +
          `A legacy taskless lane needs --legacy-taskless-confirmation ${JSON.stringify(expectedConfirmation)}.`,
      );
    }
    const override = evidence.task?.legacyTasklessOverride;
    if (!override || typeof override !== "object") {
      block("A legacy taskless lane needs evidence.task.legacyTasklessOverride.");
    }
    assertEqual(
      requiredString(override.approvedBy, "task.legacyTasklessOverride.approvedBy"),
      TASKLESS_APPROVER,
      "task.legacyTasklessOverride.approvedBy",
    );
    assertEqual(
      requiredString(override.reason, "task.legacyTasklessOverride.reason"),
      TASKLESS_REASON,
      "task.legacyTasklessOverride.reason",
    );
    assertFresh(
      override.approvedAt,
      "task.legacyTasklessOverride.approvedAt",
      EVIDENCE_MAX_AGE_MS,
      now,
    );
  } else if (legacyTasklessConfirmation !== undefined) {
    block("A legacy taskless confirmation cannot be used when a matching task exists.");
  }

  if (evidence.issue?.disposition === "replacement-active") {
    const replacement = evidence.issue.replacement;
    if (!replacement || typeof replacement !== "object") {
      block("A replacement-active issue needs replacement lane evidence.");
    }
    for (const field of ["taskId", "branch", "worktree", "oldLaneFrozenAt"]) {
      requiredString(replacement[field], `issue.replacement.${field}`);
    }
    const oldLaneFrozenAt = parsedTime(
      replacement.oldLaneFrozenAt,
      "issue.replacement.oldLaneFrozenAt",
    );
    if (oldLaneFrozenAt > now) block("issue.replacement.oldLaneFrozenAt is in the future.");
    const replacementTask = snapshot.tasks.find((task) => task.id === replacement.taskId);
    if (!replacementTask) block("The replacement task is absent from the fresh task snapshot.");
    if (!ACTIVE_TASK_STATES.has(String(replacementTask.status).toLowerCase())) {
      block("The replacement task is not active in the fresh task snapshot.");
    }
    assertEqual(replacementTask.branch, replacement.branch, "Replacement branch");
    assertEqual(
      resolve(requiredString(replacementTask.worktree, "Replacement task worktree")),
      resolve(replacement.worktree),
      "Replacement worktree",
    );
  }
  return matchingTasks;
}

function validateIgnoredDispositions(current, evidence, now) {
  const decisions = evidence.worktree.ignoredDispositions ?? [];
  if (!Array.isArray(decisions)) block("worktree.ignoredDispositions must be an array.");
  const fingerprints = decisions
    .map((decision) => ({
      path: requiredString(decision?.path, "ignored disposition path"),
      kind: requiredString(decision?.kind, `Ignored path ${decision?.path} kind`),
      sizeBytes: requiredString(decision?.sizeBytes, `Ignored path ${decision?.path} sizeBytes`),
      sha256: requiredString(decision?.sha256, `Ignored path ${decision?.path} sha256`),
    }))
    .sort(comparePaths);
  for (const fingerprint of fingerprints) {
    if (!IGNORED_FILE_KINDS.has(fingerprint.kind)) {
      block(`Ignored path ${fingerprint.path} has unknown kind ${fingerprint.kind}.`);
    }
    if (!/^\d+$/u.test(fingerprint.sizeBytes)) {
      block(`Ignored path ${fingerprint.path} sizeBytes must be an unsigned integer string.`);
    }
    if (!/^[a-f0-9]{64}$/u.test(fingerprint.sha256)) {
      block(`Ignored path ${fingerprint.path} sha256 must be a lowercase SHA-256 digest.`);
    }
  }
  assertEqual(
    JSON.stringify(fingerprints),
    JSON.stringify(current.ignoredEntries),
    "Exact ignored file fingerprint",
  );
  const paths = fingerprints.map((fingerprint) => fingerprint.path);
  if (new Set(paths).size !== paths.length) block("Ignored path decisions contain a duplicate path.");

  for (const decision of decisions) {
    const disposition = requiredString(decision.disposition, `Ignored path ${decision.path} disposition`);
    if (!IGNORED_DISPOSITIONS.has(disposition)) {
      block(`Ignored path ${decision.path} has unknown disposition ${disposition}.`);
    }
    requiredString(decision.reason, `Ignored path ${decision.path} reason`);
    const decidedAt = parsedTime(decision.decidedAt, `Ignored path ${decision.path} decidedAt`);
    if (decidedAt > now) block(`Ignored path ${decision.path} decision is in the future.`);
    if (isSensitiveIgnoredPath(decision.path) && disposition === "regenerable") {
      block(`Sensitive ignored path ${decision.path} cannot be classified as regenerable.`);
    }
    if (disposition === "backed-up-private") {
      requiredString(decision.recoveryReference, `Ignored path ${decision.path} recoveryReference`);
    }
  }
  return decisions;
}

function validateRecovery(current, recovery, now) {
  if (!recovery || typeof recovery !== "object") block("Recovery evidence is required.");
  assertEqual(recovery.sourceHead, current.head, "Recovery source head");
  assertEqual(recovery.sourceTree, current.tree, "Recovery source tree");
  assertEqual(recovery.patchSha256, current.patchSha256, "Recovery patch checksum");
  assertEqual(recovery.restoredHead, current.head, "Restored head");
  assertEqual(recovery.restoredTree, current.tree, "Restored tree");
  const restoreTestedAt = parsedTime(recovery.restoreTestedAt, "recovery.restoreTestedAt");
  if (restoreTestedAt > now) block("recovery.restoreTestedAt is in the future.");

  if (recovery.kind === "integrated") {
    if (!current.integrated || current.uniqueCommitCount !== 0) {
      block(`HEAD is not integrated into ${current.baseRef}.`);
    }
    return;
  }
  if (recovery.kind === "remote-branch") {
    const expectedReference = current.branch ? `refs/heads/${current.branch}` : null;
    assertEqual(recovery.reference, expectedReference, "Recovery remote reference");
    assertEqual(current.remoteHead, current.head, "Recovery remote head");
    return;
  }
  if (recovery.kind === "bundle") {
    if (!current.bundle) block("Bundle recovery was not inspected.");
    assertEqual(current.bundle.artifactSha256, recovery.artifactSha256, "Recovery bundle checksum");
    if (!current.bundle.heads.includes(current.head)) block("The recovery bundle does not advertise the source HEAD.");
    assertEqual(current.bundle.restoredHead, current.head, "Recovery bundle restored head");
    assertEqual(current.bundle.restoredTree, current.tree, "Recovery bundle restored tree");
    assertEqual(recovery.restoredHead, current.bundle.restoredHead, "Evidence restored bundle head");
    assertEqual(recovery.restoredTree, current.bundle.restoredTree, "Evidence restored bundle tree");
    return;
  }
  block(`Unknown recovery kind ${JSON.stringify(recovery.kind)}.`);
}

export function assessRemoval({
  current,
  evidence,
  taskSnapshot,
  github,
  now = Date.now(),
  taskMaxAgeMs = TASK_SNAPSHOT_MAX_AGE_MS,
  legacyTasklessConfirmation,
}) {
  if (evidence.schemaVersion !== 2) block("Evidence schemaVersion must be 2.");
  assertFresh(evidence.capturedAt, "Evidence capturedAt", EVIDENCE_MAX_AGE_MS, now);
  assertEqual(
    absoluteRealPath(evidence.repository.root, "evidence repository root"),
    current.repositoryRoot,
    "Repository root",
  );
  assertEqual(
    absoluteRealPath(evidence.repository.commonGitDir, "evidence common Git directory"),
    current.commonGitDir,
    "Evidence common Git directory",
  );
  assertEqual(normalizeOrigin(evidence.repository.origin), current.origin, "Evidence origin");
  assertEqual(
    absoluteRealPath(evidence.worktree.path, "evidence worktree path"),
    current.target,
    "Evidence worktree path",
  );
  const evidenceRegisteredPath = requiredString(evidence.worktree.registeredPath, "evidence worktree registeredPath");
  if (!isAbsolute(evidenceRegisteredPath)) block("evidence worktree registeredPath must be absolute.");
  assertEqual(resolve(evidenceRegisteredPath), current.registeredPath, "Evidence registered worktree path");
  assertEqual(
    absoluteRealPath(evidence.worktree.gitDir, "evidence Git directory"),
    current.gitDir,
    "Evidence Git directory",
  );
  assertEqual(evidence.worktree.head, current.head, "Evidence HEAD");
  assertEqual(evidence.worktree.tree, current.tree, "Evidence tree");
  assertEqual(evidence.worktree.branch ?? null, current.branch, "Evidence branch");
  assertEqual(evidence.worktree.baseRef, current.baseRef, "Evidence base reference");
  assertEqual(evidence.worktree.patchSha256, current.patchSha256, "Evidence patch checksum");

  if (current.statusLines.length > 0) {
    block(`Worktree has tracked or untracked changes: ${current.statusLines.slice(0, 5).join(" | ")}`);
  }
  const ignoredDecisions = validateIgnoredDispositions(current, evidence, now);
  if (github.openPullRequests.length > 0) {
    block(`Worktree has open pull request(s): ${github.openPullRequests.map((pull) => `#${pull.number}`).join(", ")}`);
  }

  const expectedIssue = branchIssueNumber(current.branch) ?? evidence.issue?.number;
  if (!Number.isInteger(expectedIssue)) block("Evidence must name the owning issue number.");
  assertEqual(evidence.issue.number, expectedIssue, "Evidence issue number");
  assertEqual(github.issue.number, expectedIssue, "GitHub issue number");
  assertEqual(evidence.issue.state, github.issue.state, "GitHub issue state");
  assertEqual(evidence.issue.url, github.issue.url, "GitHub issue URL");
  if (github.issue.state === "CLOSED") {
    assertEqual(evidence.issue.disposition, "closed", "Closed issue disposition");
  } else if (github.issue.state === "OPEN") {
    if (!["replacement-active", "updated-open"].includes(evidence.issue.disposition)) {
      block("An open issue needs updated-open or replacement-active disposition.");
    }
    const handoffUrl = requiredString(evidence.issue.handoffUrl, "issue.handoffUrl");
    if (!handoffUrl.startsWith(`${github.issue.url}#issuecomment-`)) {
      block("The issue handoff URL must be a comment on the owning issue.");
    }
    if (!github.handoffComment) block("The issue handoff comment was not verified on GitHub.");
    assertEqual(github.handoffComment.url, handoffUrl, "GitHub issue handoff URL");
    if (!github.handoffComment.issueUrl.endsWith(`/issues/${expectedIssue}`)) {
      block("The verified handoff comment belongs to a different issue.");
    }
    const handoffBody = requiredString(github.handoffComment.body, "GitHub issue handoff body");
    for (const fact of [current.target, current.head, current.branch].filter(Boolean)) {
      if (!handoffBody.includes(fact)) block(`The verified issue handoff does not contain ${fact}.`);
    }
    if (evidence.issue.disposition === "replacement-active") {
      for (const fact of [evidence.issue.replacement?.branch, evidence.issue.replacement?.worktree].filter(Boolean)) {
        if (!handoffBody.includes(fact)) block(`The verified replacement handoff does not contain ${fact}.`);
      }
    }
  } else {
    block(`GitHub issue has unknown state ${github.issue.state}.`);
  }

  const matchingTasks = validateTaskSnapshot(taskSnapshot, current, evidence, {
    now,
    maxAgeMs: taskMaxAgeMs,
    legacyTasklessConfirmation,
    github,
  });
  validateRecovery(current, evidence.recovery, now);
  return {
    status: "SAFE_TO_REMOVE",
    target: current.target,
    branch: current.branch,
    head: current.head,
    issue: expectedIssue,
    uniqueCommitCount: current.uniqueCommitCount,
    ignoredPathDecisions: ignoredDecisions.length,
    matchingTaskIds: matchingTasks.map((task) => task.id),
    recovery: evidence.recovery.kind,
    remoteBranchAction: "keep",
    confirmation: `REMOVE ${current.target}`,
  };
}

function parseArgs(argv) {
  const options = { execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") options.execute = true;
    else if (argument === "--target") options.target = argv[++index];
    else if (argument === "--evidence") options.evidence = argv[++index];
    else if (argument === "--task-snapshot") options.taskSnapshot = argv[++index];
    else if (argument === "--confirmation") options.confirmation = argv[++index];
    else if (argument === "--remote-branch-action") options.remoteBranchAction = argv[++index];
    else if (argument === "--legacy-taskless-confirmation") {
      options.legacyTasklessConfirmation = argv[++index];
    } else block(`Unknown argument ${argument}.`);
  }
  for (const name of ["target", "evidence", "taskSnapshot"]) {
    requiredString(options[name], `--${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return options;
}

function ensureDurableEvidence(path, target) {
  const evidencePath = absoluteRealPath(path, "evidence file");
  const privateTmp = resolve("/private/tmp");
  if (isInside(evidencePath, privateTmp)) {
    block("The removal evidence file must be stored outside /private/tmp before execution.");
  }
  if (isInside(evidencePath, target)) block("The removal evidence file cannot live inside the worktree being removed.");
}

function ensureTaskSnapshotOutsideTarget(path, target) {
  const taskSnapshotPath = absoluteRealPath(path, "task snapshot");
  if (isInside(taskSnapshotPath, target)) {
    block("The task snapshot cannot live inside the worktree being removed.");
  }
}

function confirmRemovalGone(current) {
  if (pathEntryExists(current.target, "removed worktree path")) {
    block("Git returned success, but the worktree path still exists.");
  }
  const records = parseWorktreePorcelain(git(current.repositoryRoot, ["worktree", "list", "--porcelain", "-z"]));
  if (records.some((record) => resolve(record.worktree) === current.registeredPath)) {
    block("Git returned success, but the worktree registration still exists.");
  }
}

function sameQuarantinedState(before, after) {
  for (const field of [
    "repositoryRoot",
    "gitDir",
    "commonGitDir",
    "origin",
    "head",
    "tree",
    "branch",
    "baseRef",
    "uniqueCommitCount",
    "integrated",
    "patchSha256",
    "remoteHead",
  ]) {
    assertEqual(after[field], before[field], `Quarantined worktree ${field}`);
  }
}

function quarantineWorktree(current, evidence, expectedRepository, now) {
  const sourceDevice = statSync(current.target).dev;
  const quarantineRoot = mkdtempSync(join(dirname(current.target), ".homa-worktree-quarantine-"));
  try {
    chmodSync(quarantineRoot, 0o700);
    if (statSync(quarantineRoot).dev !== sourceDevice) {
      rmdirSync(quarantineRoot);
      block("The private quarantine is not on the worktree filesystem.");
    }
  } catch (error) {
    if (pathEntryExists(quarantineRoot, "private quarantine directory")) {
      try {
        rmdirSync(quarantineRoot);
      } catch {
        // Keep an unexpected nonempty directory for inspection.
      }
    }
    if (error instanceof RemovalBlockedError) throw error;
    block(`Could not create the private quarantine: ${error instanceof Error ? error.message : String(error)}`);
  }

  const quarantinePath = join(quarantineRoot, "worktree");
  const move = commandResult("git", [
    "-C",
    current.repositoryRoot,
    "worktree",
    "move",
    current.registeredPath,
    quarantinePath,
  ]);
  if (move.status !== 0) {
    if (
      pathEntryExists(quarantinePath, "possible quarantine path") ||
      !pathEntryExists(current.target, "original worktree path")
    ) {
      block(
        `Worktree may have moved to quarantine ${quarantinePath}, but Git reported failure: ${move.stderr.trim()}`,
      );
    }
    try {
      rmdirSync(quarantineRoot);
    } catch {
      // Leave the private directory in place if it is no longer empty.
    }
    block(`Git refused the same-filesystem worktree quarantine move: ${move.stderr.trim()}`);
  }

  if (
    pathEntryExists(current.target, "original worktree path after quarantine move") ||
    !pathEntryExists(quarantinePath, "quarantined worktree path")
  ) {
    block(`Worktree moved to quarantine ${quarantinePath}, but the atomic move could not be confirmed.`);
  }

  try {
    const movedEvidence = {
      ...evidence,
      worktree: {
        ...evidence.worktree,
        path: quarantinePath,
        registeredPath: quarantinePath,
      },
    };
    const quarantined = inspectLocalState(quarantinePath, movedEvidence, expectedRepository);
    assertEqual(quarantined.target, realpathSync(quarantinePath), "Quarantined worktree path");
    assertEqual(quarantined.registeredPath, quarantinePath, "Quarantined registered path");
    sameQuarantinedState(current, quarantined);
    if (quarantined.statusLines.length > 0) {
      block(
        `Quarantined worktree has tracked or untracked changes: ${quarantined.statusLines
          .slice(0, 5)
          .join(" | ")}`,
      );
    }
    validateIgnoredDispositions(quarantined, evidence, now);
    validateRecovery(quarantined, evidence.recovery, now);
    return { quarantineRoot, quarantinePath, quarantined };
  } catch (error) {
    block(
      `Worktree moved to quarantine ${quarantinePath}, but removal stopped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const evidencePath = absoluteRealPath(options.evidence, "evidence file");
  const taskSnapshotPath = absoluteRealPath(options.taskSnapshot, "task snapshot");
  const evidence = readJson(evidencePath, "Evidence file");
  const taskSnapshot = readJson(taskSnapshotPath, "Task snapshot");
  const expectedRepository = inspectScriptRepository();
  const current = inspectLocalState(options.target, evidence, expectedRepository);
  const issueNumber = branchIssueNumber(current.branch) ?? evidence.issue?.number;
  if (!Number.isInteger(issueNumber)) block("Could not determine the owning issue number.");
  const github = inspectGithub(current, issueNumber, evidence.issue?.handoffUrl, evidence.recovery?.kind);
  const assessment = assessRemoval({
    current,
    evidence,
    taskSnapshot,
    github,
    legacyTasklessConfirmation: options.legacyTasklessConfirmation,
  });

  if (!options.execute) {
    console.log(JSON.stringify(assessment, null, 2));
    return;
  }
  if (options.remoteBranchAction !== "keep") {
    block("Execution requires --remote-branch-action keep. This wrapper never deletes remote branches.");
  }
  assertEqual(options.confirmation, assessment.confirmation, "Removal confirmation");
  ensureDurableEvidence(evidencePath, current.target);
  ensureTaskSnapshotOutsideTarget(taskSnapshotPath, current.target);

  const finalGithub = inspectGithub(current, issueNumber, evidence.issue?.handoffUrl, evidence.recovery?.kind);
  const refreshedTaskSnapshot = readJson(taskSnapshotPath, "Final task snapshot");
  validateTaskSnapshot(refreshedTaskSnapshot, current, evidence, {
    maxAgeMs: EXECUTION_TASK_REFRESH_MAX_AGE_MS,
    legacyTasklessConfirmation: options.legacyTasklessConfirmation,
    github: finalGithub,
  });

  // Network and task checks happen first. This fingerprint authorizes only the
  // quarantine move. The moved worktree is inspected again before removal.
  const finalCurrent = inspectLocalState(options.target, evidence, expectedRepository);
  const finalAssessment = assessRemoval({
    current: finalCurrent,
    evidence,
    taskSnapshot: refreshedTaskSnapshot,
    github: finalGithub,
    taskMaxAgeMs: EXECUTION_TASK_REFRESH_MAX_AGE_MS,
    legacyTasklessConfirmation: options.legacyTasklessConfirmation,
  });
  assertEqual(options.confirmation, finalAssessment.confirmation, "Final removal confirmation");

  const quarantine = quarantineWorktree(finalCurrent, evidence, expectedRepository, Date.now());
  const removal = commandResult("git", [
    "-C",
    quarantine.quarantined.repositoryRoot,
    "worktree",
    "remove",
    quarantine.quarantined.registeredPath,
  ]);
  if (removal.status !== 0) {
    block(
      `Worktree remains in quarantine ${quarantine.quarantinePath}: Git refused normal removal: ${removal.stderr.trim()}`,
    );
  }
  try {
    confirmRemovalGone(quarantine.quarantined);
  } catch (error) {
    block(
      `Worktree removal from quarantine ${quarantine.quarantinePath} could not be confirmed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (pathEntryExists(finalCurrent.target, "original worktree path after removal")) {
    block("The original worktree path reappeared after quarantine removal.");
  }
  try {
    rmdirSync(quarantine.quarantineRoot);
  } catch (error) {
    block(
      `The worktree was removed, but its empty quarantine directory could not be removed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  console.log(
    JSON.stringify(
      {
        status: "REMOVED",
        target: finalCurrent.target,
        localBranchAction: "keep",
        remoteBranchAction: "keep",
      },
      null,
      2,
    ),
  );
}

const isEntrypoint = process.argv[1] ? realpathSync(process.argv[1]) === SCRIPT_PATH : false;
if (isEntrypoint) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`BLOCKED: ${message}`);
    process.exitCode = error instanceof RemovalBlockedError ? 2 : 1;
  }
}
