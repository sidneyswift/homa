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

import { recipeTableSlugs, unreachableSkillReferences } from "./skill-reference-graph.ts";

import { BUILT_IN_SKILLS } from "../apps/web/lib/slash-skills.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "apps/web/agent/skills");
const toolsRoot = path.join(repoRoot, "apps/web/agent/tools");

// File-count cap removed by founder ruling fleet-skill-file-cap-removed
// (2026-07-20); the byte caps below remain binding.
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
// #1167: package storage caps do not protect the always-advertised descriptions
// or the commonly loaded roots. Keep reviewed headroom after the workflow split.
const MAX_DESCRIPTION_BYTES = 640;
const ROOT_BUDGETS: Record<string, number> = {
  "materials-studio": 4_000,
  planner: 4_000,
  onboarding: 10_000,
};
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

/** A skill body that names a file the package does not ship fails only at
 * runtime, silently, as a degraded build with no error surfaced. These
 * four checks close that hole: concrete /workspace/skills/ paths must
 * resolve, every references/ file must be reachable from the root (no
 * orphan cycles), every "Recipe file" table in any file must name a shipped recipe,
 * and every anchorIds mention must resolve against the anchor registry
 * (the SKILL.md anchor table was deleted 2026-07-25; generate_image's
 * schema menu is the canonical list, and recipes keep per-recipe
 * anchorIds paragraphs that this check now guards). Placeholder paths
 * (containing < or >) match only up to their concrete prefix, which is
 * then checked as a directory. */
const WORKSPACE_PATH_MENTION = /\/workspace\/skills\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_\-./]*)/g;
const ANCHOR_IDS_MENTION = /anchorIds:\s*\[([^\]]*)\]/g;

/** Registry ids parsed from the anchors module source rather than
 * imported: anchors.ts pulls the multi-MB generated bytes module via an
 * extensionless import this strip-types runner cannot resolve. The id
 * lines are the registry's own literals, and an empty parse fails loud. */
function loadAnchorRegistryIds(): Set<string> {
  const source = readFileSync(
    path.join(repoRoot, "apps/web/lib/materials/anchors.ts"),
    "utf8",
  );
  const ids = new Set<string>();
  for (const match of source.matchAll(/^\s*id: "([a-z0-9-]+)",\s*$/gm)) {
    ids.add(match[1]);
  }
  if (ids.size === 0) {
    fail(
      "anchor registry parse found zero ids in apps/web/lib/materials/anchors.ts; the anchorIds check cannot run",
    );
  }
  return ids;
}

function checkReferenceIntegrity(
  packageName: string,
  files: FileEntry[],
  skillMdContent: string,
): void {
  const validAnchorIds = loadAnchorRegistryIds();
  for (const file of files) {
    if (!TEXT_FILE_EXTENSION.test(file.relativePath)) continue;
    const content = readFileSync(file.absolutePath, "utf8");
    for (const anchorMatch of content.matchAll(ANCHOR_IDS_MENTION)) {
      for (const idMatch of anchorMatch[1].matchAll(/"([^"]+)"/g)) {
        if (!validAnchorIds.has(idMatch[1])) {
          fail(
            `${packageName}/${file.relativePath}: anchorIds mention "${idMatch[1]}" does not resolve in the anchor registry (apps/web/lib/materials/anchors.ts)`,
          );
        }
      }
    }
    for (const match of content.matchAll(WORKSPACE_PATH_MENTION)) {
      const [, mentionedPackage, rawRelPath] = match;
      const relPath = rawRelPath.replace(/[.,;:]+$/, "");
      const target = path.join(skillsRoot, mentionedPackage, relPath);
      try {
        statSync(target);
      } catch {
        fail(
          `${packageName}/${file.relativePath}: mentions /workspace/skills/${mentionedPackage}/${relPath}, which does not ship`,
        );
      }
    }
  }

  const documents = new Map(files
    .filter((file) => TEXT_FILE_EXTENSION.test(file.relativePath))
    .map((file) => [file.relativePath, readFileSync(file.absolutePath, "utf8")]));
  documents.set("SKILL.md", skillMdContent);
  for (const orphan of unreachableSkillReferences(documents)) {
    fail(`${packageName}: ${orphan} is unreachable from SKILL.md (orphan reference)`);
  }
  for (const [source, content] of documents) {
    for (const slug of recipeTableSlugs(content)) {
      const recipePath = path.join(skillsRoot, packageName, "references/recipes", `${slug}.md`);
      try {
        if (!statSync(recipePath).isFile()) throw new Error("not a file");
      } catch {
        fail(`${packageName}: ${source} recipe-file table names "${slug}" but references/recipes/${slug}.md does not ship`);
      }
    }
  }
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

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > MAX_PACKAGE_BYTES) {
    fail(`${packageName}: ${totalBytes} bytes exceeds the ${MAX_PACKAGE_BYTES}-byte total package cap`);
  }

  const content = readFileSync(skillMdPath, "utf8");
  const rootBudget = ROOT_BUDGETS[packageName];
  if (rootBudget !== undefined && Buffer.byteLength(content) > rootBudget) {
    fail(`${packageName}: SKILL.md exceeds its ${rootBudget}-byte router budget; move workflow details into reachable references`);
  }
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    fail(`${packageName}: SKILL.md has no valid frontmatter block`);
    return null;
  }
  if (!frontmatter.description || frontmatter.description.length === 0) {
    fail(`${packageName}: frontmatter description is empty`);
    return null;
  }

  if (Buffer.byteLength(frontmatter.description) > MAX_DESCRIPTION_BYTES) {
    fail(`${packageName}: description exceeds ${MAX_DESCRIPTION_BYTES} bytes; keep the trigger and nearest routing boundary`);
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

  checkReferenceIntegrity(packageName, files, content);

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
