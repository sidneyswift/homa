#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_ORIGIN = "https://github.com/sidneyswift/homa";
const EXPECTED_SCRIPT_RELATIVE_PATH = "scripts/retire-damaged-worktree-registrations.mjs";
const EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;
const PRUNE_CUTOFF_SAFETY_MS = 2 * 1000;
const APPROVER = "sidneyswift";
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
  const indexFile = stableRegularFile(
    join(adminDir, "index"),
    `Administrative index for ${adminName}`,
    50 * 1024 * 1024,
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
      indexSha256: sha256(indexFile.content),
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
  if (!targetStats) return { pathState: "absent", pathIdentity: null };
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
  return { pathState: "directory", pathIdentity: directoryIdentity(targetStats) };
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
  };
}

function registrationIdentity(registration) {
  const evidence = registrationEvidence(registration);
  delete evidence.pathState;
  delete evidence.pathIdentity;
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
  const registrations = state.candidates.map(registrationEvidence).sort(compareByPath);
  return {
    schemaVersion: 1,
    capturedAt,
    pruneCutoff,
    repository: repositoryEvidence(repository),
    registrations,
    setSha256: sha256(JSON.stringify(registrations)),
    approval: {
      approvedBy: "",
      approvedAt: "",
      reason: "",
    },
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
  const file = stableRegularFile(absolutePath, "Evidence file", 20 * 1024 * 1024);
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
  if (evidence.schemaVersion !== 1) block("Evidence schemaVersion must be 1.");
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
  const currentRegistrations = state.candidates.map(registrationEvidence).sort(compareByPath);
  const evidenceRegistrations = [...evidence.registrations].sort(compareByPath);
  assertEqual(
    JSON.stringify(evidenceRegistrations),
    JSON.stringify(currentRegistrations),
    "The exact approved prunable set",
  );
  const setSha256 = sha256(JSON.stringify(evidenceRegistrations));
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

function sealRegistration(registration) {
  if (registration.pathState === "absent") {
    return {
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
    originalPath: registration.path,
    preservedPath,
    sourceInode: registration.pathIdentity.ino,
    sourceDevice: registration.pathIdentity.dev,
  };
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

function executeRetirement(repository, evidenceFile, evidence, assessment) {
  const refreshedEvidence = readJsonEvidence(evidenceFile.absolutePath);
  assertEqual(refreshedEvidence.sha256, evidenceFile.sha256, "Evidence file checksum before mutation");
  const finalState = inspectRegistrationState(repository);
  validateEvidence(repository, finalState, refreshedEvidence.evidence);
  assertEqual(assessment.confirmation, `RETIRE DAMAGED REGISTRATIONS ${evidence.setSha256}`, "Execution confirmation");

  const sealed = [];
  try {
    for (const registration of finalState.candidates) sealed.push(sealRegistration(registration));
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
      registrations: sealed,
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
  const options = { execute: false, inventory: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--inventory") options.inventory = true;
    else if (argument === "--execute") options.execute = true;
    else if (argument === "--evidence") options.evidence = argv[++index];
    else if (argument === "--confirmation") options.confirmation = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else block(`Unknown argument ${argument}.`);
  }
  if (options.help) return options;
  if (options.inventory) {
    if (options.execute || options.evidence !== undefined || options.confirmation !== undefined) {
      block("--inventory cannot be combined with evidence or execution options.");
    }
    return options;
  }
  requiredString(options.evidence, "--evidence");
  if (options.execute) requiredString(options.confirmation, "--confirmation");
  else if (options.confirmation !== undefined) block("--confirmation is valid only with --execute.");
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/retire-damaged-worktree-registrations.mjs --inventory
  node scripts/retire-damaged-worktree-registrations.mjs --evidence /durable/evidence.json
  node scripts/retire-damaged-worktree-registrations.mjs --evidence /durable/evidence.json --execute --confirmation "RETIRE DAMAGED REGISTRATIONS <sha256>"`);
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
  const evidenceFile = readJsonEvidence(options.evidence);
  validateEvidenceFileLocation(evidenceFile.absolutePath, repository, state.candidates);
  const assessment = validateEvidence(repository, state, evidenceFile.evidence);
  if (!options.execute) {
    console.log(JSON.stringify(assessment, null, 2));
    return;
  }
  assertEqual(options.confirmation, assessment.confirmation, "Execution confirmation");
  const report = executeRetirement(repository, evidenceFile, evidenceFile.evidence, assessment);
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
