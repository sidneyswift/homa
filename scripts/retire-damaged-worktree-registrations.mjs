#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_ORIGIN = "https://github.com/sidneyswift/homa";
const EXPECTED_SCRIPT_RELATIVE_PATH = "scripts/retire-damaged-worktree-registrations.mjs";
const EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;
const PRUNE_CUTOFF_SAFETY_MS = 2 * 1000;
const APPROVER = "sidneyswift";
const TASK_SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;
const EXECUTION_TASK_MAX_AGE_MS = 30 * 1000;
const TASKLESS_REASON = "legacy-lane-predates-task-tracking";
const CLEANUP_NEXT_STEP = "cleanup-coordinator-remove-worktree";
const PRIVATE_FILE_MODE = 0o600;
const STREAM_CHUNK_BYTES = 1024 * 1024;
const ACTIVE_TASK_STATES = new Set([
  "active",
  "idle",
  "in_progress",
  "needs_input",
  "pending",
  "running",
  "waiting",
]);
const SCRIPT_PATH = realpathSync(fileURLToPath(import.meta.url));
const WORKTREE_RECORD_KEYS = new Set([
  "worktree",
  "HEAD",
  "branch",
  "bare",
  "detached",
  "locked",
  "prunable",
]);

export class DamagedRegistrationBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "DamagedRegistrationBlockedError";
  }
}

