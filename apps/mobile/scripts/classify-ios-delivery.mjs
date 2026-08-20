#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const IOS_DELIVERY_CLASSIFIER_VERSION = "ios-delivery-classifier-v1";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(MOBILE_ROOT, "../..");
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const FINGERPRINT_PATTERN = /^[0-9a-f]{40}$/u;

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizedEnum(value) {
  return nonEmpty(value)?.toLowerCase().replaceAll("_", "-") ?? null;
}

function fingerprintHash(build) {
  const fingerprint = asRecord(build.fingerprint);
  return nonEmpty(fingerprint?.hash) ?? nonEmpty(build.fingerprintHash);
}

export function normalizeIosBuild(value) {
  const build = asRecord(value);
  if (!build) throw new Error("EAS returned a build that is not an object");
  const id = nonEmpty(build.id);
  const commit = nonEmpty(build.gitCommitHash)?.toLowerCase() ?? null;
  const createdAt = nonEmpty(build.createdAt) ?? nonEmpty(build.completedAt);
  const fingerprint = fingerprintHash(build);
  if (!id || !commit || !SHA_PATTERN.test(commit) || !createdAt || !fingerprint || !FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new Error(`EAS build ${id ?? "unknown"} is missing required release provenance`);
  }
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    throw new Error(`EAS build ${id} has an invalid creation timestamp`);
  }
  return {
    id,
    platform: normalizedEnum(build.platform),
    status: normalizedEnum(build.status),
    distribution: normalizedEnum(build.distribution),
    buildProfile: normalizedEnum(build.buildProfile),
    channel: normalizedEnum(build.channel),
    fingerprint,
    gitCommitHash: commit,
    createdAt: new Date(createdAtMs).toISOString(),
    appVersion: nonEmpty(build.appVersion),
    appBuildVersion: nonEmpty(build.appBuildVersion),
  };
}

export function classifyChangedPath(path) {
  const normalized = path.replaceAll("\\", "/");
  if (/^(?:pnpm-lock\.yaml|apps\/mobile\/package\.json)$/u.test(normalized)) return "dependency";
  if (/^apps\/mobile\/(?:app\.json|eas\.json|modules\/|ios\/|android\/)/u.test(normalized)
    || /\.(?:podspec|pbxproj|xcconfig|gradle|properties)$/u.test(normalized)) return "native-code-or-config";
  if (/(?:splash|asset-catalog|\.xcassets(?:\/|$))/iu.test(normalized)) return "splash-or-asset-catalog";
  if (/\.(?:ttf|otf|woff2?)$/iu.test(normalized) || /(?:^|\/)fonts?(?:\/|\.)/iu.test(normalized)) return "font";
  if (/\.(?:png|jpe?g|webp|svg)$/iu.test(normalized) || /(?:^|\/)(?:icons?|brand)(?:\/|\.)/iu.test(normalized)) return "icon-or-image";
  if (/^packages\/design\/(?:generated\/native\.json|src\/contract\/)/u.test(normalized)) return "design-token-or-native-projection";
  if (/\.(?:[cm]?[jt]sx?)$/iu.test(normalized)) return "javascript-or-typescript";
  return "other-governed-input";
}

export function classifyIosDelivery({ sourceSha, currentFingerprint, builds, changedPaths = [], isAncestor }) {
  if (!SHA_PATTERN.test(sourceSha)) throw new Error("sourceSha must be a full lowercase Git SHA");
  if (!FINGERPRINT_PATTERN.test(currentFingerprint)) {
    throw new Error("currentFingerprint must be a full lowercase Expo fingerprint");
  }
  if (!Array.isArray(builds)) throw new Error("EAS build response must be an array");
  if (!Array.isArray(changedPaths) || !changedPaths.every((path) => typeof path === "string")) {
    throw new Error("changedPaths must be an array of strings");
  }
  if (typeof isAncestor !== "function") throw new Error("isAncestor must be provided");

  const normalizedBuilds = builds.map(normalizeIosBuild);
  const evaluatedBuilds = normalizedBuilds.map((build) => {
    const rejectionReasons = [];
    if (build.platform !== "ios") rejectionReasons.push("not-ios");
    if (build.status !== "finished") rejectionReasons.push("not-finished");
    if (build.distribution !== "store") rejectionReasons.push("not-store-distributed");
    if (build.buildProfile !== "production") rejectionReasons.push("not-production-profile");
    if (build.channel !== "production") rejectionReasons.push("not-production-channel");
    if (build.fingerprint !== currentFingerprint) rejectionReasons.push("fingerprint-mismatch");
    if (!isAncestor(build.gitCommitHash, sourceSha)) rejectionReasons.push("commit-not-main-ancestor");
    return { build, rejectionReasons };
  });
  const eligible = evaluatedBuilds
    .filter((candidate) => candidate.rejectionReasons.length === 0)
    .map((candidate) => candidate.build)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  const normalizedPaths = [...new Set(changedPaths.map((path) => path.replaceAll("\\", "/")).filter(Boolean))].sort();
  const categories = [...new Set(normalizedPaths.map(classifyChangedPath))].sort();
  const fingerprintChanged = evaluatedBuilds.some(({ build, rejectionReasons }) => (
    rejectionReasons.length === 1
    && rejectionReasons[0] === "fingerprint-mismatch"
    && build.fingerprint !== currentFingerprint
  ));
  const compatibilityClass = eligible.length > 0
    ? "ota-safe"
    : fingerprintChanged
      ? "fingerprint-changing"
      : "store-binary-required";

  return {
    schemaVersion: 1,
    classifierVersion: IOS_DELIVERY_CLASSIFIER_VERSION,
    compatibilityClass,
    requiredRail: eligible.length > 0 ? "eas-update" : "store-binary-required",
    sourceSha,
    fingerprint: currentFingerprint,
    changedPaths: normalizedPaths,
    changeCategories: categories,
    matchingBuild: eligible[0] ?? null,
    evaluatedBuilds: evaluatedBuilds.map(({ build, rejectionReasons }) => ({
      id: build.id,
      gitCommitHash: build.gitCommitHash,
      fingerprint: build.fingerprint,
      rejectionReasons,
    })),
  };
}

