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
  return files.map((file) => file.replace(/^\.\//, "")).filter(Boolean);
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
      "brand-checks": "success",
      "mobile-checks": "skipped",
      build: "success",
      checks: "success",
      "db-checks": "success",
      "e2e-checks": "success",
    },
    "mobile-only": {
      "classify-changes": "success",
      "light-checks": "success",
      "brand-checks": "success",
      "mobile-checks": "success",
      build: "skipped",
      checks: "skipped",
      "db-checks": "skipped",
      "e2e-checks": "skipped",
    },
    "docs-only": {
      "classify-changes": "success",
      "light-checks": "success",
      "brand-checks": "success",
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
    execFileSync("git", ["diff", "--name-only", "-z", "--no-renames", "--diff-filter=ACDMRT", base, head], {
      encoding: "utf8",
    }).split("\0"),
  );
}

function readChangedFilesOrBuild(base = "HEAD^", head = "HEAD") {
  try {
    return changedFiles(base, head);
  } catch (error) {
    console.error(
      `Could not inspect the Git diff, so the full build will run: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function isExactCommit(sha) {
  try {
    const resolved = execFileSync("git", ["rev-parse", "--verify", `${sha}^{commit}`], {
      encoding: "utf8",
    }).trim();
    return resolved.toLowerCase() === sha.toLowerCase();
  } catch {
    return false;
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

  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();
  if (!previousSha) {
    console.error("Vercel change scope: build, no prior successful branch deployment SHA");
    process.exitCode = 1;
    return;
  }
  if (!/^[0-9a-f]{40}$/iu.test(previousSha)) {
    console.error("Vercel change scope: build, previous deployment SHA is invalid");
    process.exitCode = 1;
    return;
  }
  if (!isExactCommit(previousSha)) {
    console.error("Vercel change scope: build, previous deployment commit is unavailable");
    process.exitCode = 1;
    return;
  }

  const providedCurrentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (providedCurrentSha && !/^[0-9a-f]{40}$/iu.test(providedCurrentSha)) {
    console.error("Vercel change scope: build, current deployment SHA is invalid");
    process.exitCode = 1;
    return;
  }
  if (providedCurrentSha && !isExactCommit(providedCurrentSha)) {
    console.error("Vercel change scope: build, current deployment commit is unavailable");
    process.exitCode = 1;
    return;
  }
  const checkedOutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (providedCurrentSha && checkedOutSha.toLowerCase() !== providedCurrentSha.toLowerCase()) {
    console.error("Vercel change scope: build, current deployment SHA does not match HEAD");
    process.exitCode = 1;
    return;
  }
  const currentSha = providedCurrentSha || "HEAD";
  const files = readChangedFilesOrBuild(previousSha, currentSha);
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
    "brand-checks": process.env.CI_BRAND,
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
