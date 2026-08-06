#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
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
  ".envrc",
  ".git-credentials",
  ".netrc",
  ".npmrc",
  ".pgpass",
  ".pypirc",
  "application-default-credentials.json",
  "auth.json",
  "credentials",
  "credentials.json",
  "google-services.json",
  "googleservice-info.plist",
  "kubeconfig",
  "local.settings.json",
  "release.keystore",
  "service-account.json",
  "service_account.json",
]);
const SENSITIVE_CREDENTIAL_EXTENSIONS = new Set([
  "bks",
  "cer",
  "cert",
  "crt",
  "csr",
  "der",
  "jceks",
  "jks",
  "key",
  "keychain",
  "keychain-db",
  "kdbx",
  "keystore",
  "mobileprovision",
  "ovpn",
  "p12",
  "p7b",
  "p7c",
  "p8",
  "pem",
  "pfx",
  "pkcs12",
  "ppk",
  "truststore",
]);
const SENSITIVE_STANDALONE_WORDS = new Set([
  "certificate",
  "certificates",
  "credential",
  "credentials",
  "keychain",
  "keystore",
  "passwd",
  "password",
  "secret",
  "secrets",
  "token",
  "tokens",
  "truststore",
]);
const SENSITIVE_COMPOUND_WORDS = new Set([
  "accesskey",
  "accesstoken",
  "apikey",
  "apitoken",
  "applicationdefaultcredentials",
  "authkey",
  "clientsecret",
  "privatekey",
  "refreshtoken",
  "serviceaccount",
  "serviceaccountkey",
  "signingkey",
]);
const SENSITIVE_WORD_SEQUENCES = [
  ["access", "key"],
  ["access", "token"],
  ["api", "key"],
  ["api", "token"],
  ["application", "default", "credentials"],
  ["auth", "key"],
  ["client", "secret"],
  ["google", "application", "credentials"],
  ["id", "dsa"],
  ["id", "ecdsa"],
  ["id", "ed25519"],
  ["id", "rsa"],
  ["private", "key"],
  ["refresh", "token"],
  ["service", "account"],
  ["signing", "key"],
];
const REGENERABLE_DIRECTORY_NAMES = new Set([
  ".cache",
  ".expo",
  ".gradle",
  ".next",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".turbo",
  ".vite",
  "build",
  "cache",
  "coverage",
  "deriveddata",
  "dist",
  "generated",
  "node_modules",
  "out",
  "output",
  "target",
  "tmp",
]);
const TASKLESS_APPROVER = "sidneyswift";
const TASKLESS_REASON = "legacy-lane-predates-task-tracking";
const CLEANUP_NEXT_STEP = "cleanup-coordinator-remove-worktree";
const EVIDENCE_APPROVER = "sidneyswift";
const PRIVATE_FILE_MODE = 0o600;
const STREAM_CHUNK_BYTES = 1024 * 1024;
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