function run(command, args, cwd = MOBILE_ROOT) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

/**
 * `git merge-base --is-ancestor` exits 0 (yes), 1 (no), or something else
 * (commonly 128, "fatal: Not a valid object name") when the build's commit
 * is not reachable from any ref this checkout fetched. That last case is
 * expected and recurring, not exceptional: squash-merging a PR rewrites
 * away the original commit, so the FIRST push after every squash merge
 * following a production store build finds that build's recorded commit
 * orphaned (issue #988). An unresolvable commit cannot be an ancestor of
 * anything, so classification treats it as a clean "no" (fail closed:
 * the build is excluded, never wrongly trusted) instead of crashing the
 * whole run. A spawn failure (git itself did not run) still throws, since
 * that is a real environment problem, not an expected history gap.
 */
export function gitIsAncestor(ancestor, sourceSha) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, sourceSha], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.error) {
    throw new Error(`git did not run to compare build commit ${ancestor} with ${sourceSha}: ${result.error.message}`);
  }
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  const stderr = result.stderr?.toString("utf8").trim();
  console.error(
    `iOS delivery classifier: build commit ${ancestor} is not in this checkout's history (commonly a squash merge orphaning the last production build's commit; see issue #988).${stderr ? ` git said: ${stderr}` : ""}`,
  );
  return false;
}

function changedPathsForCommit(sourceSha) {
  const parents = run("git", ["rev-list", "--parents", "-n", "1", sourceSha], REPO_ROOT).trim().split(/\s+/u).slice(1);
  if (parents.length === 0) return [];
  return run("git", ["diff", "--name-only", `${sourceSha}^1`, sourceSha], REPO_ROOT)
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean);
}

function assertExactCheckout(sourceSha) {
  const checkoutSha = run("git", ["rev-parse", "HEAD"], REPO_ROOT).trim().toLowerCase();
  if (checkoutSha !== sourceSha) {
    throw new Error(`Checkout ${checkoutSha || "unknown"} does not match requested source ${sourceSha}`);
  }
}

function appendGithubOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  writeFileSync(output, `${name}=${value}\n`, { flag: "a" });
}

export function runClassifierCli({ sourceSha, outputDir }) {
  if (!SHA_PATTERN.test(sourceSha)) throw new Error("GITHUB_SHA must be a full lowercase Git SHA");
  assertExactCheckout(sourceSha);
  if (existsSync(resolve(MOBILE_ROOT, "ios"))) {
    throw new Error("apps/mobile/ios exists; classify only from a clean managed-workflow checkout");
  }
  const rawFingerprint = run("npx", [
    "@expo/fingerprint",
    "fingerprint:generate",
    "--platform",
    "ios",
    ".",
  ]);
  const currentFingerprint = nonEmpty(JSON.parse(rawFingerprint).hash);
  if (!currentFingerprint || !FINGERPRINT_PATTERN.test(currentFingerprint)) {
    throw new Error("Expo fingerprint generation returned no valid lowercase hash");
  }

  const rawBuilds = run("npx", [
    "eas-cli@21.4.0",
    "build:list",
    "--platform",
    "ios",
    "--build-profile",
    "production",
    "--status",
    "finished",
    "--distribution",
    "store",
    "--channel",
    "production",
    "--limit",
    "50",
    "--json",
    "--non-interactive",
  ]);
  let builds;
  try {
    builds = JSON.parse(rawBuilds);
  } catch {
    throw new Error("EAS build query returned malformed JSON");
  }
  const classification = classifyIosDelivery({
    sourceSha,
    currentFingerprint,
    builds,
    changedPaths: changedPathsForCommit(sourceSha),
    isAncestor: gitIsAncestor,
  });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "eas-builds.raw.json"), rawBuilds);
  writeFileSync(resolve(outputDir, "classification.json"), `${JSON.stringify(classification, null, 2)}\n`);
  appendGithubOutput("compatibility_class", classification.compatibilityClass);
  appendGithubOutput("required_rail", classification.requiredRail);
  appendGithubOutput("fingerprint", classification.fingerprint);
  appendGithubOutput("matching_build_id", classification.matchingBuild?.id ?? "");
  return classification;
}

function main() {
  const sourceSha = process.env.GITHUB_SHA?.toLowerCase() ?? "";
  const outputDir = resolve(process.env.HOMA_MOBILE_RELEASE_DIR ?? resolve(REPO_ROOT, "artifacts/mobile-delivery"));
  const classification = runClassifierCli({ sourceSha, outputDir });
  console.log(`iOS delivery classification: ${classification.compatibilityClass}`);
  console.log(`Required rail: ${classification.requiredRail}`);
  console.log(`Fingerprint: ${classification.fingerprint}`);
  if (classification.matchingBuild) console.log(`Matching build: ${classification.matchingBuild.id}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`iOS delivery classifier: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
