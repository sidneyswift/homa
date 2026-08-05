import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectLegacySignatureMatches,
  isLegacyFontPath,
  isLegacyResidueExcludedPath,
  isLegacyTextPath,
} from "../packages/design/src/legacy-signatures.ts";
import { BRAND_MANIFEST_SCHEMA_VERSION } from "../packages/design/src/surfaces.ts";

type LegacyBaselineRecord = {
  path: string;
  sourceHash: string;
  legacySignatures: string[];
};

type LegacyBaseline = {
  schemaVersion: number;
  sourceCommit: string;
  records: LegacyBaselineRecord[];
};

type GitHubEventPayload = {
  before?: unknown;
  after?: unknown;
  pull_request?: {
    base?: { sha?: unknown };
    head?: { sha?: unknown };
  };
};

export type BrandResidueFinding = {
  path: string;
  signature: string;
  line: number;
  excerpt: string;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = resolve(ROOT, "docs/homa-design/evidence/legacy-baseline.json");

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

function gitTrackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: ROOT })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

function gitUntrackedFiles(): Set<string> {
  return new Set(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: ROOT })
    .toString("utf8")
    .split("\0")
    .filter(Boolean));
}

function withWorkingTree(paths: Set<string>): Set<string> {
  const changedTracked = gitDiffPaths(["HEAD"]) ?? new Set<string>();
  return new Set([...paths, ...changedTracked, ...gitUntrackedFiles()]);
}

function availableBaselineCommit(sourceCommit: string): string | null {
  for (const base of [sourceCommit, "HEAD^"]) {
    try {
      execFileSync("git", ["cat-file", "-e", `${base}^{commit}`], { cwd: ROOT, stdio: "ignore" });
      return base;
    } catch {
      // A shallow checkout may not contain the immutable baseline commit.
    }
  }
  return null;
}

function gitDiffPaths(range: readonly string[]): Set<string> | null {
  try {
    return new Set(
      execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", ...range, "--"], { cwd: ROOT })
        .toString("utf8")
        .split("\n")
        .filter(Boolean),
    );
  } catch {
    return null;
  }
}

function eventPayload(): GitHubEventPayload | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;
  try {
    return JSON.parse(readFileSync(eventPath, "utf8")) as GitHubEventPayload;
  } catch {
    return null;
  }
}

function changedPathsForRun(sourceCommit: string): Set<string> | null {
  // The guard is a migration ratchet, but its scope must be the delivery
  // delta. A pull_request checkout is a synthetic merge commit, so diff its
  // first parent (the base branch) to the merge tree. A push event supplies
  // the exact before/after range. This prevents unrelated historical files
  // from main from being treated as part of a brand change.
  const event = eventPayload();
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    const parents = execFileSync("git", ["rev-list", "--parents", "-n", "1", "HEAD"], { cwd: ROOT })
      .toString("utf8")
      .trim()
      .split(/\s+/);
    if (parents.length >= 3) {
      const mergeDelta = gitDiffPaths(["HEAD^1", "HEAD"]);
      if (mergeDelta) return withWorkingTree(mergeDelta);
    }
    const baseSha = event?.pull_request?.base?.sha;
    const headSha = event?.pull_request?.head?.sha;
    if (typeof baseSha === "string" && typeof headSha === "string") {
      const pullRequestDelta = gitDiffPaths([`${baseSha}...${headSha}`]);
      if (pullRequestDelta) return withWorkingTree(pullRequestDelta);
    }
  }
  if (process.env.GITHUB_EVENT_NAME === "push") {
    const before = event?.before;
    const after = event?.after ?? "HEAD";
    if (typeof before === "string" && before !== "0".repeat(40) && typeof after === "string") {
      const pushDelta = gitDiffPaths([before, after]);
      if (pushDelta) return withWorkingTree(pushDelta);
    }
  }

  // Local runs usually have origin/main available. This keeps a worktree
  // that contains a merge commit aligned with the PR's intended delta.
  const localDelta = gitDiffPaths(["origin/main...HEAD"]);
  if (localDelta) return withWorkingTree(localDelta);

  // Shallow or detached environments may not have the remote ref. Retain a
  // conservative baseline fallback rather than silently scanning everything.
  const baselineCommit = availableBaselineCommit(sourceCommit);
  const baselineDelta = baselineCommit ? gitDiffPaths([baselineCommit, "HEAD"]) : null;
  return baselineDelta ? withWorkingTree(baselineDelta) : null;
}

