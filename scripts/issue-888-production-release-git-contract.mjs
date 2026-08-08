#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ISSUE_888_RELEASE_SENSITIVE_PATHS = Object.freeze([
  ".github/workflows/issue-888-production-repair.yml",
  "scripts/issue-888-production-release-git-contract.mjs",
  "scripts/issue-888-production-repair.sql",
  "scripts/migration-version-check.mjs",
  "supabase/migrations/20260801201500_month_plan_approvals.sql",
  "supabase/migrations/20260806040000_month_plan_approvals_write_boundary.sql",
]);

function assertGitSha(value, label) {
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error(`${label} must be an exact lowercase Git SHA.`);
  }
}

function git(repositoryRoot, args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  }).trim();
}

function commitExists(repositoryRoot, sha, label) {
  try {
    git(repositoryRoot, ["cat-file", "-e", `${sha}^{commit}`]);
  } catch {
    throw new Error(`${label} is not a commit in this checkout.`);
  }
}

function isAncestor(repositoryRoot, ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function blobSha(repositoryRoot, commitSha, path) {
  try {
    return git(repositoryRoot, ["rev-parse", `${commitSha}:${path}`]);
  } catch {
    throw new Error(`${path} is absent from commit ${commitSha}.`);
  }
}

export function validateIssue888ReleaseGitContract({
  repositoryRoot,
  finalSha,
  reviewedSha,
}) {
  assertGitSha(finalSha, "Final main SHA");
  assertGitSha(reviewedSha, "Reviewed repair SHA");
  commitExists(repositoryRoot, finalSha, "Final main SHA");
  commitExists(repositoryRoot, reviewedSha, "Reviewed repair SHA");

  const parents = git(repositoryRoot, ["show", "-s", "--format=%P", finalSha])
    .split(/\s+/u)
    .filter(Boolean);
  if (parents.length !== 2 || parents[1] !== reviewedSha) {
    throw new Error(
      "The production commit is not the reviewed issue #888 merge commit."
    );
  }
  if (!isAncestor(repositoryRoot, reviewedSha, finalSha)) {
    throw new Error(
      "The reviewed issue #888 head is not an ancestor of the production commit."
    );
  }

  const sensitiveBlobs = {};
  for (const path of ISSUE_888_RELEASE_SENSITIVE_PATHS) {
    const finalBlob = blobSha(repositoryRoot, finalSha, path);
    const reviewedBlob = blobSha(repositoryRoot, reviewedSha, path);
    if (finalBlob !== reviewedBlob) {
      throw new Error(
        `${path} differs between the reviewed head and production merge.`
      );
    }
    sensitiveBlobs[path] = finalBlob;
  }

  const sensitiveManifest = ISSUE_888_RELEASE_SENSITIVE_PATHS.map(
    (path) => `${path}=${sensitiveBlobs[path]}\n`
  ).join("");

  return {
    finalTreeSha: git(repositoryRoot, ["show", "-s", "--format=%T", finalSha]),
    reviewedTreeSha: git(repositoryRoot, [
      "show",
      "-s",
      "--format=%T",
      reviewedSha,
    ]),
    sensitiveBlobs,
    sensitiveManifestSha256: createHash("sha256")
      .update(sensitiveManifest)
      .digest("hex"),
  };
}

function argumentsByName(values) {
  const allowed = new Set(["final-sha", "reviewed-sha"]);
  const result = new Map();
  for (const value of values) {
    const match = /^--([a-z-]+)=(.*)$/u.exec(value);
    if (!match?.[1] || !allowed.has(match[1]) || result.has(match[1])) {
      throw new Error(`Unknown, duplicate, or malformed argument: ${value}`);
    }
    result.set(match[1], match[2] ?? "");
  }
  return result;
}

function requiredArgument(values, name) {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`Pass --${name}=<value>.`);
  return value;
}

function main() {
  const args = argumentsByName(process.argv.slice(2));
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = validateIssue888ReleaseGitContract({
    repositoryRoot,
    finalSha: requiredArgument(args, "final-sha"),
    reviewedSha: requiredArgument(args, "reviewed-sha"),
  });
  console.log(`ISSUE_888_FINAL_TREE_SHA=${result.finalTreeSha}`);
  console.log(`ISSUE_888_REVIEWED_TREE_SHA=${result.reviewedTreeSha}`);
  console.log(
    `ISSUE_888_SENSITIVE_MANIFEST_SHA256=${result.sensitiveManifestSha256}`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
