#!/usr/bin/env node
/**
 * Enforces AGENTS.md's hard style law ("No em dash, ever, anywhere: code
 * comments, UI copy, docs, commit messages") across every git-tracked file.
 *
 * CR-51 (issue #207) found ~1,150 literal em dashes (U+2014) left over in
 * tracked historical docs and local skill reference files after an earlier
 * pass cleaned apps/ and packages/. This script closes the gap: it scans the
 * whole repo so a new violation anywhere fails CI, not just in the
 * directories that were dirty at audit time.
 *
 * A small, explicit set of paths are allowed to contain the character
 * because they are not Homa's own authored prose:
 *   - Vendored / ingested third-party or reference data (taxonomy exports,
 *     state-requirement snapshots, the marble benchmark dataset, Slack
 *     curriculum-ingestion drops under .cosmo/).
 *   - Generated files AGENTS.md already says never to hand-edit.
 *   - Frozen historical record (docs/homa-planning/history/, and the one
 *     dated simulation transcript that is a verbatim capture, not guidance).
 *   - Code/tests that implement or exercise the em-dash-stripping law itself
 *     (apps/web/lib/copy-laws-runtime.ts and *.test.ts(x)/*.spec.ts(x)
 *     fixtures that assert the character is absent or rejected).
 *   - One doc line that demonstrates the exact `rg` command used to check
 *     for the character, quoting it as a literal.
 *
 * Usage: node scripts/em-dash-check.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EM_DASH = "—";

const EXCLUDED_DIR_PREFIXES = [
  // Slack curriculum/reference ingestion drops: raw third-party material,
  // not Homa's authored prose (see AGENTS.md "Co-founder Slack" section).
  ".cosmo/",
  // Vendored state-requirement snapshots (CR-52 sanitizes these at the read
  // boundary; the tracked snapshots themselves stay byte-for-byte as pulled).
  "data/state-requirements/",
  // Frozen historical record, never live guidance.
  "docs/homa-planning/history/",
  // Marble's own authored README/CHANGELOG/PROVENANCE for the vendored
  // taxonomy dataset, not text Homa wrote.
  "docs/homa-benchmarks/marble/",
  // Vendored taxonomy export (CR-52 sanitizes assembled taxonomy text at the
  // read boundary; the tracked snapshot stays unchanged).
  "packages/taxonomy/data/",
  // Historical warm-playful design evidence quarantined during the Quiet
  // authority cutover. These generated/reference artifacts are retained for
  // provenance only and never load into product context or authored guidance.
  "docs/homa-design/evidence/legacy/warm-playful/",
  // Verbatim copy decks transcribed from 50 third-party apps' onboarding
  // and paywall screens (Mobbin/Appllama captures, 2026-08-31) for the
  // mobile onboarding + paywall v2 plan. Third-party UI punctuation is
  // preserved exactly; not Homa's authored prose.
  "work/onboardingandpaywall8-30/research/copy-decks/",
  // GitHub-sourced skills vendored verbatim (source/skillPath recorded in
  // skills-lock.json), not Homa's authored prose. homa-screen-gauntlet,
  // the sibling Homa-authored skill in the same .agents/skills/ directory,
  // is intentionally NOT on this list: it must stay held to the law.
  ".agents/skills/appllama-app-design-skill/",
  ".agents/skills/appllama-usage/",
  ".agents/skills/expo-animation/",
  ".agents/skills/find-animation-opportunities/",
  ".agents/skills/gauntlet-loop/",
  ".agents/skills/improve-animations/",
  ".agents/skills/mobile-touch/",
];

const EXCLUDED_FILES = new Set([
  // AGENTS.md: "Never hand-edit generated files."
  "docs/homa-design/_adherence.oxlintrc.json",
  "docs/homa-design/_ds_bundle.js",
  // A verbatim, dated simulation transcript: frozen record, not guidance.
  "docs/homa-planning/plans/2026-07-25-overnight-icp-paywall-simulation-transcript.md",
  // Two third-party articles pasted verbatim as onboarding/paywall research
  // references (2026-08-30): captured source material, not Homa's prose.
  "work/onboardingandpaywall8-30/article-2-onboarding-10x-better.md",
  "work/onboardingandpaywall8-30/article-94-percent-paywall-view-rate.md",
  // Deliberately bad fixture content the copy scorer's tests assert against.
  "marketing/evals/fixtures/failing-bundle/article.mdx",
  // Defines and strips the EM_DASH constant: this file IS the runtime
  // enforcement mechanism for the no-em-dash law, not a violation of it.
  "apps/web/lib/copy-laws-runtime.ts",
  // This checker necessarily names, defines, and quotes the character it
  // detects (the EM_DASH constant, this comment block, the line allowlist
  // below): self-exempt for the same reason copy-laws-runtime.ts is.
  "scripts/em-dash-check.mjs",
]);

// Test/spec files legitimately embed the character as fixture data while
// testing that copy-laws-runtime (or a component/route) rejects or strips it.
const TEST_FILE_PATTERN = /\.(test|spec)\.tsx?$/;

// One doc line that demonstrates, as a literal, the exact verification
// command used to check generated marketing copy for the character.
const LINE_ALLOWLIST = new Map([
  ["docs/superpowers/plans/2026-07-12-socials-starter-pack.md", ['rg "—|HOMA"']],
  // pnpm's patch must quote Eve's full one-line minified harness on both diff
  // sides. This phrase is upstream log punctuation, not Homa-authored prose.
  ["patches/eve@0.19.0.patch", [
    "model call failed — parking session",
    // The inline-step patch also quotes this unchanged upstream failure log.
    "workflow loop threw \u2014 emitting terminal session.failed",
  ]],
  // The retained 0.54.3 upgrade probe likewise needs byte-exact upstream
  // minified context on both patch sides. This is not Homa-authored copy.
  ["patches/eve@0.54.3.patch", [
    "turn boundary handler failed \u2014 parking session",
  ]],
]);

function isExcludedPath(relPath) {
  if (EXCLUDED_FILES.has(relPath)) return true;
  if (TEST_FILE_PATTERN.test(relPath)) return true;
  return EXCLUDED_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  return output.split("\0").filter(Boolean);
}

const violations = [];
let scanned = 0;
let skippedBinary = 0;

for (const relPath of listTrackedFiles()) {
  if (isExcludedPath(relPath)) continue;

  const absPath = path.join(repoRoot, relPath);
  let buffer;
  try {
    buffer = readFileSync(absPath);
  } catch {
    // Deleted-but-tracked race or a symlink git can't resolve; skip.
    continue;
  }
  // Cheap binary sniff: a NUL byte in the first 8KB means this isn't text
  // (images, video, compiled bundles). Avoids false "violations" from bytes
  // that happen to decode into something containing the em-dash codepoint.
  if (buffer.subarray(0, 8192).includes(0)) {
    skippedBinary += 1;
    continue;
  }
  const content = buffer.toString("utf8");
  scanned += 1;
  if (!content.includes(EM_DASH)) continue;

  const allowedLines = LINE_ALLOWLIST.get(relPath) ?? [];
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (!line.includes(EM_DASH)) return;
    if (allowedLines.some((needle) => line.includes(needle))) return;
    violations.push({ file: relPath, line: index + 1, text: line.trim() });
  });
}

if (violations.length > 0) {
  console.error(
    `em-dash-check: found ${violations.length} literal em dash(es) (AGENTS.md: ` +
      '"No em dash, ever, anywhere"). Use a comma, period, colon, or mid-dot instead.\n',
  );
  for (const { file, line, text } of violations) {
    console.error(`  ${file}:${line}: ${text.slice(0, 160)}`);
  }
  console.error(
    "\nIf this file is genuinely vendored/third-party/generated/frozen-history, " +
      "or the character is intentional test/enforcement fixture data, add it to " +
      "the allowlist in scripts/em-dash-check.mjs with a comment explaining why.",
  );
  process.exit(1);
}

console.log(
  `em-dash-check: ${scanned} tracked text files scanned (${skippedBinary} binary/unreadable skipped), 0 violations`,
);