function checkedNulRecords(command, args, options = {}) {
  const outputRoot = mkdtempSync(join(tmpdir(), "homa-worktree-inventory-"));
  const outputPath = join(outputRoot, "records.bin");
  let outputDescriptor;
  try {
    outputDescriptor = openSync(outputPath, "wx", PRIVATE_FILE_MODE);
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: sanitizedSubprocessEnvironment(options.env ?? process.env),
      encoding: "utf8",
      stdio: ["ignore", outputDescriptor, "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
    closeSync(outputDescriptor);
    outputDescriptor = undefined;
    if (result.error) block(`Could not run ${command}: ${result.error.message}`);
    if ((result.status ?? 1) !== 0) {
      block(`${command} ${args.join(" ")} failed: ${result.stderr?.trim() || "no error text"}`);
    }

    const records = [];
    const buffer = Buffer.allocUnsafe(STREAM_CHUNK_BYTES);
    let pending = Buffer.alloc(0);
    const inputDescriptor = openSync(outputPath, "r");
    try {
      for (;;) {
        const bytesRead = readSync(inputDescriptor, buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        let chunk = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
        for (;;) {
          const boundary = chunk.indexOf(0);
          if (boundary === -1) break;
          const record = chunk.subarray(0, boundary);
          const text = record.toString("utf8");
          if (!record.equals(Buffer.from(text, "utf8"))) {
            block(`${command} returned a path that is not valid UTF-8.`);
          }
          records.push(text);
          chunk = chunk.subarray(boundary + 1);
        }
        pending = Buffer.from(chunk);
      }
    } finally {
      closeSync(inputDescriptor);
    }
    if (pending.length !== 0) block(`${command} returned a non-NUL-terminated inventory.`);
    return records;
  } finally {
    if (outputDescriptor !== undefined) closeSync(outputDescriptor);
    rmSync(outputRoot, { recursive: true, force: true });
  }
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

function streamedRegularFile(path, label) {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
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
  const after = lstatSync(path, { bigint: true });
  if (!sameFileState(before, after) || bytesReadTotal !== before.size) {
    block(`${label} changed while it was being fingerprinted.`);
  }
  return {
    stats: before,
    sizeBytes: String(before.size),
    sha256: hash.digest("hex"),
  };
}

function atomicPrivateJson(path, value, label) {
  if (!isAbsolute(path) || resolve(path) !== path) block(`${label} path must be absolute and normalized.`);
  const parent = dirname(path);
  const parentStats = lstatSync(parent, { bigint: true });
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink() || realpathSync(parent) !== parent) {
    block(`${label} parent must be one real directory with no path alias.`);
  }
  const temporary = join(parent, `.${randomBytes(16).toString("hex")}.tmp`);
  const content = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;
  try {
    descriptor = openSync(temporary, "wx", PRIVATE_FILE_MODE);
    writeFileSync(descriptor, content, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    chmodSync(temporary, PRIVATE_FILE_MODE);
    renameSync(temporary, path);
    chmodSync(path, PRIVATE_FILE_MODE);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      rmSync(temporary, { force: true });
    } catch {
      // Leave an unexpected artifact visible rather than hiding the original failure.
    }
    block(`Could not write ${label} atomically: ${error instanceof Error ? error.message : String(error)}`);
  }
  const stats = lstatSync(path, { bigint: true });
  if (!stats.isFile() || stats.isSymbolicLink() || (stats.mode & 0o777n) !== BigInt(PRIVATE_FILE_MODE)) {
    block(`${label} was not written as an owner-only regular file.`);
  }
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

function canonicalPathIfPresent(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function isEphemeralOperatingSystemTemporaryPath(path) {
  const temporaryRoots = [
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
  if (temporaryRoots.some((root) => isInside(path, root))) return true;

  const portablePath = path.replaceAll("\\", "/");
  return (
    /^\/(?:private\/)?var\/folders\/[^/]+\/[^/]+\/T(?:\/|$)/u.test(portablePath) ||
    /^\/run\/user\/\d+(?:\/|$)/u.test(portablePath)
  );
}

function requireDurableArtifactPath(path, label) {
  if (isEphemeralOperatingSystemTemporaryPath(path)) {
    block(`${label} is under ephemeral operating-system temporary storage and is not durable.`);
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

function githubBranchHead(origin, branch, objectFormat, { allowMissing = false } = {}) {
  const repository = githubRepositoryFromOrigin(origin);
  const branchName = requiredString(branch, "GitHub branch");
  const endpoint = `repos/${repository}/git/ref/heads/${encodeURIComponent(branchName)}`;
  const result = commandResult("gh", [
    "api",
    endpoint,
    "--hostname",
    "github.com",
    "--header",
    "Accept: application/vnd.github+json",
  ]);
  if (result.status !== 0) {
    if (allowMissing && /\(HTTP 404\)/u.test(result.stderr)) return null;
    block(`Could not verify GitHub branch ${branchName}: ${result.stderr.trim() || "no error text"}`);
  }

  const response = parseCommandJson(result.stdout, `GitHub branch ${branchName} lookup`);
  assertEqual(response.ref, `refs/heads/${branchName}`, `GitHub branch ${branchName} reference`);
  if (response.object?.type !== "commit") {
    block(`GitHub branch ${branchName} did not resolve to a commit.`);
  }
  const head = requiredString(response.object.sha, `GitHub branch ${branchName} head`);
  const expectedLength = objectFormat === "sha1" ? 40 : objectFormat === "sha256" ? 64 : null;
  if (expectedLength === null || !new RegExp(`^[a-f0-9]{${expectedLength}}$`, "u").test(head)) {
    block(`GitHub branch ${branchName} returned an invalid ${objectFormat} object ID.`);
  }
  return head;
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

function pathSegments(path) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean);
}

function normalizedNameWords(value) {
  return value
    .normalize("NFKC")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function containsWordSequence(words, sequence) {
  for (let index = 0; index <= words.length - sequence.length; index += 1) {
    if (sequence.every((word, offset) => words[index + offset] === word)) return true;
  }
  return false;
}

function isEnvironmentFileName(leaf) {
  const words = normalizedNameWords(leaf);
  return (
    words.some((word) => ["env", "environment", "environments", "envrc"].includes(word)) ||
    containsWordSequence(words, ["config", "local"]) ||
    containsWordSequence(words, ["local", "config"]) ||
    containsWordSequence(words, ["local", "settings"]) ||
    containsWordSequence(words, ["settings", "local"])
  );
}

function hasSensitiveName(words) {
  if (words.some((word) => SENSITIVE_STANDALONE_WORDS.has(word))) return true;
  if (words.some((word) => SENSITIVE_COMPOUND_WORDS.has(word))) return true;
  return SENSITIVE_WORD_SEQUENCES.some((sequence) => containsWordSequence(words, sequence));
}

function hasSensitiveCredentialExtension(leaf) {
  return leaf
    .split(".")
    .slice(1)
    .some((suffix) => SENSITIVE_CREDENTIAL_EXTENSIONS.has(suffix));
}

function hasKnownSensitiveFilename(leaf) {
  return [...SENSITIVE_IGNORED_FILENAMES].some(
    (sensitiveName) => leaf === sensitiveName || leaf.startsWith(`${sensitiveName}.`),
  );
}

function isSensitiveIgnoredPath(path) {
  const segments = pathSegments(path);
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const leaf = lowerSegments.at(-1) ?? "";
  const parent = lowerSegments.at(-2) ?? "";

  if (
    lowerSegments.some((segment) =>
      [".aws", ".direnv", ".gnupg", ".kube", ".ssh"].includes(segment),
    )
  ) {
    return true;
  }
  if (parent === ".docker" && leaf === "config.json") return true;
  if (isEnvironmentFileName(leaf)) return true;
  if (hasSensitiveCredentialExtension(leaf)) return true;
  if (hasKnownSensitiveFilename(leaf)) return true;
  if (/^id_(?:dsa|ecdsa|ed25519|rsa)(?:\.pub)?$/u.test(leaf)) return true;
  return segments.some((segment) => hasSensitiveName(normalizedNameWords(segment)));
}

function isApprovedRegenerablePath(path) {
  const parentSegments = pathSegments(path).slice(0, -1);
  return parentSegments.some((segment) => REGENERABLE_DIRECTORY_NAMES.has(segment.toLowerCase()));
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
  let sizeBytes;
  let contentSha256;
  if (before.isFile()) {
    kind = "file";
    const streamed = streamedRegularFile(absolutePath, `Ignored path ${JSON.stringify(path)}`);
    sizeBytes = streamed.sizeBytes;
    contentSha256 = streamed.sha256;
  } else if (before.isSymbolicLink()) {
    kind = "symlink";
    const content = readlinkSync(absolutePath, { encoding: "buffer" });
    sizeBytes = String(before.size);
    contentSha256 = sha256(content);
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
    sizeBytes,
    sha256: contentSha256,
  };
}

function ignoredEntriesFromGit(target) {
  const paths = checkedNulRecords("git", [
    "-C",
    target,
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "-z",
  ]);
  if (new Set(paths).size !== paths.length) block("Git returned a duplicate ignored path.");
  return paths.map((path) => ignoredFileFingerprint(target, path)).sort(comparePaths);
}

function isBareGitRepositoryDirectory(absolutePath, entries) {
  const names = new Set(entries.map((entry) => entry.name));
  if (!["HEAD", "config", "objects", "refs"].every((name) => names.has(name))) return false;

  let headStats;
  let configStats;
  let objectsStats;
  let refsStats;
  try {
    headStats = lstatSync(join(absolutePath, "HEAD"));
    configStats = lstatSync(join(absolutePath, "config"));
    objectsStats = lstatSync(join(absolutePath, "objects"));
    refsStats = lstatSync(join(absolutePath, "refs"));
  } catch (error) {
    block(
      `Bare Git repository candidate changed during inspection: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    !headStats.isFile() ||
    headStats.size > 4096 ||
    !configStats.isFile() ||
    !objectsStats.isDirectory() ||
    !refsStats.isDirectory()
  ) {
    return false;
  }

  let head;
  try {
    head = readFileSync(join(absolutePath, "HEAD"), "utf8").trim();
  } catch (error) {
    block(
      `Bare Git repository HEAD is unreadable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
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

function assertNoNestedGitEntries(target) {
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
        `Could not inspect ${JSON.stringify(current.relativePath || ".")} for nested Git metadata: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (
      current.relativePath !== "" &&
      isBareGitRepositoryDirectory(current.absolutePath, entries)
    ) {
      block(
        `Nested bare Git repository ${JSON.stringify(current.relativePath)} preserves separate Git history.`,
      );
    }

    for (const entry of entries) {
      const relativePath = current.relativePath
        ? `${current.relativePath}/${entry.name}`
        : entry.name;
      if (entry.name.toLowerCase() === ".git") {
        if (current.relativePath === "") continue;
        block(`Nested .git entry ${JSON.stringify(relativePath)} preserves separate Git history.`);
      }

      const absolutePath = join(current.absolutePath, entry.name);
      let stats;
      try {
        stats = lstatSync(absolutePath);
      } catch (error) {
        block(
          `Could not inspect ${JSON.stringify(relativePath)} for nested Git metadata: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      if (stats.isDirectory()) pending.push({ absolutePath, relativePath });
    }
  }
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
  requireDurableArtifactPath(artifact, "The recovery artifact");
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
  assertNoNestedGitEntries(target);

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
  const remoteBaseHead = githubBranchHead(origin, baseBranchMatch[1], objectFormat);
  assertEqual(localBaseHead, remoteBaseHead, `Local base ${baseRef} compared with its remote`);

  const uniqueCommitCount = Number(git(target, ["rev-list", "--count", `${baseRef}..HEAD`]).trim());
  const integrated = gitResult(target, ["merge-base", "--is-ancestor", "HEAD", baseRef]).status === 0;
  let remoteHead = null;
  let bundle = null;
  if (evidence?.recovery?.kind === "remote-branch") {
    if (!branch) block("A detached worktree cannot use remote-branch recovery.");
    const reference = requiredString(evidence.recovery.reference, "recovery.reference");
    const referenceMatch = reference.match(/^refs\/heads\/(.+)$/u);
    if (!referenceMatch) block("recovery.reference must name a GitHub branch.");
    remoteHead = githubBranchHead(origin, referenceMatch[1], objectFormat, { allowMissing: true });
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
  const retirementScan = snapshot.retirementScan;
  if (!retirementScan || typeof retirementScan !== "object" || Array.isArray(retirementScan)) {
    block("Task snapshot retirementScan binding is required.");
  }
  assertEqual(retirementScan.nonce, evidence.scan?.nonce, "Task snapshot scan nonce");
  assertEqual(retirementScan.sha256, evidence.scan?.sha256, "Task snapshot scan digest");
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
    if (disposition === "regenerable") {
      if (isSensitiveIgnoredPath(decision.path)) {
        block(`Sensitive ignored path ${decision.path} cannot be classified as regenerable.`);
      }
      if (!isApprovedRegenerablePath(decision.path)) {
        block(
          `Ignored path ${decision.path} is outside an approved generated, cache, build, or output directory.`,
        );
      }
    }
    if (disposition === "backed-up-private") {
      const backup = decision.backup;
      if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
        block(`Ignored path ${decision.path} needs exact private backup evidence.`);
      }
      const artifactPath = absoluteRealPath(
        requiredString(backup.artifactPath, `Ignored path ${decision.path} backup.artifactPath`),
        `Ignored path ${decision.path} backup artifact`,
      );
      requireDurableArtifactPath(artifactPath, `Ignored path ${decision.path} private backup`);
      if (isInside(artifactPath, current.target)) {
        block(`Ignored path ${decision.path} private backup is inside the worktree being removed.`);
      }
      const artifact = streamedRegularFile(
        artifactPath,
        `Ignored path ${decision.path} private backup artifact`,
      );
      const artifactParent = lstatSync(dirname(artifactPath), { bigint: true });
      if (!artifactParent.isDirectory() || artifactParent.isSymbolicLink()) {
        block(`Ignored path ${decision.path} private backup parent is not a real directory.`);
      }
      if (typeof process.getuid === "function" && artifact.stats.uid !== BigInt(process.getuid())) {
        block(`Ignored path ${decision.path} private backup is not owned by the current user.`);
      }
      if (
        typeof process.getuid === "function" &&
        artifactParent.uid !== BigInt(process.getuid())
      ) {
        block(`Ignored path ${decision.path} private backup parent is not owned by the current user.`);
      }
      if ((artifact.stats.mode & 0o077n) !== 0n || (artifactParent.mode & 0o077n) !== 0n) {
        block(`Ignored path ${decision.path} private backup is readable or writable by another user.`);
      }
      assertEqual(backup.artifactSha256, artifact.sha256, `Ignored path ${decision.path} backup checksum`);
      assertEqual(backup.artifactSizeBytes, artifact.sizeBytes, `Ignored path ${decision.path} backup size`);
      assertEqual(backup.sourceSha256, decision.sha256, `Ignored path ${decision.path} backed-up source checksum`);
      assertEqual(backup.sourceSizeBytes, decision.sizeBytes, `Ignored path ${decision.path} backed-up source size`);
      assertEqual(artifact.sha256, decision.sha256, `Ignored path ${decision.path} exact private backup content`);
      assertEqual(artifact.sizeBytes, decision.sizeBytes, `Ignored path ${decision.path} exact private backup bytes`);
      const checkedAt = parsedTime(backup.checkedAt, `Ignored path ${decision.path} backup.checkedAt`);
      if (checkedAt > now) block(`Ignored path ${decision.path} backup.checkedAt is in the future.`);
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

export function retirementScanSha256(current) {
  return sha256(
    JSON.stringify({
      target: current.target,
      registeredPath: current.registeredPath,
      repositoryRoot: current.repositoryRoot,
      commonGitDir: current.commonGitDir,
      origin: current.origin,
      head: current.head,
      tree: current.tree,
      branch: current.branch,
      baseRef: current.baseRef,
      uniqueCommitCount: current.uniqueCommitCount,
      integrated: current.integrated,
      statusLines: current.statusLines,
      ignoredEntries: current.ignoredEntries,
      patchSha256: current.patchSha256,
      remoteHead: current.remoteHead,
      bundleArtifactSha256: current.bundle?.artifactSha256 ?? null,
      bundleRestoredHead: current.bundle?.restoredHead ?? null,
      bundleRestoredTree: current.bundle?.restoredTree ?? null,
    }),
  );
}

function validateScanBinding(current, evidence, now) {
  const scan = evidence.scan;
  if (!scan || typeof scan !== "object" || Array.isArray(scan)) {
    block("Evidence scan binding is required.");
  }
  if (scan.version !== 1) block("Evidence scan.version must be 1.");
  const nonce = requiredString(scan.nonce, "Evidence scan.nonce");
  if (!/^[a-f0-9]{64}$/u.test(nonce)) block("Evidence scan.nonce must be 32 random bytes in lowercase hex.");
  assertEqual(scan.sha256, retirementScanSha256(current), "Evidence scan digest");

  const approval = evidence.approval;
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    block("Evidence approval is required.");
  }
  assertEqual(
    requiredString(approval.approvedBy, "approval.approvedBy"),
    EVIDENCE_APPROVER,
    "Evidence approver",
  );
  requiredString(approval.reason, "approval.reason");
  const approvedAt = parsedTime(approval.approvedAt, "approval.approvedAt");
  if (approvedAt > now) block("approval.approvedAt is in the future.");
  const capturedAt = parsedTime(evidence.capturedAt, "Evidence capturedAt");
  if (approvedAt < capturedAt) block("approval.approvedAt predates the generated scan.");
  assertEqual(approval.scanNonce, nonce, "Approval scan nonce");
  assertEqual(approval.scanSha256, scan.sha256, "Approval scan digest");
  return scan;
}

export function assessRemoval({
  current,
  evidence,
  taskSnapshot,
  github,
  now = Date.now(),
  taskMaxAgeMs = TASK_SNAPSHOT_MAX_AGE_MS,
  legacyTasklessConfirmation,
  skipTaskValidation = false,
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
  const scan = validateScanBinding(current, evidence, now);

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

  const matchingTasks = skipTaskValidation
    ? []
    : validateTaskSnapshot(taskSnapshot, current, evidence, {
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
    scanNonce: scan.nonce,
    scanSha256: scan.sha256,
    remoteBranchAction: "keep",
    confirmation: `REMOVE ${current.target}`,
  };
}

function parseArgs(argv) {
  const options = { execute: false, generate: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") options.execute = true;
    else if (argument === "--generate") options.generate = true;
    else if (argument === "--target") options.target = argv[++index];
    else if (argument === "--evidence") options.evidence = argv[++index];
    else if (argument === "--evidence-out") options.evidenceOut = argv[++index];
    else if (argument === "--review-queue-out") options.reviewQueueOut = argv[++index];
    else if (argument === "--base-ref") options.baseRef = argv[++index];
    else if (argument === "--issue-number") options.issueNumber = Number(argv[++index]);
    else if (argument === "--recovery-bundle") options.recoveryBundle = argv[++index];
    else if (argument === "--handoff-url") options.handoffUrl = argv[++index];
    else if (argument === "--issue-disposition") options.issueDisposition = argv[++index];
    else if (argument === "--task-snapshot") options.taskSnapshot = argv[++index];
    else if (argument === "--confirmation") options.confirmation = argv[++index];
    else if (argument === "--remote-branch-action") options.remoteBranchAction = argv[++index];
    else if (argument === "--legacy-taskless-confirmation") {
      options.legacyTasklessConfirmation = argv[++index];
    } else block(`Unknown argument ${argument}.`);
  }
  if (options.generate) {
    if (options.execute) block("--generate cannot be combined with --execute.");
    for (const name of ["target", "evidenceOut", "reviewQueueOut"]) {
      requiredString(options[name], `--${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
    }
    for (const forbidden of ["evidence", "taskSnapshot", "confirmation", "remoteBranchAction"]) {
      if (options[forbidden] !== undefined) block(`--generate cannot be combined with --${forbidden}.`);
    }
    return options;
  }
  for (const name of ["target", "evidence", "taskSnapshot"]) {
    requiredString(options[name], `--${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return options;
}

function ensureDurableEvidence(path, target) {
  const evidencePath = absoluteRealPath(path, "evidence file");
  requireDurableArtifactPath(evidencePath, "The removal evidence file");
  if (isInside(evidencePath, target)) block("The removal evidence file cannot live inside the worktree being removed.");
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

function prepareQuarantine(current) {
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
  return { quarantineRoot, quarantinePath };
}

function quarantineWorktree(current, evidence, expectedRepository, now, prepared) {
  const { quarantineRoot, quarantinePath } = prepared;
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

function sealQuarantinedWorktree(quarantine) {
  const preservedPath = join(quarantine.quarantineRoot, "preserved-worktree");
  if (pathEntryExists(preservedPath, "possible preserved worktree path")) {
    block(`The preserved worktree path already exists at ${preservedPath}.`);
  }
  try {
    renameSync(quarantine.quarantinePath, preservedPath);
  } catch (error) {
    block(
      `Could not atomically seal the quarantined worktree at ${preservedPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    pathEntryExists(quarantine.quarantinePath, "registered quarantine path after sealing") ||
    !pathEntryExists(preservedPath, "preserved worktree after sealing")
  ) {
    block(
      `The worktree may be preserved at ${preservedPath}, but the atomic seal could not be confirmed.`,
    );
  }
  return { ...quarantine, preservedPath };
}

function generatedRecovery(current, now) {
  const common = {
    sourceHead: current.head,
    sourceTree: current.tree,
    patchSha256: current.patchSha256,
    restoredHead: current.head,
    restoredTree: current.tree,
    restoreTestedAt: now,
  };
  if (current.integrated && current.uniqueCommitCount === 0) {
    return { kind: "integrated", ...common };
  }
  if (current.remoteHead === current.head && current.branch) {
    return { kind: "remote-branch", reference: `refs/heads/${current.branch}`, ...common };
  }
  if (current.bundle) {
    return {
      kind: "bundle",
      artifactPath: current.bundle.artifact,
      artifactSha256: current.bundle.artifactSha256,
      ...common,
    };
  }
  block("The lane has local-only commits. Generate a full recovery bundle and pass --recovery-bundle.");
}

function generateRetirementEvidence(options) {
  const expectedRepository = inspectScriptRepository();
  const baseRef = options.baseRef ?? "origin/main";
  const seedEvidence = {
    worktree: { baseRef },
    recovery: options.recoveryBundle
      ? { kind: "bundle", artifactPath: options.recoveryBundle }
      : { kind: "integrated" },
  };
  let current = inspectLocalState(options.target, seedEvidence, expectedRepository);
  if (!current.integrated && current.branch && !options.recoveryBundle) {
    const remoteHead = githubBranchHead(current.origin, current.branch, git(current.target, ["rev-parse", "--show-object-format"]).trim(), {
      allowMissing: true,
    });
    if (remoteHead === current.head) {
      current = inspectLocalState(
        options.target,
        {
          worktree: { baseRef },
          recovery: { kind: "remote-branch", reference: `refs/heads/${current.branch}` },
        },
        expectedRepository,
      );
    }
  }
  const generatedAt = new Date().toISOString();
  const recovery = generatedRecovery(current, generatedAt);
  const issueNumber = branchIssueNumber(current.branch) ?? options.issueNumber;
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    block("The generator needs --issue-number when the branch does not carry a gh issue number.");
  }
  const github = inspectGithub(
    current,
    issueNumber,
    options.handoffUrl,
    recovery.kind,
  );
  const ignoredDispositions = current.ignoredEntries.map((entry) => {
    const automatic = !isSensitiveIgnoredPath(entry.path) && isApprovedRegenerablePath(entry.path);
    return {
      ...entry,
      disposition: automatic ? "regenerable" : "review-required",
      reason: automatic ? "Generated or cached content can be recreated from the retained source." : "",
      decidedAt: automatic ? generatedAt : "",
    };
  });
  const scan = {
    version: 1,
    nonce: randomBytes(32).toString("hex"),
    sha256: retirementScanSha256(current),
  };
  const issueDisposition = github.issue.state === "CLOSED"
    ? "closed"
    : options.issueDisposition ?? "review-required";
  const evidence = {
    schemaVersion: 2,
    capturedAt: generatedAt,
    repository: {
      root: current.repositoryRoot,
      commonGitDir: current.commonGitDir,
      origin: current.origin,
    },
    worktree: {
      path: current.target,
      registeredPath: current.registeredPath,
      gitDir: current.gitDir,
      head: current.head,
      tree: current.tree,
      branch: current.branch,
      baseRef: current.baseRef,
      patchSha256: current.patchSha256,
      ignoredDispositions,
    },
    issue: {
      number: github.issue.number,
      state: github.issue.state,
      url: github.issue.url,
      disposition: issueDisposition,
      ...(options.handoffUrl ? { handoffUrl: options.handoffUrl } : {}),
    },
    task: {},
    recovery,
    scan,
    approval: {
      approvedBy: "",
      approvedAt: "",
      reason: "",
      scanNonce: scan.nonce,
      scanSha256: scan.sha256,
    },
  };
  const reviewItems = [
    {
      kind: "approval",
      action: "Review every evidence field, then complete the approval object without changing the scan binding.",
    },
  ];
  for (const decision of ignoredDispositions.filter((entry) => entry.disposition === "review-required")) {
    reviewItems.push({
      kind: isSensitiveIgnoredPath(decision.path) ? "private-backup" : "ignored-file",
      path: decision.path,
      sha256: decision.sha256,
      sizeBytes: decision.sizeBytes,
      action: isSensitiveIgnoredPath(decision.path)
        ? "Create an exact owner-only durable backup and record its artifact proof."
        : "Choose discard-approved or backed-up-private and record the exact decision.",
    });
  }
  if (github.issue.state === "OPEN" && issueDisposition === "review-required") {
    reviewItems.push({
      kind: "open-issue",
      issue: github.issue.number,
      action: "Record an updated-open or replacement-active handoff comment and its exact URL.",
    });
  }
  reviewItems.push({
    kind: "execution-task-snapshot",
    action: "Pipe a fresh complete Codex Desktop task snapshot with this scan nonce and digest at execution time.",
  });

  const evidenceOut = resolve(options.evidenceOut);
  const reviewQueueOut = resolve(options.reviewQueueOut);
  if (evidenceOut === reviewQueueOut) {
    block("Evidence and review queue output paths must be different.");
  }
  for (const [path, label] of [
    [evidenceOut, "Evidence output"],
    [reviewQueueOut, "Review queue output"],
  ]) {
    if (path !== options[label === "Evidence output" ? "evidenceOut" : "reviewQueueOut"]) {
      block(`${label} path must be absolute and normalized.`);
    }
    requireDurableArtifactPath(path, label);
    if (isInside(path, current.target) || isInside(path, current.commonGitDir)) {
      block(`${label} cannot be inside the target worktree or common Git directory.`);
    }
  }
  atomicPrivateJson(evidenceOut, evidence, "retirement evidence");
  atomicPrivateJson(
    reviewQueueOut,
    {
      schemaVersion: 1,
      generatedAt,
      evidencePath: evidenceOut,
      scan,
      target: current.target,
      issue: github.issue.number,
      items: reviewItems,
    },
    "retirement review queue",
  );
  return {
    status: "RETIREMENT_EVIDENCE_GENERATED",
    evidencePath: evidenceOut,
    reviewQueuePath: reviewQueueOut,
    reviewItemCount: reviewItems.length,
    scan,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.generate) {
    console.log(JSON.stringify(generateRetirementEvidence(options), null, 2));
    return;
  }
  const evidencePath = absoluteRealPath(options.evidence, "evidence file");
  if (options.execute && options.taskSnapshot !== "-") {
    block("Execution requires --task-snapshot - so the fresh Codex Desktop snapshot arrives on standard input.");
  }
  if (!options.execute && options.taskSnapshot === "-") {
    block("Inspection requires a task snapshot file. Standard input is reserved for the execution boundary.");
  }
  const taskSnapshotPath = options.taskSnapshot === "-"
    ? null
    : absoluteRealPath(options.taskSnapshot, "task snapshot");
  const evidence = readJson(evidencePath, "Evidence file");
  const taskSnapshot = taskSnapshotPath ? readJson(taskSnapshotPath, "Task snapshot") : null;
  const expectedRepository = inspectScriptRepository();
  const current = inspectLocalState(options.target, evidence, expectedRepository);
  ensureDurableEvidence(evidencePath, current.target);
  const issueNumber = branchIssueNumber(current.branch) ?? evidence.issue?.number;
  if (!Number.isInteger(issueNumber)) block("Could not determine the owning issue number.");
  const github = inspectGithub(current, issueNumber, evidence.issue?.handoffUrl, evidence.recovery?.kind);
  const assessment = assessRemoval({
    current,
    evidence,
    taskSnapshot,
    github,
    legacyTasklessConfirmation: options.legacyTasklessConfirmation,
    skipTaskValidation: options.execute,
  });

  if (!options.execute) {
    console.log(JSON.stringify(assessment, null, 2));
    return;
  }
  if (options.remoteBranchAction !== "keep") {
    block("Execution requires --remote-branch-action keep. This wrapper never deletes remote branches.");
  }
  assertEqual(options.confirmation, assessment.confirmation, "Removal confirmation");

  const finalGithub = inspectGithub(current, issueNumber, evidence.issue?.handoffUrl, evidence.recovery?.kind);
  const finalCurrent = inspectLocalState(options.target, evidence, expectedRepository);
  const finalAssessment = assessRemoval({
    current: finalCurrent,
    evidence,
    taskSnapshot: null,
    github: finalGithub,
    legacyTasklessConfirmation: options.legacyTasklessConfirmation,
    skipTaskValidation: true,
  });
  assertEqual(options.confirmation, finalAssessment.confirmation, "Final removal confirmation");

  const preparedQuarantine = prepareQuarantine(finalCurrent);
  process.stderr.write(
    `READY_FOR_FINAL_CODEX_TASK_SNAPSHOT ${JSON.stringify({
      scanNonce: evidence.scan.nonce,
      scanSha256: evidence.scan.sha256,
      maxAgeSeconds: EXECUTION_TASK_REFRESH_MAX_AGE_MS / 1000,
    })}\n`,
  );
  const refreshedTaskSnapshot = readJsonFromStandardInput("Final Codex Desktop task snapshot");
  validateTaskSnapshot(refreshedTaskSnapshot, finalCurrent, evidence, {
    maxAgeMs: EXECUTION_TASK_REFRESH_MAX_AGE_MS,
    legacyTasklessConfirmation: options.legacyTasklessConfirmation,
    github: finalGithub,
  });

  // No Git or network call occurs after the task proof and before this move.
  // Git performs the registered same-filesystem move as the preservation boundary.
  const quarantine = quarantineWorktree(
    finalCurrent,
    evidence,
    expectedRepository,
    Date.now(),
    preparedQuarantine,
  );
  const sealed = sealQuarantinedWorktree(quarantine);
  const removal = commandResult("git", [
    "-C",
    sealed.quarantined.repositoryRoot,
    "worktree",
    "remove",
    sealed.quarantined.registeredPath,
  ]);
  if (removal.status !== 0) {
    block(
      `Worktree content is preserved at ${sealed.preservedPath}: Git refused normal registration removal: ${removal.stderr.trim()}`,
    );
  }
  try {
    confirmRemovalGone(sealed.quarantined);
  } catch (error) {
    block(
      `Worktree content is preserved at ${sealed.preservedPath}, but registration removal could not be confirmed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (pathEntryExists(finalCurrent.target, "original worktree path after removal")) {
    block("The original worktree path reappeared after quarantine removal.");
  }
  console.log(
    JSON.stringify(
      {
        status: "WORKTREE_REGISTRATION_REMOVED",
        target: finalCurrent.target,
        preservedPath: sealed.preservedPath,
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