function baselineHashes(baseline: LegacyBaseline): Map<string, Set<string>> {
  const hashes = new Map<string, Set<string>>();
  for (const record of baseline.records) {
    if (record.legacySignatures.length === 0) continue;
    const existing = hashes.get(record.path) ?? new Set<string>();
    existing.add(record.sourceHash);
    hashes.set(record.path, existing);
  }
  return hashes;
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let cursor = 0; cursor < offset; cursor += 1) {
    if (text[cursor] === "\n") line += 1;
  }
  return line;
}

function excerptAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = text.indexOf("\n", offset);
  return text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim().slice(0, 180);
}

function findResidue(path: string, text: string, hash: string, allowedHashes: Map<string, Set<string>>): BrandResidueFinding[] {
  const isUnchangedBaseline = allowedHashes.get(path)?.has(hash) ?? false;
  if (isUnchangedBaseline) return [];
  return collectLegacySignatureMatches(path, text).map((match) => ({
    path,
    signature: match.signature,
    line: lineAt(text, match.index),
    excerpt: excerptAt(text, match.index),
  }));
}

export type BrandResidueScope = "delta" | "full";

export function collectBrandResidueFindings(scope: BrandResidueScope = "delta"): BrandResidueFinding[] {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as LegacyBaseline;
  if (baseline.schemaVersion !== BRAND_MANIFEST_SCHEMA_VERSION || !baseline.sourceCommit || !Array.isArray(baseline.records)) {
    throw new Error(`Unsupported legacy baseline schema in ${relative(ROOT, BASELINE_PATH)}`);
  }
  // The delivery-delta guard may use the frozen hashes to distinguish newly
  // introduced residue from untouched migration work. The final full-tree
  // audit may not: an unchanged legacy file is still active legacy identity,
  // not an exemption earned by age.
  const allowedHashes = scope === "delta" ? baselineHashes(baseline) : new Map<string, Set<string>>();
  const changedPaths = scope === "full" ? null : changedPathsForRun(baseline.sourceCommit);
  const findings: BrandResidueFinding[] = [];
  for (const path of gitTrackedFiles()) {
    if (isLegacyResidueExcludedPath(path) || !isLegacyTextPath(path)) continue;
    const bytes = readFileSync(resolve(ROOT, path));
    const hash = sha256(bytes);
    if (changedPaths && !changedPaths.has(path)) continue;
    // With a reachable baseline commit, the exact diff is the authoritative
    // hash comparison. The map is only needed when a shallow checkout cannot
    // provide that diff.
    findings.push(...findResidue(path, bytes.toString("utf8"), hash, changedPaths ? new Map() : allowedHashes));
  }
  return findings;
}

export function collectLegacyFontPathResidue(scope: BrandResidueScope = "delta"): string[] {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as LegacyBaseline;
  const changedPaths = scope === "full" ? null : changedPathsForRun(baseline.sourceCommit);
  return gitTrackedFiles().filter((path) => isLegacyFontPath(path) && (!changedPaths || changedPaths.has(path)));
}

export function assertNoBrandResidue(): void {
  const fullTree = process.argv.includes("--full");
  const reportOnly = process.argv.includes("--report");
  const scope: BrandResidueScope = fullTree ? "full" : "delta";
  const pathResidue = collectLegacyFontPathResidue(scope);
  const findings = collectBrandResidueFindings(scope);
  if (pathResidue.length === 0 && findings.length === 0) {
    console.log(
      fullTree
        ? "Full-tree brand residue guard passed: no active legacy font paths or unquarantined signatures found."
        : "Brand residue guard passed: no active legacy font paths or changed-file signatures found.",
    );
    return;
  }

  const lines = ["Active brand residue detected:"];
  for (const path of pathResidue) lines.push(`- ${path}: legacy-font-path`);
  for (const finding of findings) lines.push(`- ${finding.path}:${finding.line}: ${finding.signature}: ${finding.excerpt}`);
  if (reportOnly) {
    console.log(`${lines.join("\n")}\nBrand eradication queue: ${pathResidue.length + findings.length} active finding(s).`);
    return;
  }
  throw new Error(lines.join("\n"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertNoBrandResidue();
}
