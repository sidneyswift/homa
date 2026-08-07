#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ISSUE_606_RELEASE_SENSITIVE_PATHS = Object.freeze([
  ".github/workflows/issue-606-production-repair.yml",
  ".github/workflows/ci.yml",
  "apps/web/agent/channels/dispatch.ts",
  "apps/web/agent/channels/email.ts",
  "apps/web/agent/channels/eve.ts",
  "apps/web/agent/channels/telnyx.ts",
  "apps/web/agent/instructions/family-context.ts",
  "apps/web/agent/schedules/dispatch.ts",
  "apps/web/agent/tools/create_printable.ts",
  "apps/web/agent/tools/create_task.ts",
  "apps/web/agent/tools/recall.ts",
  "apps/web/app/api/account-deletion/export/route.ts",
  "apps/web/app/api/learning/review/route.ts",
  "apps/web/lib/agent-pinned.ts",
  "apps/web/lib/chat-history-route.test.ts",
  "apps/web/lib/chat-history.ts",
  "apps/web/lib/conversation-continuity/continuity-service.test.ts",
  "apps/web/lib/conversation-continuity/continuity-service.ts",
  "apps/web/lib/conversation-continuity/eve-session-channel.test.ts",
  "apps/web/lib/conversation-continuity/eve-session-channel.ts",
  "apps/web/lib/conversation-continuity/eve-session-owners.ts",
  "apps/web/lib/conversation-continuity/ledger.test.ts",
  "apps/web/lib/conversation-continuity/ledger.ts",
  "apps/web/lib/conversation-continuity/offer-fulfillment.ts",
  "apps/web/lib/conversation-continuity/offer-recovery-tool-contract.test.ts",
  "apps/web/lib/conversation-continuity/offer-recovery.test.ts",
  "apps/web/lib/conversation-continuity/offer-recovery.ts",
  "apps/web/lib/conversation-continuity/postgres-repository.ts",
  "apps/web/lib/conversation-continuity/reply-policy.test.ts",
  "apps/web/lib/conversation-continuity/reply-policy.ts",
  "apps/web/lib/conversation-continuity/service-privacy-boundary.test.ts",
  "apps/web/lib/conversation-continuity/task-recipients.test.ts",
  "apps/web/lib/conversation-continuity/task-recipients.ts",
  "apps/web/lib/conversation-continuity/web-session-binding.test.ts",
  "apps/web/lib/conversation-continuity/web-session-binding.ts",
  "apps/web/lib/conversation-visibility.ts",
  "apps/web/lib/learning/call-memory.ts",
  "apps/web/lib/learning/session-review.ts",
  "apps/web/lib/materials/artifact-store.ts",
  "apps/web/lib/tasks/custom.ts",
  "apps/web/lib/tasks/dispatch-input.test.ts",
  "apps/web/lib/tasks/dispatch-input.ts",
  "apps/web/lib/tasks/dispatch-transport.test.ts",
  "apps/web/lib/tasks/dispatch-transport.ts",
  "apps/web/lib/tasks/manual-dispatch.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-fulfillment.test.ts",
  "apps/web/lib/tasks/research-brief-postgres-harness.ts",
  "apps/web/lib/tasks/research-brief-postgres-schema.test.ts",
  "apps/web/lib/tasks/scheduled-dispatch.test.ts",
  "apps/web/lib/tasks/scheduled-skip-postgres.test.ts",
  "apps/web/lib/tasks/source-offer-dispatch-contract.test.ts",
  "apps/web/lib/tasks/store.ts",
  "apps/web/lib/voice/recent-calls.ts",
  "apps/web/lib/voice/transcript-sync.ts",
  "package.json",
  "patches/eve@0.19.0.patch",
  "pnpm-lock.yaml",
  "scripts/conversation-privacy-e2e.mts",
  "scripts/eval-sandbox.mts",
  "scripts/eve-stream-max-duration-check.mjs",
  "scripts/isolation-check.mjs",
  "scripts/issue-606-privacy-containment-postgres.mts",
  "scripts/issue-606-production-release-git-contract.mjs",
  "scripts/issue-606-production-repair-postgres.mjs",
  "scripts/issue-606-production-repair.test.mjs",
  "scripts/issue-606-production-repair.sql",
  "scripts/issue-606-production-run-contract.mjs",
  "scripts/issue-606-runtime-containment.test.mjs",
  "scripts/issue-606-runtime-drain-contract.mjs",
  "scripts/issue-606-vercel-deployment-contract.mjs",
  "scripts/issue-606-vercel-project-protection-contract.mjs",
  "scripts/migration-version-check.mjs",
  "scripts/telnyx-transcripts-sync.mts",
  "supabase/migrations/20260802033000_conversation_privacy_per_adult.sql",
  "supabase/migrations/20260805110000_eve_web_session_owners.sql",
  "supabase/migrations/20260807040000_conversation_privacy_attribution_containment.sql",
  "supabase/migrations/20260807050000_conversation_privacy_attribution_write_guards.sql",
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

export function validateIssue606ReleaseGitContract({
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
      "The production commit is not the reviewed issue #606 merge commit."
    );
  }
  if (!isAncestor(repositoryRoot, reviewedSha, finalSha)) {
    throw new Error(
      "The reviewed issue #606 head is not an ancestor of the production commit."
    );
  }

  const sensitiveBlobs = {};
  for (const path of ISSUE_606_RELEASE_SENSITIVE_PATHS) {
    const finalBlob = blobSha(repositoryRoot, finalSha, path);
    const reviewedBlob = blobSha(repositoryRoot, reviewedSha, path);
    if (finalBlob !== reviewedBlob) {
      throw new Error(
        `${path} differs between the reviewed head and production merge.`
      );
    }
    sensitiveBlobs[path] = finalBlob;
  }

  const sensitiveManifest = ISSUE_606_RELEASE_SENSITIVE_PATHS.map(
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
  const result = validateIssue606ReleaseGitContract({
    repositoryRoot,
    finalSha: requiredArgument(args, "final-sha"),
    reviewedSha: requiredArgument(args, "reviewed-sha"),
  });
  console.log(`ISSUE_606_FINAL_TREE_SHA=${result.finalTreeSha}`);
  console.log(`ISSUE_606_REVIEWED_TREE_SHA=${result.reviewedTreeSha}`);
  console.log(
    `ISSUE_606_SENSITIVE_MANIFEST_SHA256=${result.sensitiveManifestSha256}`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
