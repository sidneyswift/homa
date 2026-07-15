#!/usr/bin/env node --experimental-strip-types
/**
 * Phase C dormant-window guard
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md §6
 * Phase C, bullet 1: "a source/build guard proves no product runtime
 * module imports either skill store or queries either table").
 *
 * Two checks, both deterministic, no network:
 * 1. The retired files never come back under their old names.
 * 2. No product runtime file outside the explicit allowlist queries
 *    public.family_skills or public.skill_bank (Supabase `.from(...)` calls
 *    or raw SQL `from public.<table>`). Prose mentions in comments,
 *    historical UI copy, and the archive/admin tooling below are expected
 *    and intentionally excluded, not silently ignored: this file is the
 *    place that says why.
 *
 * Usage: node --experimental-strip-types scripts/fleet-skills-dormant-guard.mts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXTENSION = /\.(ts|tsx|mts)$/;

/** Manual recursive walk: this script has no dependencies of its own on
 * purpose, so it never needs a fresh `pnpm install` to run as a guard. */
function listSourceFiles(rootRelativeDir: string): string[] {
  const results: string[] = [];
  const stack = [rootRelativeDir];
  while (stack.length > 0) {
    const relativeDir = stack.pop() as string;
    const absoluteDir = path.join(repoRoot, relativeDir);
    for (const name of readdirSync(absoluteDir)) {
      if (name === "node_modules" || name === ".next" || name === ".output" || name === ".eve") continue;
      const relativePath = path.join(relativeDir, name);
      const absolutePath = path.join(repoRoot, relativePath);
      if (statSync(absolutePath).isDirectory()) {
        stack.push(relativePath);
        continue;
      }
      if (SOURCE_EXTENSION.test(name)) results.push(relativePath);
    }
  }
  return results;
}

/** Deleted 2026-07-15 (build-log.md "Fleet skills move to the filesystem").
 * Their reappearance under these exact paths means the dynamic system was
 * reintroduced without a new founder ruling. */
const RETIRED_FILES = [
  "apps/web/agent/skills/skill-library.ts",
  "apps/web/agent/tools/save_skill.ts",
  "apps/web/agent/tools/forget_skill.ts",
  "apps/web/lib/agent-skills-store.ts",
];

/**
 * Files allowed to reference public.family_skills / public.skill_bank as a
 * live query target, and why each one is legitimate dormant-era code, not a
 * regression:
 * - family-fold.ts: service-role account-merge remap (data hygiene on
 *   dormant rows during a family merge, not a skill-delivery read path).
 * - the skill-archive-* scripts: the rollback archive and its restore
 *   verification, whose entire job is to read these two tables.
 */
const ALLOWED_QUERY_FILES = new Set([
  "apps/web/lib/family-fold.ts",
  "apps/web/scripts/skill-archive-export.mts",
  "apps/web/scripts/skill-archive-restore-verify.mts",
  "apps/web/scripts/skill-archive-format.mts",
  "scripts/fleet-skills-check.mts",
  "scripts/fleet-skills-dormant-guard.mts",
]);

const QUERY_PATTERNS = [
  /\.from\(\s*["'`]family_skills["'`]\s*\)/,
  /\.from\(\s*["'`]skill_bank["'`]\s*\)/,
  /from\s+public\.family_skills\b/i,
  /from\s+public\.skill_bank\b/i,
  /(?:update|insert\s+into|delete\s+from)\s+public\.family_skills\b/i,
  /(?:update|insert\s+into|delete\s+from)\s+public\.skill_bank\b/i,
];

const failures: string[] = [];
function fail(message: string): void {
  failures.push(message);
  console.log(`FAIL  ${message}`);
}
function pass(message: string): void {
  console.log(`PASS  ${message}`);
}

function checkRetiredFilesAbsent(): void {
  for (const relativePath of RETIRED_FILES) {
    try {
      statSync(path.join(repoRoot, relativePath));
      fail(`${relativePath} exists again; the dynamic skill system was retired 2026-07-15`);
    } catch {
      pass(`${relativePath} stays deleted`);
    }
  }
}

function checkNoUnexpectedQueries(): void {
  const candidateFiles = listSourceFiles("apps/web");
  let scanned = 0;
  for (const relativePath of candidateFiles) {
    if (ALLOWED_QUERY_FILES.has(relativePath)) continue;
    const content = readFileSync(path.join(repoRoot, relativePath), "utf8");
    for (const pattern of QUERY_PATTERNS) {
      if (pattern.test(content)) {
        fail(`${relativePath}: matches ${pattern} outside the allowlist`);
      }
    }
    scanned += 1;
  }
  pass(`scanned ${scanned} apps/web source file(s) outside the allowlist for live queries`);
}

function main(): void {
  checkRetiredFilesAbsent();
  checkNoUnexpectedQueries();

  if (failures.length > 0) {
    console.error(`\n${failures.length} dormant-window guard check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll dormant-window guard checks passed.");
}

main();