function block(message) {
  throw new DamagedRegistrationBlockedError(message);
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

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
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
    LANG: "C",
    LC_ALL: "C",
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

function git(repositoryRoot, args) {
  return checked("git", ["-C", repositoryRoot, ...args]);
}

function gitResult(repositoryRoot, args) {
  return commandResult("git", ["-C", repositoryRoot, ...args]);
}

function pathEntry(path, label) {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    block(`Could not inspect ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sameFileState(left, right) {
  return ["dev", "ino", "mode", "size", "mtimeNs"].every(
    (field) => String(left[field]) === String(right[field]),
  );
}

function stableRegularFile(path, label, maxBytes = 1024 * 1024) {
  const before = pathEntry(path, label);
  if (!before || !before.isFile() || before.isSymbolicLink()) {
    block(`${label} must be a regular file, not a symbolic link.`);
  }
  if (before.size > BigInt(maxBytes)) block(`${label} is unexpectedly large.`);
  let content;
  try {
    content = readFileSync(path);
  } catch (error) {
    block(`${label} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const after = pathEntry(path, label);
  if (!after || !sameFileState(before, after)) block(`${label} changed while it was read.`);
  return { content, stats: before };
}

function streamedRegularFile(path, label) {
  const before = pathEntry(path, label);
  if (!before || !before.isFile() || before.isSymbolicLink()) {
    block(`${label} must be a regular file, not a symbolic link.`);
  }
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(STREAM_CHUNK_BYTES);
  let descriptor;
  let bytesReadTotal = 0n;
  try {
    descriptor = openSync(path, "r");
    for (;;) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      bytesReadTotal += BigInt(bytesRead);
    }
  } catch (error) {
    block(`${label} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const after = pathEntry(path, label);
  if (!after || !sameFileState(before, after) || bytesReadTotal !== before.size) {
    block(`${label} changed while it was being fingerprinted.`);
  }
  return {
    stats: before,
    sizeBytes: String(before.size),
    sha256: hash.digest("hex"),
  };
}

function atomicPrivateJson(path, value, label) {
  const outputPath = exactAbsolutePath(path, `${label} path`);
  const parent = dirname(outputPath);
  canonicalExistingDirectory(parent, `${label} parent`);
  const temporary = join(parent, `.${randomBytes(16).toString("hex")}.tmp`);
  let descriptor;
  try {
    descriptor = openSync(temporary, "wx", PRIVATE_FILE_MODE);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    chmodSync(temporary, PRIVATE_FILE_MODE);
    renameSync(temporary, outputPath);
    chmodSync(outputPath, PRIVATE_FILE_MODE);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporary, { force: true });
    block(`Could not write ${label} atomically: ${error instanceof Error ? error.message : String(error)}`);
  }
  const stats = pathEntry(outputPath, label);
  if (!stats?.isFile() || stats.isSymbolicLink() || (stats.mode & 0o777n) !== BigInt(PRIVATE_FILE_MODE)) {
    block(`${label} was not written as an owner-only regular file.`);
  }
}

function readJsonFromStandardInput(label) {
  let content;
  try {
    content = readFileSync(0);
  } catch (error) {
    block(`${label} could not be read from standard input: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (content.length > 10 * 1024 * 1024) block(`${label} is unexpectedly large.`);
  const text = content.toString("utf8");
  if (!content.equals(Buffer.from(text, "utf8"))) block(`${label} is not valid UTF-8 JSON.`);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    block(`${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    block(`${label} must contain one JSON object.`);
  }
  return parsed;
}

function singleLineFile(path, label) {
  const { content, stats } = stableRegularFile(path, label, 1024 * 1024);
  const text = content.toString("utf8");
  if (!content.equals(Buffer.from(text, "utf8"))) block(`${label} is not valid UTF-8 text.`);
  const withoutFinalNewline = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (withoutFinalNewline.includes("\n") || /[\0\r]/u.test(withoutFinalNewline)) {
    block(`${label} must contain exactly one safe line.`);
  }
  return { text: withoutFinalNewline, stats, sha256: sha256(content) };
}

function noControlCharacters(value, label) {
  if (/[\0\r\n]/u.test(value)) block(`${label} contains unsupported control characters.`);
  return value;
}

function exactAbsolutePath(value, label) {
  const path = noControlCharacters(requiredString(value, label), label);
  if (!isAbsolute(path)) block(`${label} must be absolute.`);
  if (resolve(path) !== path) block(`${label} must be lexically normalized.`);
  return path;
}

function canonicalExistingDirectory(path, label) {
  const stats = pathEntry(path, label);
  if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) {
    block(`${label} must be a real directory, not a symbolic link.`);
  }
  let canonical;
  try {
    canonical = realpathSync(path);
  } catch (error) {
    block(`${label} does not resolve: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (canonical !== path) block(`${label} crosses a symbolic-link or path-alias boundary.`);
  return stats;
}

function nearestExistingAncestor(path, label) {
  let candidate = path;
  for (;;) {
    const stats = pathEntry(candidate, label);
    if (stats) {
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        block(`${label} has a non-directory or symbolic-link ancestor at ${candidate}.`);
      }
      if (realpathSync(candidate) !== candidate) {
        block(`${label} crosses a symbolic-link or path-alias boundary at ${candidate}.`);
      }
      return candidate;
    }
    const parent = dirname(candidate);
    if (parent === candidate) block(`${label} has no resolvable ancestor.`);
    candidate = parent;
  }
}

function isInside(path, parent) {
  const fromParent = relative(parent, path);
  return fromParent === "" || (!fromParent.startsWith(`..${sep}`) && fromParent !== "..");
}

function canonicalPathIfPresent(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function isEphemeralOperatingSystemTemporaryPath(path) {
  const roots = [
    tmpdir(),
    "/tmp",
    "/private/tmp",
    "/var/tmp",
    "/private/var/tmp",
    "/dev/shm",
    process.env.XDG_RUNTIME_DIR,
  ]
    .filter((candidate) => typeof candidate === "string" && candidate.trim() !== "")
    .map(canonicalPathIfPresent);
  if (roots.some((root) => isInside(path, root))) return true;
  const portable = path.replaceAll("\\", "/");
  return (
    /^\/(?:private\/)?var\/folders\/[^/]+\/[^/]+\/T(?:\/|$)/u.test(portable) ||
    /^\/run\/user\/\d+(?:\/|$)/u.test(portable)
  );
}

export function normalizeOrigin(value) {
  const origin = requiredString(value, "origin").trim();
  const withoutGitSuffix = origin.replace(/\.git$/u, "");
  const sshMatch = withoutGitSuffix.match(/^git@([^:]+):(.+)$/u);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;
  return withoutGitSuffix.replace(/\/$/u, "");
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
    if (!WORKTREE_RECORD_KEYS.has(key)) block(`Git returned unknown worktree field ${key}.`);
    if (key === "worktree") {
      if (record) block("Git returned a worktree record without a NUL record boundary.");
      record = { worktree: value };
      continue;
    }
    if (!record) block(`Git returned ${key} before a worktree path.`);
    if (Object.hasOwn(record, key)) block(`Git returned duplicate worktree field ${key}.`);
    record[key] = value;
  }
  if (record) records.push(record);
  if (records.length === 0) block("Git returned no worktree registrations.");
  return records;
}

function objectIdPattern(objectFormat) {
  if (objectFormat === "sha1") return /^[a-f0-9]{40}$/u;
  if (objectFormat === "sha256") return /^[a-f0-9]{64}$/u;
  block(`Unsupported Git object format ${objectFormat}.`);
}

function recordView(record, objectFormat) {
  const path = exactAbsolutePath(record.worktree, "Registered worktree path");
  const head = requiredString(record.HEAD, `Registered worktree ${path} HEAD`);
  if (!objectIdPattern(objectFormat).test(head)) {
    block(`Registered worktree ${path} has an invalid ${objectFormat} HEAD.`);
  }
  const hasBranch = typeof record.branch === "string";
  const detached = record.detached === true;
  if (hasBranch === detached) {
    block(`Registered worktree ${path} must be exactly branch-attached or detached.`);
  }
  if (hasBranch && !record.branch.startsWith("refs/heads/")) {
    block(`Registered worktree ${path} has an unsupported branch ref.`);
  }
  if (record.bare === true) block(`Bare primary registration ${path} is unsupported.`);
  return {
    path,
    head,
    branch: hasBranch ? noControlCharacters(record.branch, `Branch for ${path}`) : null,
    detached,
    lockedReason: record.locked === undefined ? null : String(record.locked),
    prunableReason: record.prunable === undefined ? null : String(record.prunable),
  };
}

function inspectScriptRepository() {
  const scriptDirectory = dirname(SCRIPT_PATH);
  const primaryPath = realpathSync(git(scriptDirectory, ["rev-parse", "--show-toplevel"]).trim());
  canonicalExistingDirectory(primaryPath, "Script repository root");
  const gitDir = realpathSync(
    git(primaryPath, ["rev-parse", "--path-format=absolute", "--git-dir"]).trim(),
  );
  const commonGitDir = realpathSync(
    git(primaryPath, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim(),
  );
  canonicalExistingDirectory(gitDir, "Script Git directory");
  canonicalExistingDirectory(commonGitDir, "Script common Git directory");
  if (gitDir !== commonGitDir) {
    block("The damaged-registration guard must run from the trusted primary checkout, not a linked worktree.");
  }
  assertEqual(
    relative(primaryPath, SCRIPT_PATH).replaceAll("\\", "/"),
    EXPECTED_SCRIPT_RELATIVE_PATH,
    "Script path inside the primary checkout",
  );
  const origin = normalizeOrigin(git(primaryPath, ["config", "--get", "remote.origin.url"]).trim());
  assertEqual(origin, EXPECTED_ORIGIN, "Repository origin");
  const objectFormat = git(primaryPath, ["rev-parse", "--show-object-format"]).trim();
  objectIdPattern(objectFormat);
  const primaryHead = git(primaryPath, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  const branchResult = gitResult(primaryPath, ["symbolic-ref", "--quiet", "HEAD"]);
  if (![0, 1].includes(branchResult.status)) {
    block(`Could not inspect the primary branch: ${branchResult.stderr.trim()}`);
  }
  const primaryBranch = branchResult.status === 0 ? branchResult.stdout.trim() : null;
  const scriptRelativePath = EXPECTED_SCRIPT_RELATIVE_PATH;
  checked("git", ["-C", primaryPath, "ls-files", "--error-unmatch", scriptRelativePath]);
  const committedScriptBlob = git(primaryPath, ["rev-parse", `HEAD:${scriptRelativePath}`]).trim();
  const currentScriptBlob = git(primaryPath, ["hash-object", SCRIPT_PATH]).trim();
  assertEqual(currentScriptBlob, committedScriptBlob, "Guard script content in the primary checkout");
  return {
    primaryPath,
    gitDir,
    commonGitDir,
    origin,
    objectFormat,
    primaryHead,
    primaryBranch,
    scriptPath: SCRIPT_PATH,
    scriptSha256: sha256(readFileSync(SCRIPT_PATH)),
    committedScriptBlob,
  };
}

function directoryIdentity(stats) {
  return {
    dev: String(stats.dev),
    ino: String(stats.ino),
    mode: String(stats.mode),
    uid: String(stats.uid),
    gid: String(stats.gid),
    mtimeNs: String(stats.mtimeNs),
  };
}

function adminRecordView(repository, adminName, adminDir, porcelain) {
  noControlCharacters(adminName, "Worktree administrative directory name");
  if (!/^[A-Za-z0-9._-]+$/u.test(adminName)) {
    block(`Worktree administrative directory ${JSON.stringify(adminName)} has an unsafe name.`);
  }
  const adminStats = canonicalExistingDirectory(adminDir, `Worktree administrative record ${adminName}`);
  const gitdir = singleLineFile(join(adminDir, "gitdir"), `Administrative gitdir for ${adminName}`);
  const headFile = singleLineFile(join(adminDir, "HEAD"), `Administrative HEAD for ${adminName}`);
  const commondir = singleLineFile(
    join(adminDir, "commondir"),
    `Administrative commondir for ${adminName}`,
  );
  const indexFile = streamedRegularFile(
    join(adminDir, "index"),
    `Administrative index for ${adminName}`,
  );
  const gitdirLink = exactAbsolutePath(gitdir.text, `Administrative gitdir link for ${adminName}`);
  if (basename(gitdirLink) !== ".git") {
    block(`Administrative gitdir link for ${adminName} does not name a root .git link.`);
  }
  let resolvedCommon;
  try {
    resolvedCommon = realpathSync(resolve(adminDir, commondir.text));
  } catch (error) {
    block(
      `Administrative commondir for ${adminName} does not resolve: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  assertEqual(resolvedCommon, repository.commonGitDir, `Administrative commondir for ${adminName}`);
  const registrationPath = dirname(gitdirLink);
  const record = porcelain.find((candidate) => candidate.path === registrationPath);
  if (!record) {
    block(`Administrative record ${adminName} has no exact NUL-delimited worktree registration.`);
  }

  let administrativeBranch = null;
  let administrativeDetachedHead = null;
  if (headFile.text.startsWith("ref: ")) {
    administrativeBranch = headFile.text.slice("ref: ".length);
    if (!administrativeBranch.startsWith("refs/heads/")) {
      block(`Administrative HEAD for ${adminName} has an unsupported symbolic ref.`);
    }
    assertEqual(record.branch, administrativeBranch, `Administrative branch for ${adminName}`);
    if (record.detached) block(`Administrative record ${adminName} disagrees about detached state.`);
    const resolvedHead = git(repository.primaryPath, [
      "rev-parse",
      "--verify",
      `${administrativeBranch}^{commit}`,
    ]).trim();
    assertEqual(resolvedHead, record.head, `Resolved administrative HEAD for ${adminName}`);
  } else {
    administrativeDetachedHead = headFile.text;
    if (!objectIdPattern(repository.objectFormat).test(administrativeDetachedHead)) {
      block(`Administrative HEAD for ${adminName} is not a valid detached object ID.`);
    }
    if (!record.detached || record.branch !== null) {
      block(`Administrative record ${adminName} disagrees about detached state.`);
    }
    assertEqual(administrativeDetachedHead, record.head, `Detached administrative HEAD for ${adminName}`);
  }
  const objectCheck = gitResult(repository.primaryPath, ["cat-file", "-e", `${record.head}^{commit}`]);
  if (objectCheck.status !== 0) block(`Administrative HEAD for ${adminName} is not a local commit.`);
  const tree = git(repository.primaryPath, ["rev-parse", `${record.head}^{tree}`]).trim();
  if (!objectIdPattern(repository.objectFormat).test(tree)) {
    block(`Administrative tree for ${adminName} is not a valid ${repository.objectFormat} object ID.`);
  }

  const adminRecordSha256 = sha256(
    JSON.stringify({
      adminName,
      adminDir,
      gitdirLink,
      administrativeBranch,
      administrativeDetachedHead,
      commondir: commondir.text,
      gitdirSha256: gitdir.sha256,
      headSha256: headFile.sha256,
      commondirSha256: commondir.sha256,
      indexSha256: indexFile.sha256,
      adminDirectoryIdentity: directoryIdentity(adminStats),
      adminFileIdentities: {
        gitdir: directoryIdentity(gitdir.stats),
        HEAD: directoryIdentity(headFile.stats),
        commondir: directoryIdentity(commondir.stats),
        index: directoryIdentity(indexFile.stats),
      },
    }),
  );
  return {
    ...record,
    tree,
    adminName,
    adminDir,
    gitdirLink,
    administrativeHead: headFile.text,
    commondir: commondir.text,
    adminRecordSha256,
    adminDirectoryIdentity: directoryIdentity(adminStats),
    adminFileIdentities: {
      gitdir: directoryIdentity(gitdir.stats),
      HEAD: directoryIdentity(headFile.stats),
      commondir: directoryIdentity(commondir.stats),
      index: directoryIdentity(indexFile.stats),
    },
  };
}

function enumerateAdministrativeRecords(repository, porcelain) {
  const worktreesRoot = join(repository.commonGitDir, "worktrees");
  const rootStats = pathEntry(worktreesRoot, "Worktree administrative root");
  if (!rootStats) {
    if (porcelain.length !== 1) block("Git reports linked worktrees but the administrative root is missing.");
    return [];
  }
  canonicalExistingDirectory(worktreesRoot, "Worktree administrative root");
  let entries;
  try {
    entries = readdirSync(worktreesRoot, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  } catch (error) {
    block(`Could not enumerate worktree administrative records: ${error instanceof Error ? error.message : String(error)}`);
  }
  const records = entries.map((entry) => {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      block(`Worktree administrative entry ${JSON.stringify(entry.name)} is not a real directory.`);
    }
    return adminRecordView(repository, entry.name, join(worktreesRoot, entry.name), porcelain);
  });
  if (records.length !== porcelain.length - 1) {
    block("The administrative record set does not exactly match the NUL-delimited registration set.");
  }
  const paths = records.map((record) => record.path);
  if (new Set(paths).size !== paths.length) block("Multiple administrative records name the same worktree path.");
  return records;
}

function isBareGitRepositoryDirectory(absolutePath, entries) {
  const names = new Set(entries.map((entry) => entry.name));
  if (!["HEAD", "config", "objects", "refs"].every((name) => names.has(name))) return false;
  const headStats = pathEntry(join(absolutePath, "HEAD"), "Bare repository HEAD candidate");
  const configStats = pathEntry(join(absolutePath, "config"), "Bare repository config candidate");
  const objectsStats = pathEntry(join(absolutePath, "objects"), "Bare repository objects candidate");
  const refsStats = pathEntry(join(absolutePath, "refs"), "Bare repository refs candidate");
  if (
    !headStats?.isFile() ||
    headStats.size > 4096n ||
    !configStats?.isFile() ||
    !objectsStats?.isDirectory() ||
    !refsStats?.isDirectory()
  ) {
    return false;
  }
  const head = singleLineFile(join(absolutePath, "HEAD"), "Bare repository HEAD candidate").text;
  if (!/^(?:ref: refs\/[^\0\r\n]+|[a-f0-9]{40}|[a-f0-9]{64})$/iu.test(head)) return false;
  const bare = commandResult("git", [
    "config",
    "--file",
    join(absolutePath, "config"),
    "--no-includes",
    "--type=bool",
    "--get",
    "core.bare",
  ]);
  return bare.status === 0 && bare.stdout.trim() === "true";
}

function assertNoGitRepositories(target) {
  const pending = [{ absolutePath: target, relativePath: "" }];
  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current.absolutePath, { withFileTypes: true }).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    } catch (error) {
      block(
        `Could not inspect ${JSON.stringify(current.relativePath || ".")} for Git metadata: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (isBareGitRepositoryDirectory(current.absolutePath, entries)) {
      const label = current.relativePath === "" ? "Root" : "Nested";
      block(`${label} bare Git repository ${JSON.stringify(current.relativePath || ".")} preserves separate history.`);
    }
    for (const entry of entries) {
      const relativePath = current.relativePath ? `${current.relativePath}/${entry.name}` : entry.name;
      if (entry.name.toLowerCase() === ".git") {
        const label = current.relativePath === "" ? "Root" : "Nested";
        block(`${label} .git entry ${JSON.stringify(relativePath)} may preserve a standalone repository.`);
      }
      const absolutePath = join(current.absolutePath, entry.name);
      const stats = pathEntry(absolutePath, `Path ${relativePath}`);
      if (!stats) block(`Path ${JSON.stringify(relativePath)} disappeared during Git metadata inspection.`);
      if (stats.isDirectory() && !stats.isSymbolicLink()) {
        pending.push({ absolutePath, relativePath });
      }
    }
  }
}

function streamDirectoryInventory(target) {
  const hash = createHash("sha256");
  const pending = [{ absolutePath: target, relativePath: "" }];
  const directories = [];
  let entryCount = 0;
  let fileCount = 0;
  let totalBytes = 0n;
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const current = pending[cursor];
    const before = pathEntry(current.absolutePath, `Inventory directory ${current.relativePath || "."}`);
    if (!before?.isDirectory() || before.isSymbolicLink()) {
      block(`Inventory directory ${JSON.stringify(current.relativePath || ".")} changed type.`);
    }
    directories.push({ path: current.absolutePath, stats: before });
    let entries;
    try {
      entries = readdirSync(current.absolutePath, { withFileTypes: true }).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    } catch (error) {
      block(
        `Could not inventory ${JSON.stringify(current.relativePath || ".")}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    for (const entry of entries) {
      const relativePath = current.relativePath ? `${current.relativePath}/${entry.name}` : entry.name;
      const absolutePath = join(current.absolutePath, entry.name);
      const stats = pathEntry(absolutePath, `Inventory path ${relativePath}`);
      if (!stats) block(`Inventory path ${JSON.stringify(relativePath)} disappeared.`);
      let record;
      if (stats.isDirectory() && !stats.isSymbolicLink()) {
        record = {
          path: relativePath,
          kind: "directory",
          mode: String(stats.mode),
          uid: String(stats.uid),
          gid: String(stats.gid),
          mtimeNs: String(stats.mtimeNs),
        };
        pending.push({ absolutePath, relativePath });
      } else if (stats.isFile()) {
        const file = streamedRegularFile(absolutePath, `Inventory file ${relativePath}`);
        record = {
          path: relativePath,
          kind: "file",
          mode: String(stats.mode),
          sizeBytes: file.sizeBytes,
          sha256: file.sha256,
        };
        fileCount += 1;
        totalBytes += BigInt(file.sizeBytes);
      } else if (stats.isSymbolicLink()) {
        const link = readlinkSync(absolutePath, { encoding: "buffer" });
        record = {
          path: relativePath,
          kind: "symlink",
          mode: String(stats.mode),
          sizeBytes: String(stats.size),
          sha256: sha256(link),
        };
        totalBytes += stats.size;
      } else {
        block(`Inventory path ${JSON.stringify(relativePath)} has an unsupported file type.`);
      }
      hash.update(JSON.stringify(record));
      hash.update("\n");
      entryCount += 1;
    }
  }
  for (const directory of directories) {
    const after = pathEntry(directory.path, `Inventory directory ${directory.path}`);
    if (!after || !sameFileState(directory.stats, after)) {
      block(`Inventory directory ${directory.path} changed during the scan.`);
    }
  }
  return {
    version: 1,
    entryCount,
    fileCount,
    directoryCount: directories.length,
    totalBytes: String(totalBytes),
    manifestSha256: hash.digest("hex"),
  };
}

function inspectRegisteredPath(repository, registration) {
  const target = registration.path;
  if (target === repository.primaryPath || isInside(target, repository.primaryPath) || isInside(repository.primaryPath, target)) {
    block(`Damaged registration path ${target} overlaps the trusted primary checkout.`);
  }
  nearestExistingAncestor(target, `Damaged registration path ${target}`);
  const targetStats = pathEntry(target, `Damaged registration path ${target}`);
  const rootGitStats = pathEntry(join(target, ".git"), `Root .git entry for ${target}`);
  if (rootGitStats) {
    if (rootGitStats.isDirectory()) {
      block(`Damaged registration path ${target} now has a standalone root .git directory collision.`);
    }
    block(`Damaged registration path ${target} now has a root .git entry and is not eligible.`);
  }
  if (!targetStats) return { pathState: "absent", pathIdentity: null, pathInventory: null };
  if (!targetStats.isDirectory() || targetStats.isSymbolicLink()) {
    block(`Damaged registration path ${target} is a symbolic link or non-directory collision.`);
  }
  if (realpathSync(target) !== target) {
    block(`Damaged registration path ${target} crosses a symbolic-link or path-alias boundary.`);
  }
  const parentRepository = gitResult(target, ["rev-parse", "--show-toplevel"]);
  if (parentRepository.status === 0) {
    block(
      `Damaged registration path ${target} is inside another Git worktree at ${parentRepository.stdout.trim()}, so parent repository fallback would be unsafe.`,
    );
  }
  assertNoGitRepositories(target);
  const pathInventory = streamDirectoryInventory(target);
  return { pathState: "directory", pathIdentity: directoryIdentity(targetStats), pathInventory };
}

function repositoryEvidence(repository) {
  return {
    primaryPath: repository.primaryPath,
    gitDir: repository.gitDir,
    commonGitDir: repository.commonGitDir,
    origin: repository.origin,
    objectFormat: repository.objectFormat,
    primaryHead: repository.primaryHead,
    primaryBranch: repository.primaryBranch,
    scriptPath: repository.scriptPath,
    scriptSha256: repository.scriptSha256,
    committedScriptBlob: repository.committedScriptBlob,
  };
}

function registrationEvidence(registration) {
  return {
    path: registration.path,
    head: registration.head,
    tree: registration.tree,
    branch: registration.branch,
    detached: registration.detached,
    prunableReason: registration.prunableReason,
    adminName: registration.adminName,
    adminDir: registration.adminDir,
    gitdirLink: registration.gitdirLink,
    administrativeHead: registration.administrativeHead,
    commondir: registration.commondir,
    adminRecordSha256: registration.adminRecordSha256,
    adminDirectoryIdentity: registration.adminDirectoryIdentity,
    adminFileIdentities: registration.adminFileIdentities,
    pathState: registration.pathState,
    pathIdentity: registration.pathIdentity,
    pathInventory: registration.pathInventory,
  };
}

function registrationIdentity(registration) {
  const evidence = registrationEvidence(registration);
  delete evidence.pathState;
  delete evidence.pathIdentity;
  delete evidence.pathInventory;
  return evidence;
}

function compareByPath(left, right) {
  return left.path.localeCompare(right.path);
}

function inspectRegistrationState(repository, { allowNoPrunable = false } = {}) {
  const rawRecords = parseWorktreePorcelain(
    git(repository.primaryPath, ["worktree", "list", "--porcelain", "-z"]),
  );
  const porcelain = rawRecords.map((record) => recordView(record, repository.objectFormat));
  const paths = porcelain.map((record) => record.path);
  if (new Set(paths).size !== paths.length) block("Git returned duplicate registered worktree paths.");
  const primary = porcelain.find((record) => record.path === repository.primaryPath);
  if (!primary) block("The script repository is not the exact primary worktree registration.");
  assertEqual(primary.head, repository.primaryHead, "Primary registration HEAD");
  assertEqual(primary.branch, repository.primaryBranch, "Primary registration branch");
  if (primary.prunableReason !== null) block("The trusted primary checkout is marked prunable.");

  const adminRecords = enumerateAdministrativeRecords(repository, porcelain);
  const candidates = [];
  for (const registration of adminRecords) {
    const rootGitStats = pathEntry(join(registration.path, ".git"), `Root .git entry for ${registration.path}`);
    if (rootGitStats?.isDirectory()) {
      block(`Registered path ${registration.path} contains a standalone root .git directory collision.`);
    }
    if (rootGitStats?.isSymbolicLink()) {
      block(`Registered path ${registration.path} contains a root .git symbolic-link collision.`);
    }
    if (!rootGitStats && registration.prunableReason === null) {
      block(`Registration ${registration.path} has a missing root .git link but Git did not mark it prunable.`);
    }
    if (registration.prunableReason === null) continue;
    if (registration.lockedReason !== null) block(`Prunable registration ${registration.path} is locked.`);
    assertEqual(
      registration.prunableReason,
      "gitdir file points to non-existent location",
      `Prunable reason for ${registration.path}`,
    );
    if (rootGitStats) block(`Prunable registration ${registration.path} has a root .git collision.`);
    candidates.push({ ...registration, ...inspectRegisteredPath(repository, registration) });
  }
  if (!allowNoPrunable && candidates.length === 0) {
    block("There are no eligible damaged worktree registrations.");
  }
  candidates.sort(compareByPath);
  for (let index = 0; index < candidates.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      const left = candidates[index].path;
      const right = candidates[otherIndex].path;
      if (isInside(left, right) || isInside(right, left)) {
        block(`Damaged registration paths ${left} and ${right} overlap.`);
      }
    }
  }
  return { allRecords: porcelain.sort(compareByPath), candidates };
}

function parsedTime(value, label) {
  const time = Date.parse(requiredString(value, label));
  if (!Number.isFinite(time)) block(`${label} must be an ISO timestamp.`);
  return time;
}

function normalizedIsoTime(value, label) {
  const time = parsedTime(value, label);
  if (new Date(time).toISOString() !== value) {
    block(`${label} must be a normalized ISO timestamp.`);
  }
  return time;
}

function pruneDryRun(repository, cutoff) {
  const result = commandResult("git", [
    "-C",
    repository.primaryPath,
    "worktree",
    "prune",
    "--dry-run",
    "--verbose",
    `--expire=${cutoff}`,
  ]);
  if (result.status !== 0) block(`Git prune dry-run failed: ${result.stderr.trim() || "no error text"}`);
  const lines = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^Removing worktrees\/([^:]+): /u);
    if (!match) block(`Git prune dry-run returned an unknown line: ${line}`);
    return match[1];
  }).sort();
}

function assertDryRunExact(repository, candidates, cutoff) {
  const expected = candidates.map((candidate) => candidate.adminName).sort();
  const actual = pruneDryRun(repository, cutoff);
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), "Exact Git prune dry-run set");
}

function shortBranch(registration) {
  return registration.branch?.startsWith("refs/heads/")
    ? registration.branch.slice("refs/heads/".length)
    : null;
}

function branchIssueNumber(registration) {
  const branch = shortBranch(registration);
  const match = branch?.match(/^codex\/gh-(\d+)-/u);
  return match ? Number(match[1]) : null;
}

function inspectRetainedReference(repository, registration, reference) {
  const retainedReference = requiredString(reference, `Recovery reference for ${registration.path}`);
  if (!/^refs\/(?:heads|homa\/recovery)\/[A-Za-z0-9._/-]+$/u.test(retainedReference)) {
    block(`Recovery reference for ${registration.path} is outside the retained reference namespaces.`);
  }
  const headResult = gitResult(repository.primaryPath, [
    "show-ref",
    "--verify",
    "--hash",
    retainedReference,
  ]);
  if (headResult.status !== 0) block(`Recovery reference ${retainedReference} does not exist locally.`);
  const head = headResult.stdout.trim();
  assertEqual(head, registration.head, `Recovery reference head for ${registration.path}`);
  const tree = git(repository.primaryPath, ["rev-parse", `${retainedReference}^{tree}`]).trim();
  assertEqual(tree, registration.tree, `Recovery reference tree for ${registration.path}`);
  return { kind: "retained-ref", reference: retainedReference, head, tree };
}

function inspectBundle(repository, registration, artifactInput) {
  const artifactInputPath = exactAbsolutePath(
    artifactInput,
    `Recovery bundle path for ${registration.path}`,
  );
  let artifact;
  try {
    artifact = realpathSync(artifactInputPath);
  } catch (error) {
    block(`Recovery bundle for ${registration.path} does not resolve: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertEqual(artifact, artifactInputPath, `Recovery bundle canonical path for ${registration.path}`);
  if (isEphemeralOperatingSystemTemporaryPath(artifact)) {
    block(`Recovery bundle for ${registration.path} is under ephemeral temporary storage.`);
  }
  if (isInside(artifact, registration.path) || isInside(artifact, repository.commonGitDir)) {
    block(`Recovery bundle for ${registration.path} is inside the lane or common Git directory.`);
  }
  const file = streamedRegularFile(artifact, `Recovery bundle for ${registration.path}`);
  if (typeof process.getuid === "function" && file.stats.uid !== BigInt(process.getuid())) {
    block(`Recovery bundle for ${registration.path} is not owned by the current user.`);
  }
  if ((file.stats.mode & 0o077n) !== 0n) {
    block(`Recovery bundle for ${registration.path} is not owner-only.`);
  }
  checked("git", ["bundle", "verify", artifact], { cwd: repository.primaryPath });
  const heads = checked("git", ["bundle", "list-heads", artifact], { cwd: repository.primaryPath })
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [head, reference] = line.split(/\s+/u);
      return { head, reference };
    });
  const advertised = heads.find((entry) => entry.head === registration.head);
  if (!advertised) block(`Recovery bundle for ${registration.path} does not advertise its exact HEAD.`);

  const restoreRoot = mkdtempSync(join(tmpdir(), "homa-damaged-bundle-restore-"));
  const restoredRepository = join(restoreRoot, "restored.git");
  try {
    checked("git", [
      "init",
      "--bare",
      "--template=",
      `--object-format=${repository.objectFormat}`,
      restoredRepository,
    ]);
    for (const name of ["alternates", "http-alternates"]) {
      if (existsSync(join(restoredRepository, "objects", "info", name))) {
        block(`Empty recovery repository for ${registration.path} inherited ${name} object indirection.`);
      }
    }
    checked("git", [
      "-C",
      restoredRepository,
      "-c",
      "fetch.fsckObjects=true",
      "fetch",
      "--no-tags",
      artifact,
      `${advertised.reference}:refs/heads/recovered`,
    ]);
    for (const name of ["alternates", "http-alternates"]) {
      if (existsSync(join(restoredRepository, "objects", "info", name))) {
        block(`Recovery bundle for ${registration.path} introduced ${name} object indirection.`);
      }
    }
    checked("git", [
      "-C",
      restoredRepository,
      "fsck",
      "--full",
      "--strict",
      "--no-dangling",
      "refs/heads/recovered",
    ]);
    const restoredHead = checked("git", [
      "-C",
      restoredRepository,
      "rev-parse",
      "refs/heads/recovered",
    ]).trim();
    const restoredTree = checked("git", [
      "-C",
      restoredRepository,
      "rev-parse",
      "refs/heads/recovered^{tree}",
    ]).trim();
    assertEqual(restoredHead, registration.head, `Restored bundle head for ${registration.path}`);
    assertEqual(restoredTree, registration.tree, `Restored bundle tree for ${registration.path}`);
    const restoredArtifact = streamedRegularFile(
      artifact,
      `Recovery bundle for ${registration.path}`,
    );
    assertEqual(
      restoredArtifact.sha256,
      file.sha256,
      `Recovery bundle content during restore for ${registration.path}`,
    );
    assertEqual(
      restoredArtifact.sizeBytes,
      file.sizeBytes,
      `Recovery bundle size during restore for ${registration.path}`,
    );
    return {
      kind: "bundle",
      artifactPath: artifact,
      artifactSha256: file.sha256,
      artifactSizeBytes: file.sizeBytes,
      advertisedHead: registration.head,
      restoredHead,
      restoredTree,
    };
  } finally {
    rmSync(restoreRoot, { recursive: true, force: true });
  }
}

function inspectRecovery(repository, registration, evidenceRecovery) {
  if (!evidenceRecovery || typeof evidenceRecovery !== "object" || Array.isArray(evidenceRecovery)) {
    block(`Registration ${registration.path} needs recovery evidence.`);
  }
  if (evidenceRecovery.kind === "retained-ref") {
    return inspectRetainedReference(repository, registration, evidenceRecovery.reference);
  }
  if (evidenceRecovery.kind === "bundle") {
    return inspectBundle(repository, registration, evidenceRecovery.artifactPath);
  }
  block(`Registration ${registration.path} has unknown recovery kind ${JSON.stringify(evidenceRecovery.kind)}.`);
}

function validateRecovery(repository, registration, evidenceRecovery) {
  const inspected = inspectRecovery(repository, registration, evidenceRecovery);
  assertEqual(evidenceRecovery.sourceHead, registration.head, `Recovery source HEAD for ${registration.path}`);
  assertEqual(evidenceRecovery.sourceTree, registration.tree, `Recovery source tree for ${registration.path}`);
  if (inspected.kind === "retained-ref") {
    assertEqual(evidenceRecovery.reference, inspected.reference, `Retained reference for ${registration.path}`);
  } else {
    assertEqual(evidenceRecovery.advertisedHead, inspected.advertisedHead, `Bundle advertised HEAD for ${registration.path}`);
    assertEqual(evidenceRecovery.artifactSha256, inspected.artifactSha256, `Bundle checksum for ${registration.path}`);
    assertEqual(evidenceRecovery.artifactSizeBytes, inspected.artifactSizeBytes, `Bundle size for ${registration.path}`);
    assertEqual(evidenceRecovery.restoredHead, inspected.restoredHead, `Bundle restored HEAD for ${registration.path}`);
    assertEqual(evidenceRecovery.restoredTree, inspected.restoredTree, `Bundle restored tree for ${registration.path}`);
    const restoreTestedAt = parsedTime(evidenceRecovery.restoreTestedAt, `Recovery restoreTestedAt for ${registration.path}`);
    if (restoreTestedAt > Date.now()) block(`Recovery restoreTestedAt for ${registration.path} is in the future.`);
  }
  return inspected;
}

function parseCommandJson(output, label) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    block(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    block(`${label} returned no JSON object.`);
  }
  return parsed;
}

function inspectGithubIssue(repository, issueNumber, handoffUrl) {
  if (!Number.isInteger(issueNumber) || issueNumber < 1) block("Registration issue number must be a positive integer.");
  const repositoryName = new URL(`${repository.origin}/`).pathname.replace(/^\//u, "").replace(/\/$/u, "");
  const issue = parseCommandJson(
    checked("gh", [
      "issue",
      "view",
      String(issueNumber),
      "--repo",
      repositoryName,
      "--json",
      "number,state,url",
    ]),
    `GitHub issue ${issueNumber}`,
  );
  let handoffComment = null;
  if (typeof handoffUrl === "string" && handoffUrl !== "") {
    const match = handoffUrl.match(/#issuecomment-(\d+)$/u);
    if (!match) block(`GitHub issue ${issueNumber} handoff URL has no exact comment ID.`);
    const comment = parseCommandJson(
      checked("gh", ["api", `repos/${repositoryName}/issues/comments/${match[1]}`]),
      `GitHub issue ${issueNumber} handoff comment`,
    );
    handoffComment = {
      url: comment.html_url,
      issueUrl: comment.issue_url,
      body: comment.body,
    };
  }
  return { issue, handoffComment };
}

function validateIssue(repository, registration, evidenceIssue) {
  if (!evidenceIssue || typeof evidenceIssue !== "object" || Array.isArray(evidenceIssue)) {
    block(`Registration ${registration.path} needs issue evidence.`);
  }
  const inferred = branchIssueNumber(registration);
  if (inferred !== null) assertEqual(evidenceIssue.number, inferred, `Branch issue for ${registration.path}`);
  const current = inspectGithubIssue(repository, evidenceIssue.number, evidenceIssue.handoffUrl);
  assertEqual(current.issue.number, evidenceIssue.number, `GitHub issue number for ${registration.path}`);
  assertEqual(current.issue.state, evidenceIssue.state, `GitHub issue state for ${registration.path}`);
  assertEqual(current.issue.url, evidenceIssue.url, `GitHub issue URL for ${registration.path}`);
  if (current.issue.state === "CLOSED") {
    assertEqual(evidenceIssue.disposition, "closed", `Closed issue disposition for ${registration.path}`);
  } else if (current.issue.state === "OPEN") {
    if (!new Set(["replacement-active", "updated-open"]).has(evidenceIssue.disposition)) {
      block(`Open issue ${evidenceIssue.number} needs updated-open or replacement-active disposition.`);
    }
    const handoffUrl = requiredString(evidenceIssue.handoffUrl, `Issue handoff URL for ${registration.path}`);
    if (!current.handoffComment || current.handoffComment.url !== handoffUrl) {
      block(`Issue handoff comment for ${registration.path} was not verified.`);
    }
    if (!current.handoffComment.issueUrl.endsWith(`/issues/${evidenceIssue.number}`)) {
      block(`Issue handoff comment for ${registration.path} belongs to another issue.`);
    }
    const body = requiredString(current.handoffComment.body, `Issue handoff body for ${registration.path}`);
    for (const fact of [registration.path, registration.head, shortBranch(registration)].filter(Boolean)) {
      if (!body.includes(fact)) block(`Issue handoff for ${registration.path} does not contain ${fact}.`);
    }
    const recoveryFact = evidenceIssue.recoveryReference;
    if (typeof recoveryFact === "string" && recoveryFact !== "" && !body.includes(recoveryFact)) {
      block(`Issue handoff for ${registration.path} omits its recovery reference.`);
    }
  } else {
    block(`GitHub issue ${evidenceIssue.number} has unknown state ${current.issue.state}.`);
  }
  return current;
}

function validateTaskHandoff(task, registration, evidenceIssue, now) {
  const taskId = requiredString(task.id, "task.id");
  const handoff = task.handoff;
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) {
    block(`Task ${taskId} has no completed handoff.`);
  }
  for (const field of ["outcome", "issue", "worktree", "commitOrPr", "productionState", "nextStep"]) {
    requiredString(handoff[field], `Task ${taskId} handoff.${field}`);
  }
  const recordedAt = parsedTime(handoff.recordedAt, `Task ${taskId} handoff.recordedAt`);
  if (recordedAt > now) block(`Task ${taskId} handoff.recordedAt is in the future.`);
  assertEqual(
    exactAbsolutePath(handoff.worktree, `Task ${taskId} handoff worktree`),
    registration.path,
    `Task ${taskId} handoff worktree`,
  );
  const issueReferences = new Set([`#${evidenceIssue.number}`, evidenceIssue.url]);
  if (!issueReferences.has(handoff.issue)) block(`Task ${taskId} handoff points to another issue.`);
  const commitUrl = `${EXPECTED_ORIGIN}/commit/${registration.head}`;
  if (handoff.commitOrPr !== registration.head && handoff.commitOrPr !== commitUrl) {
    block(`Task ${taskId} handoff.commitOrPr must exactly name the retained HEAD.`);
  }
  const branch = shortBranch(registration);
  if (branch && handoff.branch !== branch) block(`Task ${taskId} handoff branch changed.`);
  const checks = handoff.checks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    block(`Task ${taskId} handoff.checks must be an object.`);
  }
  if (checks.executed !== true || checks.status !== "passed") {
    block(`Task ${taskId} handoff checks must be executed and passed.`);
  }
  if (!Array.isArray(checks.commands) || checks.commands.length === 0) {
    block(`Task ${taskId} handoff checks must list at least one command.`);
  }
  if (checks.commands.some((command) => typeof command !== "string" || command.trim() === "")) {
    block(`Task ${taskId} handoff checks contain an invalid command.`);
  }
  const checksAt = parsedTime(checks.completedAt, `Task ${taskId} handoff.checks.completedAt`);
  if (checksAt > now) block(`Task ${taskId} handoff.checks.completedAt is in the future.`);
  assertEqual(handoff.nextStep, CLEANUP_NEXT_STEP, `Task ${taskId} handoff nextStep`);
  if (handoff.handoffComplete !== true) block(`Task ${taskId} handoff is not complete.`);
}

function validateBatchTaskSnapshot(
  snapshot,
  state,
  evidence,
  { now = Date.now(), maxAgeMs = TASK_SNAPSHOT_MAX_AGE_MS, tasklessConfirmations = [] } = {},
) {
  if (snapshot.schemaVersion !== 1) block("Task snapshot schemaVersion must be 1.");
  if (snapshot.source !== "codex-list-threads") block("Task snapshot source must be codex-list-threads.");
  if (snapshot.coverage !== "all-open-and-recent-homa-tasks") {
    block("Task snapshot must cover all open and recent Homa tasks.");
  }
  const capturedAt = normalizedIsoTime(snapshot.capturedAt, "Task snapshot capturedAt");
  if (capturedAt > now) block("Task snapshot capturedAt is in the future.");
  if (now - capturedAt > maxAgeMs) block("Task snapshot is stale. Capture it at the execution boundary.");
  assertEqual(normalizeOrigin(snapshot.repositoryOrigin), EXPECTED_ORIGIN, "Task snapshot repository origin");
  if (!snapshot.retirementScan || typeof snapshot.retirementScan !== "object") {
    block("Task snapshot retirementScan binding is required.");
  }
  assertEqual(snapshot.retirementScan.nonce, evidence.scan.nonce, "Task snapshot scan nonce");
  assertEqual(snapshot.retirementScan.sha256, evidence.scan.sha256, "Task snapshot scan digest");
  if (!Array.isArray(snapshot.tasks)) block("Task snapshot tasks must be an array.");
  for (const task of snapshot.tasks) {
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      block("Every task snapshot entry must be an object.");
    }
  }
  const taskIds = snapshot.tasks.map((task) => requiredString(task.id, "task.id"));
  if (new Set(taskIds).size !== taskIds.length) block("Task snapshot contains duplicate task IDs.");

  const confirmationSet = new Set(tasklessConfirmations);
  if (confirmationSet.size !== tasklessConfirmations.length) block("Taskless confirmations contain duplicates.");
  const usedConfirmations = new Set();
  const evidenceByPath = new Map(evidence.registrations.map((registration) => [registration.path, registration]));
  for (const registration of state.candidates) {
    const evidenceRegistration = evidenceByPath.get(registration.path);
    const branch = shortBranch(registration);
    const matching = snapshot.tasks.filter((task) => {
      const taskPath = typeof task.worktree === "string" && isAbsolute(task.worktree)
        ? resolve(task.worktree)
        : null;
      return (branch !== null && task.branch === branch) || taskPath === registration.path;
    });
    for (const task of matching) {
      const status = requiredString(task.status, `Task ${task.id} status`);
      if (ACTIVE_TASK_STATES.has(status.toLowerCase())) {
        block(`Batch retirement is blocked because task ${task.id} is still ${status} in ${registration.path}.`);
      }
      if (status !== "completed") {
        block(`Batch retirement is blocked because task ${task.id} is ${status}, not completed.`);
      }
      assertEqual(
        exactAbsolutePath(task.worktree, `Task ${task.id} worktree`),
        registration.path,
        `Task ${task.id} worktree`,
      );
      if (branch) assertEqual(task.branch, branch, `Task ${task.id} branch`);
      validateTaskHandoff(task, registration, evidenceRegistration.issue, now);
    }
    if (matching.length === 0) {
      const override = evidenceRegistration.task?.legacyTasklessOverride;
      if (!override || typeof override !== "object" || Array.isArray(override)) {
        block(`Registration ${registration.path} needs a completed task or a per-lane taskless override.`);
      }
      assertEqual(override.approvedBy, APPROVER, `Taskless override approver for ${registration.path}`);
      assertEqual(override.reason, TASKLESS_REASON, `Taskless override reason for ${registration.path}`);
      const approvedAt = parsedTime(override.approvedAt, `Taskless override approvedAt for ${registration.path}`);
      if (approvedAt > now || now - approvedAt > EVIDENCE_MAX_AGE_MS) {
        block(`Taskless override for ${registration.path} is stale or future-dated.`);
      }
      assertEqual(override.scanNonce, evidence.scan.nonce, `Taskless override scan nonce for ${registration.path}`);
      const confirmation = `ALLOW TASKLESS ${registration.path}`;
      if (!confirmationSet.has(confirmation)) {
        block(`Registration ${registration.path} needs --legacy-taskless-confirmation ${JSON.stringify(confirmation)}.`);
      }
      usedConfirmations.add(confirmation);
    } else if (evidenceRegistration.task?.legacyTasklessOverride) {
      block(`Registration ${registration.path} cannot use a taskless override when a matching task exists.`);
    }
  }
  for (const confirmation of confirmationSet) {
    if (!usedConfirmations.has(confirmation)) block(`Unused taskless confirmation ${JSON.stringify(confirmation)}.`);
  }
  return {
    taskCount: taskIds.length,
    matchedTaskCount: state.candidates.reduce((count, registration) => {
      const branch = shortBranch(registration);
      return count + snapshot.tasks.filter((task) =>
        (branch !== null && task.branch === branch) ||
        (typeof task.worktree === "string" && isAbsolute(task.worktree) && resolve(task.worktree) === registration.path),
      ).length;
    }, 0),
    overrideCount: usedConfirmations.size,
  };
}

function makeInventory(repository, state, now = Date.now()) {
  const capturedAt = new Date(now).toISOString();
  const pruneCutoff = new Date(now - PRUNE_CUTOFF_SAFETY_MS).toISOString();
  const cutoffNanoseconds = BigInt(Date.parse(pruneCutoff)) * 1_000_000n;
  for (const candidate of state.candidates) {
    if (BigInt(candidate.adminFileIdentities.index.mtimeNs) > cutoffNanoseconds) {
      block(
        `Administrative record ${candidate.adminName} is too new for a race-bounded prune. Wait two seconds and capture again.`,
      );
    }
  }
  assertDryRunExact(repository, state.candidates, pruneCutoff);
  const scanRegistrations = state.candidates.map(registrationEvidence).sort(compareByPath);
  const scan = {
    version: 1,
    nonce: randomBytes(32).toString("hex"),
    sha256: sha256(JSON.stringify(scanRegistrations)),
  };
  const registrations = state.candidates.map((registration) => {
    const scanned = registrationEvidence(registration);
    const issueNumber = branchIssueNumber(registration);
    let issue;
    if (issueNumber === null) {
      issue = {
        number: null,
        state: "review-required",
        url: "",
        disposition: "review-required",
      };
    } else {
      const github = inspectGithubIssue(repository, issueNumber);
      issue = {
        number: github.issue.number,
        state: github.issue.state,
        url: github.issue.url,
        disposition: github.issue.state === "CLOSED" ? "closed" : "review-required",
      };
    }
    const recovery = registration.branch
      ? {
          kind: "retained-ref",
          reference: registration.branch,
          sourceHead: registration.head,
          sourceTree: registration.tree,
        }
      : {
          kind: "review-required",
          sourceHead: registration.head,
          sourceTree: registration.tree,
        };
    return { ...scanned, issue, task: {}, recovery };
  }).sort(compareByPath);
  return {
    schemaVersion: 2,
    capturedAt,
    pruneCutoff,
    repository: repositoryEvidence(repository),
    registrations,
    scan,
    setSha256: scan.sha256,
    approval: {
      approvedBy: "",
      approvedAt: "",
      reason: "",
      scanNonce: scan.nonce,
      scanSha256: scan.sha256,
    },
  };
}

function makeReviewQueue(evidence) {
  const items = [
    {
      kind: "batch-approval",
      action: "Review every lane, then complete the approval object without changing the scan binding.",
    },
  ];
  for (const registration of evidence.registrations) {
    if (registration.issue?.state === "review-required" || registration.issue?.disposition === "review-required") {
      items.push({
        kind: "issue",
        path: registration.path,
        action: "Record the exact owning issue and a closed or updated-open handoff disposition.",
      });
    }
    if (registration.recovery?.kind === "review-required") {
      items.push({
        kind: "recovery",
        path: registration.path,
        head: registration.head,
        tree: registration.tree,
        action: "Create a retained recovery ref or a full owner-only bundle that restores into an empty repository.",
      });
    }
    items.push({
      kind: "task-ownership",
      path: registration.path,
      action: "Use a completed Desktop task handoff, or record and separately confirm this lane's taskless override.",
    });
  }
  return {
    schemaVersion: 1,
    generatedAt: evidence.capturedAt,
    scan: evidence.scan,
    registrationCount: evidence.registrations.length,
    items,
  };
}

function readJsonEvidence(path) {
  const absolutePath = exactAbsolutePath(path, "Evidence path");
  let canonicalPath;
  try {
    canonicalPath = realpathSync(absolutePath);
  } catch (error) {
    block(`Evidence path does not resolve: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (canonicalPath !== absolutePath) {
    block("Evidence path crosses a symbolic-link or path-alias boundary.");
  }
  const file = stableRegularFile(absolutePath, "Evidence file", 256 * 1024 * 1024);
  if (typeof process.getuid === "function" && file.stats.uid !== BigInt(process.getuid())) {
    block("Evidence file is not owned by the current user.");
  }
  if ((file.stats.mode & 0o077n) !== 0n) block("Evidence file must be owner-only mode 0600.");
  let evidence;
  try {
    evidence = JSON.parse(file.content.toString("utf8"));
  } catch (error) {
    block(`Evidence file is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    block("Evidence file must contain one JSON object.");
  }
  return { absolutePath, evidence, sha256: sha256(file.content) };
}

function readJsonDocument(path, label) {
  const absolutePath = exactAbsolutePath(path, `${label} path`);
  let canonicalPath;
  try {
    canonicalPath = realpathSync(absolutePath);
  } catch (error) {
    block(`${label} path does not resolve: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertEqual(canonicalPath, absolutePath, `${label} canonical path`);
  const file = stableRegularFile(absolutePath, label, 10 * 1024 * 1024);
  let value;
  try {
    value = JSON.parse(file.content.toString("utf8"));
  } catch (error) {
    block(`${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) block(`${label} must contain one JSON object.`);
  return value;
}

function validateEvidenceFileLocation(evidencePath, repository, candidates) {
  if (isEphemeralOperatingSystemTemporaryPath(evidencePath)) {
    block("The damaged-registration evidence file is under ephemeral operating-system temporary storage.");
  }
  if (isInside(evidencePath, repository.primaryPath) || isInside(evidencePath, repository.commonGitDir)) {
    block("The damaged-registration evidence file must be outside the primary checkout and common Git directory.");
  }
  for (const candidate of candidates) {
    if (isInside(evidencePath, candidate.path)) {
      block(`The damaged-registration evidence file is inside approved path ${candidate.path}.`);
    }
  }
}

function validateEvidence(repository, state, evidence, now = Date.now()) {
  if (evidence.schemaVersion !== 2) block("Evidence schemaVersion must be 2.");
  const capturedAt = parsedTime(evidence.capturedAt, "Evidence capturedAt");
  if (capturedAt > now) block("Evidence capturedAt is in the future.");
  if (now - capturedAt > EVIDENCE_MAX_AGE_MS) block("Evidence is stale. Capture the exact batch again.");
  const pruneCutoff = parsedTime(evidence.pruneCutoff, "Evidence pruneCutoff");
  if (pruneCutoff > capturedAt - PRUNE_CUTOFF_SAFETY_MS) {
    block("Evidence pruneCutoff lacks the required two-second race boundary.");
  }
  assertEqual(
    JSON.stringify(evidence.repository),
    JSON.stringify(repositoryEvidence(repository)),
    "Repository and script identity evidence",
  );
  if (!Array.isArray(evidence.registrations) || evidence.registrations.length === 0) {
    block("Evidence registrations must enumerate the complete non-empty prunable set.");
  }
  for (const registration of evidence.registrations) {
    if (!registration || typeof registration !== "object" || Array.isArray(registration)) {
      block("Every evidence registration must be an object.");
    }
  }
  const currentRegistrations = state.candidates.map(registrationEvidence).sort(compareByPath);
  const evidenceRegistrations = [...evidence.registrations].sort(compareByPath);
  const evidenceScanRegistrations = evidenceRegistrations.map(registrationEvidence).sort(compareByPath);
  assertEqual(
    JSON.stringify(evidenceScanRegistrations),
    JSON.stringify(currentRegistrations),
    "The exact approved prunable set",
  );
  if (!evidence.scan || typeof evidence.scan !== "object" || Array.isArray(evidence.scan)) {
    block("Evidence scan binding is required.");
  }
  if (evidence.scan.version !== 1) block("Evidence scan.version must be 1.");
  if (!/^[a-f0-9]{64}$/u.test(requiredString(evidence.scan.nonce, "Evidence scan.nonce"))) {
    block("Evidence scan.nonce must be 32 random bytes in lowercase hex.");
  }
  const setSha256 = sha256(JSON.stringify(evidenceScanRegistrations));
  assertEqual(evidence.scan.sha256, setSha256, "Evidence scan digest");
  assertEqual(evidence.setSha256, setSha256, "Evidence prunable-set checksum");
  const approval = evidence.approval;
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    block("Evidence approval must be an object.");
  }
  assertEqual(requiredString(approval.approvedBy, "approval.approvedBy"), APPROVER, "Approval owner");
  requiredString(approval.reason, "approval.reason");
  const approvedAt = parsedTime(approval.approvedAt, "approval.approvedAt");
  if (approvedAt < capturedAt) block("Evidence approval predates the captured registration set.");
  if (approvedAt > now) block("Evidence approval is in the future.");
  assertEqual(approval.scanNonce, evidence.scan.nonce, "Approval scan nonce");
  assertEqual(approval.scanSha256, evidence.scan.sha256, "Approval scan digest");
  const evidenceByPath = new Map(evidenceRegistrations.map((registration) => [registration.path, registration]));
  for (const registration of state.candidates) {
    const approved = evidenceByPath.get(registration.path);
    validateRecovery(repository, registration, approved.recovery);
    validateIssue(repository, registration, {
      ...approved.issue,
      recoveryReference: approved.recovery.reference ?? approved.recovery.artifactPath,
    });
  }
  assertDryRunExact(repository, state.candidates, evidence.pruneCutoff);
  return {
    status: "SAFE_TO_RETIRE_DAMAGED_REGISTRATIONS",
    registrationCount: currentRegistrations.length,
    setSha256,
    pruneCutoff: evidence.pruneCutoff,
    confirmation: `RETIRE DAMAGED REGISTRATIONS ${setSha256}`,
  };
}

function assertExactRegistrationIdentity(state, evidence) {
  const expected = [...evidence.registrations]
    .map((registration) => registrationIdentity(registration))
    .sort(compareByPath);
  const actual = state.candidates.map(registrationIdentity).sort(compareByPath);
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), "The exact approved prunable set after sealing");
}

function prepareRegistrationSeal(registration) {
  if (registration.pathState === "absent") {
    return { registration, quarantineRoot: null, preservedPath: null };
  }
  const sourceStats = pathEntry(registration.path, `Approved directory ${registration.path}`);
  if (!sourceStats || !sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    block(`Approved directory ${registration.path} changed before sealing.`);
  }
  assertEqual(
    JSON.stringify(directoryIdentity(sourceStats)),
    JSON.stringify(registration.pathIdentity),
    `Approved directory identity for ${registration.path}`,
  );
  const parent = dirname(registration.path);
  canonicalExistingDirectory(parent, `Parent directory for ${registration.path}`);
  let quarantineRoot;
  try {
    quarantineRoot = mkdtempSync(join(parent, ".homa-damaged-worktree-"));
    chmodSync(quarantineRoot, 0o700);
  } catch (error) {
    block(`Could not create a private sealing directory beside ${registration.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const quarantineStats = statSync(quarantineRoot, { bigint: true });
  if (quarantineStats.dev !== sourceStats.dev) {
    block(`Private sealing directory ${quarantineRoot} is not on the source filesystem.`);
  }
  if ((quarantineStats.mode & 0o777n) !== 0o700n) {
    block(`Private sealing directory ${quarantineRoot} is not owner-only.`);
  }
  if (typeof process.getuid === "function" && quarantineStats.uid !== BigInt(process.getuid())) {
    block(`Private sealing directory ${quarantineRoot} is not owned by the current user.`);
  }
  const preservedPath = join(quarantineRoot, "preserved-worktree");
  return { registration, quarantineRoot, preservedPath };
}

function sealRegistration(prepared) {
  const { registration, quarantineRoot, preservedPath } = prepared;
  if (registration.pathState === "absent") {
    return {
      registration,
      originalPath: registration.path,
      preservedPath: null,
      sourceInode: null,
      sourceDevice: null,
    };
  }
  const sourceStats = pathEntry(registration.path, `Approved directory ${registration.path}`);
  if (!sourceStats || !sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    block(`Approved directory ${registration.path} changed before sealing.`);
  }
  assertEqual(
    JSON.stringify(directoryIdentity(sourceStats)),
    JSON.stringify(registration.pathIdentity),
    `Approved directory identity for ${registration.path}`,
  );
  try {
    renameSync(registration.path, preservedPath);
  } catch (error) {
    block(
      `Could not atomically seal ${registration.path}. Private directory ${quarantineRoot} was left for inspection: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const preservedStats = pathEntry(preservedPath, `Preserved directory for ${registration.path}`);
  if (!preservedStats || !preservedStats.isDirectory()) {
    block(`Approved content may have moved to ${preservedPath}, but the atomic seal could not be confirmed.`);
  }
  if (String(preservedStats.dev) !== registration.pathIdentity.dev || String(preservedStats.ino) !== registration.pathIdentity.ino) {
    block(`Approved content is preserved at ${preservedPath}, but its directory identity changed during sealing.`);
  }
  return {
    registration,
    originalPath: registration.path,
    preservedPath,
    sourceInode: registration.pathIdentity.ino,
    sourceDevice: registration.pathIdentity.dev,
  };
}

function verifySealedRegistration(sealed) {
  if (sealed.preservedPath === null) return;
  assertEqual(
    JSON.stringify(streamDirectoryInventory(sealed.preservedPath)),
    JSON.stringify(sealed.registration.pathInventory),
    `Preserved directory inventory for ${sealed.originalPath}`,
  );
}

function recordIdentity(record) {
  return {
    path: record.path,
    head: record.head,
    branch: record.branch,
    detached: record.detached,
    lockedReason: record.lockedReason,
    prunableReason: record.prunableReason,
  };
}

function verifyPrune(before, after, approvedPaths) {
  const approved = new Set(approvedPaths);
  const afterByPath = new Map(after.allRecords.map((record) => [record.path, record]));
  const removed = before.allRecords
    .filter((record) => !afterByPath.has(record.path))
    .map((record) => record.path)
    .sort();
  const expectedRemoved = [...approved].sort();
  assertEqual(JSON.stringify(removed), JSON.stringify(expectedRemoved), "Registrations removed by Git prune");
  for (const record of before.allRecords) {
    if (approved.has(record.path)) continue;
    const current = afterByPath.get(record.path);
    if (!current) block(`Git prune removed unapproved registration ${record.path}.`);
    assertEqual(
      JSON.stringify(recordIdentity(current)),
      JSON.stringify(recordIdentity(record)),
      `Unapproved registration ${record.path}`,
    );
  }
  return after.allRecords
    .filter((record) => !before.allRecords.some((previous) => previous.path === record.path))
    .map(recordIdentity)
    .sort(compareByPath);
}

function executeRetirement(
  repository,
  evidenceFile,
  evidence,
  assessment,
  tasklessConfirmations,
) {
  const refreshedEvidence = readJsonEvidence(evidenceFile.absolutePath);
  assertEqual(refreshedEvidence.sha256, evidenceFile.sha256, "Evidence file checksum before mutation");
  const finalState = inspectRegistrationState(repository);
  const finalAssessment = validateEvidence(repository, finalState, refreshedEvidence.evidence);
  assertEqual(assessment.confirmation, `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`, "Execution confirmation");
  assertEqual(finalAssessment.confirmation, assessment.confirmation, "Final execution confirmation");
  const preparedSeals = finalState.candidates.map(prepareRegistrationSeal);
  process.stderr.write(
    `READY_FOR_FINAL_CODEX_TASK_SNAPSHOT ${JSON.stringify({
      scanNonce: evidence.scan.nonce,
      scanSha256: evidence.scan.sha256,
      maxAgeSeconds: EXECUTION_TASK_MAX_AGE_MS / 1000,
    })}\n`,
  );
  const taskSnapshot = readJsonFromStandardInput("Final Codex Desktop task snapshot");
  validateBatchTaskSnapshot(taskSnapshot, finalState, evidence, {
    maxAgeMs: EXECUTION_TASK_MAX_AGE_MS,
    tasklessConfirmations,
  });

  const sealed = [];
  try {
    // The complete batch moves immediately after the live task proof. No Git or
    // network command occurs until every surviving directory is preserved.
    for (const prepared of preparedSeals) sealed.push(sealRegistration(prepared));
    for (const entry of sealed) verifySealedRegistration(entry);
    const afterSeal = inspectRegistrationState(repository);
    assertExactRegistrationIdentity(afterSeal, evidence);
    assertDryRunExact(repository, afterSeal.candidates, evidence.pruneCutoff);
    const prune = commandResult("git", [
      "-C",
      repository.primaryPath,
      "worktree",
      "prune",
      "--verbose",
      `--expire=${evidence.pruneCutoff}`,
    ]);
    if (prune.status !== 0) {
      block(`Git refused metadata-only prune: ${prune.stderr.trim() || "no error text"}`);
    }
    const afterPrune = inspectRegistrationState(repository, { allowNoPrunable: true });
    const newRegistrations = verifyPrune(
      afterSeal,
      afterPrune,
      evidence.registrations.map((registration) => registration.path),
    );
    const lateArrivalPaths = evidence.registrations
      .map((registration) => registration.path)
      .filter((path) => pathEntry(path, `Possible late arrival at ${path}`) !== null)
      .sort();
    return {
      status: "DAMAGED_REGISTRATIONS_RETIRED",
      setSha256: evidence.setSha256,
      pruneCutoff: evidence.pruneCutoff,
      registrations: sealed.map(({ registration: _registration, ...entry }) => entry),
      lateArrivalPaths,
      newRegistrations,
      localBranchAction: "keep",
      remoteBranchAction: "keep",
      bytesDeleted: false,
    };
  } catch (error) {
    const preservedPaths = sealed
      .map((entry) => entry.preservedPath)
      .filter(Boolean);
    const latePaths = evidence.registrations
      .map((registration) => registration.path)
      .filter((path) => pathEntry(path, `Possible late path at ${path}`) !== null);
    const detail = error instanceof Error ? error.message : String(error);
    block(
      `Damaged-registration retirement stopped. Preserved paths: ${JSON.stringify(preservedPaths)}. ` +
        `Paths currently present at registered locations: ${JSON.stringify(latePaths)}. ${detail}`,
    );
  }
}

function parseArgs(argv) {
  const options = {
    execute: false,
    inventory: false,
    generate: false,
    help: false,
    tasklessConfirmations: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--inventory") options.inventory = true;
    else if (argument === "--generate") options.generate = true;
    else if (argument === "--execute") options.execute = true;
    else if (argument === "--evidence") options.evidence = argv[++index];
    else if (argument === "--evidence-out") options.evidenceOut = argv[++index];
    else if (argument === "--review-queue-out") options.reviewQueueOut = argv[++index];
    else if (argument === "--task-snapshot") options.taskSnapshot = argv[++index];
    else if (argument === "--legacy-taskless-confirmation") {
      options.tasklessConfirmations.push(argv[++index]);
    }
    else if (argument === "--confirmation") options.confirmation = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else block(`Unknown argument ${argument}.`);
  }
  if (options.help) return options;
  if (options.generate) {
    if (options.inventory || options.execute || options.evidence || options.confirmation || options.taskSnapshot) {
      block("--generate cannot be combined with inventory, evidence, task, or execution options.");
    }
    requiredString(options.evidenceOut, "--evidence-out");
    requiredString(options.reviewQueueOut, "--review-queue-out");
    return options;
  }
  if (options.inventory) {
    if (
      options.execute ||
      options.evidence !== undefined ||
      options.confirmation !== undefined ||
      options.taskSnapshot !== undefined ||
      options.tasklessConfirmations.length > 0
    ) {
      block("--inventory cannot be combined with evidence or execution options.");
    }
    return options;
  }
  requiredString(options.evidence, "--evidence");
  requiredString(options.taskSnapshot, "--task-snapshot");
  if (options.execute) {
    requiredString(options.confirmation, "--confirmation");
    if (options.taskSnapshot !== "-") {
      block("Execution requires --task-snapshot - so the fresh Codex Desktop snapshot arrives on standard input.");
    }
  } else if (options.taskSnapshot === "-") {
    block("Inspection requires a task snapshot file. Standard input is reserved for execution.");
  }
  else if (options.confirmation !== undefined) block("--confirmation is valid only with --execute.");
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/retire-damaged-worktree-registrations.mjs --inventory
  node scripts/retire-damaged-worktree-registrations.mjs --generate --evidence-out /durable/evidence.json --review-queue-out /durable/review.json
  node scripts/retire-damaged-worktree-registrations.mjs --evidence /durable/evidence.json --task-snapshot /durable/tasks.json
  node scripts/retire-damaged-worktree-registrations.mjs --evidence /durable/evidence.json --task-snapshot - --execute --confirmation "RETIRE DAMAGED REGISTRATIONS <sha256>"`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const repository = inspectScriptRepository();
  const state = inspectRegistrationState(repository);
  if (options.inventory) {
    console.log(JSON.stringify(makeInventory(repository, state), null, 2));
    return;
  }
  if (options.generate) {
    const evidence = makeInventory(repository, state);
    const evidenceOut = exactAbsolutePath(options.evidenceOut, "Evidence output path");
    const reviewQueueOut = exactAbsolutePath(options.reviewQueueOut, "Review queue output path");
    if (evidenceOut === reviewQueueOut) {
      block("Evidence and review queue output paths must be different.");
    }
    validateEvidenceFileLocation(evidenceOut, repository, state.candidates);
    validateEvidenceFileLocation(reviewQueueOut, repository, state.candidates);
    atomicPrivateJson(evidenceOut, evidence, "damaged-registration evidence");
    atomicPrivateJson(reviewQueueOut, makeReviewQueue(evidence), "damaged-registration review queue");
    console.log(JSON.stringify({
      status: "DAMAGED_REGISTRATION_EVIDENCE_GENERATED",
      evidencePath: evidenceOut,
      reviewQueuePath: reviewQueueOut,
      registrationCount: evidence.registrations.length,
      scan: evidence.scan,
    }, null, 2));
    return;
  }
  const evidenceFile = readJsonEvidence(options.evidence);
  validateEvidenceFileLocation(evidenceFile.absolutePath, repository, state.candidates);
  const assessment = validateEvidence(repository, state, evidenceFile.evidence);
  if (!options.execute) {
    const taskSnapshot = readJsonDocument(options.taskSnapshot, "Task snapshot");
    const taskAssessment = validateBatchTaskSnapshot(taskSnapshot, state, evidenceFile.evidence, {
      tasklessConfirmations: options.tasklessConfirmations,
    });
    console.log(JSON.stringify({ ...assessment, tasks: taskAssessment }, null, 2));
    return;
  }
  assertEqual(options.confirmation, assessment.confirmation, "Execution confirmation");
  const report = executeRetirement(
    repository,
    evidenceFile,
    evidenceFile.evidence,
    assessment,
    options.tasklessConfirmations,
  );
  console.log(JSON.stringify(report, null, 2));
}

const isEntrypoint = process.argv[1] ? realpathSync(process.argv[1]) === SCRIPT_PATH : false;
if (isEntrypoint) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`BLOCKED: ${message}`);
    process.exitCode = error instanceof DamagedRegistrationBlockedError ? 2 : 1;
  }
}
