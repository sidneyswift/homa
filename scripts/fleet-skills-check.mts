#!/usr/bin/env node --experimental-strip-types
/**
 * The fleet-skill package doctor
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md §8.1,
 * §4.3). Deterministic, no model, no network: validates every package under
 * apps/web/agent/skills/ and checks slash-menu parity against
 * apps/web/lib/slash-skills.ts.
 *
 * Usage: node --experimental-strip-types scripts/fleet-skills-check.mts
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BUILT_IN_SKILLS } from "../apps/web/lib/slash-skills.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "apps/web/agent/skills");
const toolsRoot = path.join(repoRoot, "apps/web/agent/tools");

const MAX_SIBLING_FILES = 50;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const EM_DASH = "\u2014";
// Zero-width and bidi-control formatting characters plus C0/C1 controls
// (tab and newline excluded; they are normal markdown content).
// eslint-disable-next-line no-control-regex
const CONTROL_OR_FORMAT_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]/u;
const SECRET_FILENAME = /(^\.env|\.env\.|\.key$|\.pem$|\.crt$|\.pfx$|^id_rsa|credentials)/i;
const TEXT_FILE_EXTENSION = /\.(md|mdx|ts|tsx|js|mjs|mts|json|txt|yml|yaml|css|html)$/i;

const failures: string[] = [];
function fail(message: string): void {
  failures.push(message);
  console.log(`FAIL  ${message}`);
}
function pass(message: string): void {
  console.log(`PASS  ${message}`);
}

interface FileEntry {
  relativePath: string;
  absolutePath: string;
  bytes: number;
}

function walkPackageFiles(packageDir: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const stack = [""];
  while (stack.length > 0) {
    const relDir = stack.pop() as string;
    const absDir = path.join(packageDir, relDir);
    for (const name of readdirSync(absDir)) {
      const relativePath = relDir ? `${relDir}/${name}` : name;
      const absolutePath = path.join(absDir, name);
      const stats = lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        entries.push({ relativePath, absolutePath, bytes: 0 });
        continue;
      }
      if (stats.isDirectory()) {
        stack.push(relativePath);
        continue;
      }
      entries.push({ relativePath, absolutePath, bytes: stats.size });
    }
  }
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function checkPathSafety(packageName: string, entry: FileEntry): void {
  const label = `${packageName}/${entry.relativePath}`;
  if (path.isAbsolute(entry.relativePath)) fail(`${label}: absolute path inside a package`);
  if (entry.relativePath.includes("\\")) fail(`${label}: backslash in a package-relative path`);
  const segments = entry.relativePath.split("/");
  for (const segment of segments) {
    if (segment.length === 0) fail(`${label}: empty path segment`);
    if (segment === "." || segment === "..") fail(`${label}: '.' or '..' path segment`);
  }
  if (SECRET_FILENAME.test(path.basename(entry.relativePath))) {
    fail(`${label}: secret-bearing filename pattern`);
  }
  const stats = lstatSync(entry.absolutePath);
  if (stats.isSymbolicLink()) {
    fail(`${label}: symlinks are not allowed inside a package`);
    return;
  }
  if (stats.nlink > 1) fail(`${label}: hardlink detected (nlink=${stats.nlink})`);
  if (stats.size > MAX_FILE_BYTES) {
    fail(`${label}: ${stats.size} bytes exceeds the ${MAX_FILE_BYTES}-byte per-file cap`);
  }
  if (TEXT_FILE_EXTENSION.test(entry.relativePath)) {
    const content = readFileSync(entry.absolutePath, "utf8");
    if (content.includes(EM_DASH)) fail(`${label}: contains an em dash`);
    if (CONTROL_OR_FORMAT_CHAR.test(content)) {
      fail(`${label}: contains a Unicode control or format character`);
    }
  }
}

interface Frontmatter {
  description?: string;
  metadata?: { "homa-tools"?: string; "homa-related-skills"?: string };
}

/** SKILL.md frontmatter is deliberately flat (a description line, an
 * optional one-level metadata block); a hand-rolled parser keeps this
 * script dependency-free rather than pulling in a full YAML library for
 * two possible keys. */
