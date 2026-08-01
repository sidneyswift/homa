import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DOCUMENTATION_PREFIXES = [
  ".agents/",
  ".claude/",
  ".context/",
  "docs/",
];

const DOCUMENTATION_FILES = new Set([
  "AGENTS.md",
  "BUILD.md",
  "DESIGN.md",
  "LICENSE",
  "README.md",
  "apps/mobile/AGENTS.md",
  "apps/mobile/README.md",
  "apps/web/AGENTS.md",
  "apps/web/README.md",
]);

function normalizeFiles(files) {
  return files.map((file) => file.trim().replace(/^\.\//, "")).filter(Boolean);
}

function isDocumentationFile(file) {
  return (
    DOCUMENTATION_FILES.has(file) ||
    DOCUMENTATION_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

function isMobileFile(file) {
  return file.startsWith("apps/mobile/") && !isDocumentationFile(file);
}

function isVercelOnlySafeFile(file) {
  return file.startsWith(".github/");
}

export function classifyCiFiles(inputFiles) {
  const files = normalizeFiles(inputFiles);
  if (files.length === 0) return "full";
  if (files.every(isDocumentationFile)) return "docs-only";
  if (
    files.some(isMobileFile) &&
    files.every((file) => isDocumentationFile(file) || isMobileFile(file))
  ) {
    return "mobile-only";
  }
  return "full";
}

export function shouldSkipVercelPreview(inputFiles) {
  const files = normalizeFiles(inputFiles);
  return (
    files.length > 0 &&
    files.every(
      (file) =>
        isDocumentationFile(file) ||
        isMobileFile(file) ||
        isVercelOnlySafeFile(file),
    )
  );
}

export function validateCiResults(scope, results) {
  const expectedByScope = {
    full: {
      "classify-changes": "success",
      "light-checks": "success",
      "mobile-checks": "success",
      build: "success",
      checks: "success",
      "db-checks": "success",
      "e2e-checks": "success",
    },
    "mobile-only": {
      "classify-changes": "success",
      "light-checks": "success",
      "mobile-checks": "success",
      build: "skipped",
      checks: "skipped",
      "db-checks": "skipped",
      "e2e-checks": "skipped",
    },
    "docs-only": {
      "classify-changes": "success",
      "light-checks": "success",
      "mobile-checks": "skipped",
      build: "skipped",
      checks: "skipped",
      "db-checks": "skipped",
      "e2e-checks": "skipped",
    },
  };

  const expected = expectedByScope[scope];
  if (!expected) throw new Error(`Unknown CI change scope: ${scope}`);
  for (const [job, expectedResult] of Object.entries(expected)) {
    const actualResult = results[job];
    if (actualResult !== expectedResult) {
      throw new Error(
        `${job} finished with ${actualResult ?? "no result"}, expected ${expectedResult} for ${scope}`,
      );
    }
  }
}

export function changedFiles(base = "HEAD^", head = "HEAD") {
  return normalizeFiles(
    execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRT", base, head], {
      encoding: "utf8",
    }).split("\n"),
  );
}

function readChangedFilesOrBuild() {
  try {
    return changedFiles();
  } catch (error) {
    console.error(
      `Could not inspect the Git diff, so the full build will run: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function runGithubMode() {
  const files = readChangedFilesOrBuild();
  const scope = files === null ? "full" : classifyCiFiles(files);
  console.log(`scope=${scope}`);
  console.error(`CI change scope: ${scope}`);
}

function runVercelMode() {
  if (process.env.VERCEL_ENV !== "preview") {
    console.error("Vercel change scope: build, non-preview deployments always build");
    process.exitCode = 1;
    return;
  }

  const files = readChangedFilesOrBuild();
  if (files === null || !shouldSkipVercelPreview(files)) {
    console.error("Vercel change scope: build");
    process.exitCode = 1;
    return;
  }

  console.error(`Vercel change scope: skip preview build (${files.join(", ")})`);
  process.exitCode = 0;
}

function runGateMode() {
  const scope = process.env.CI_SCOPE ?? "";
  const results = {
    "classify-changes": process.env.CI_CLASSIFY,
    "light-checks": process.env.CI_LIGHT,
    "mobile-checks": process.env.CI_MOBILE,
    build: process.env.CI_BUILD,
    checks: process.env.CI_CHECKS,
    "db-checks": process.env.CI_DB,
    "e2e-checks": process.env.CI_E2E,
  };
  try {
    validateCiResults(scope, results);
    console.log(`All jobs required by the ${scope} scope are green.`);
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const mode = process.argv[2];
  if (mode === "github") runGithubMode();
  else if (mode === "vercel") runVercelMode();
  else if (mode === "gate") runGateMode();
  else {
    console.error("usage: node scripts/ci-change-scope.mjs <github|vercel|gate>");
    process.exitCode = 2;
  }
}