function parseFrontmatter(content: string): Frontmatter | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return null;
  const frontmatter: Frontmatter = {};
  const lines = match[1].split("\n");
  let inMetadata = false;
  for (const rawLine of lines) {
    if (rawLine.trim().length === 0) continue;
    if (/^metadata:\s*$/.test(rawLine)) {
      inMetadata = true;
      frontmatter.metadata = {};
      continue;
    }
    const indented = /^\s+/.test(rawLine);
    if (inMetadata && indented) {
      const entryMatch = /^\s+([\w-]+):\s*(.*)$/.exec(rawLine);
      if (entryMatch && frontmatter.metadata) {
        const [, key, value] = entryMatch;
        if (key === "homa-tools" || key === "homa-related-skills") {
          frontmatter.metadata[key] = value.trim();
        }
      }
      continue;
    }
    inMetadata = false;
    const topMatch = /^([\w-]+):\s*(.*)$/.exec(rawLine);
    if (topMatch && topMatch[1] === "description") {
      frontmatter.description = topMatch[2].trim();
    }
  }
  return frontmatter;
}

/** Package identity digest (§4.3): SHA-256 over the sorted sequence of
 * relative-path NUL byte-length NUL content-bytes. Reported for build
 * provenance; not itself a pass/fail condition. */
function packageDigest(packageDir: string, files: FileEntry[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    const content = readFileSync(file.absolutePath);
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(String(content.byteLength));
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function checkPackage(packageName: string, toolNames: Set<string>, packageNames: Set<string>): string | null {
  const packageDir = path.join(skillsRoot, packageName);
  const skillMdPath = path.join(packageDir, "SKILL.md");
  try {
    statSync(skillMdPath);
  } catch {
    fail(`${packageName}: missing SKILL.md`);
    return null;
  }

  const files = walkPackageFiles(packageDir);
  for (const file of files) checkPathSafety(packageName, file);

  const siblingCount = files.length - 1; // exclude SKILL.md itself
  if (siblingCount > MAX_SIBLING_FILES) {
    fail(`${packageName}: ${siblingCount} sibling files exceeds the ${MAX_SIBLING_FILES}-file cap`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > MAX_PACKAGE_BYTES) {
    fail(`${packageName}: ${totalBytes} bytes exceeds the ${MAX_PACKAGE_BYTES}-byte total package cap`);
  }

  const content = readFileSync(skillMdPath, "utf8");
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    fail(`${packageName}: SKILL.md has no valid frontmatter block`);
    return null;
  }
  if (!frontmatter.description || frontmatter.description.length === 0) {
    fail(`${packageName}: frontmatter description is empty`);
    return null;
  }

  for (const [metadataKey, resolveAgainst, resolveLabel] of [
    ["homa-tools", toolNames, "an authored tool"],
    ["homa-related-skills", packageNames, "a discovered package"],
  ] as const) {
    const raw = frontmatter.metadata?.[metadataKey];
    if (!raw) continue;
    for (const identifier of raw.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      if (!resolveAgainst.has(identifier)) {
        fail(`${packageName}: metadata.${metadataKey} references "${identifier}", which is not ${resolveLabel}`);
      }
    }
  }

  const digest = packageDigest(packageDir, files);
  pass(`${packageName}: ${files.length} file(s), ${totalBytes} bytes, digest ${digest.slice(0, 12)}...`);
  return frontmatter.description;
}

function main(): void {
  const packageNames = readdirSync(skillsRoot).filter((name) => {
    const full = path.join(skillsRoot, name);
    return statSync(full).isDirectory();
  });
  const nonPackageEntries = readdirSync(skillsRoot).filter((name) => !statSync(path.join(skillsRoot, name)).isDirectory());
  for (const entry of nonPackageEntries) {
    fail(`${entry}: apps/web/agent/skills/ contains a non-package entry; only <name>/SKILL.md directories are allowed`);
  }

  const toolNames = new Set(
    readdirSync(toolsRoot)
      .filter((name) => /\.ts$/.test(name))
      .map((name) => name.replace(/\.ts$/, "")),
  );
  const packageNameSet = new Set(packageNames);

  const descriptions = new Map<string, string[]>();
  for (const packageName of packageNames) {
    const description = checkPackage(packageName, toolNames, packageNameSet);
    if (description) {
      const existing = descriptions.get(description) ?? [];
      existing.push(packageName);
      descriptions.set(description, existing);
    }
  }
  for (const [description, owners] of descriptions) {
    if (owners.length > 1) {
      fail(`Duplicate description shared by ${owners.join(", ")}: "${description}"`);
    }
  }

  for (const item of BUILT_IN_SKILLS) {
    if (!packageNameSet.has(item.name)) {
      fail(`slash-menu entry "${item.name}" (apps/web/lib/slash-skills.ts) has no matching apps/web/agent/skills/${item.name}/ package`);
    } else {
      pass(`slash-menu entry "${item.name}" resolves to a discovered package`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} fleet-skill check(s) FAILED`);
    process.exit(1);
  }
  console.log(`\nAll fleet-skill checks passed (${packageNames.length} package(s)).`);
}

main();
