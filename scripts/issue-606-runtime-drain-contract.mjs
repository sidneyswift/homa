#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Vercel's current Node function ceiling is 800 seconds with Fluid Compute
// and 900 seconds without it on Enterprise. Homa requests the plan maximum,
// so the larger documented ceiling is the safe old-instance bound.
// https://vercel.com/docs/functions/configuring-functions/duration
export const VERCEL_NODE_ABSOLUTE_CEILING_SECONDS = 900;
export const OLD_INSTANCE_DRAIN_MARGIN_SECONDS = 120;
export const ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS =
  VERCEL_NODE_ABSOLUTE_CEILING_SECONDS + OLD_INSTANCE_DRAIN_MARGIN_SECONDS;

export function validateIssue606RuntimeDrainContract(repositoryRoot) {
  const patch = readFileSync(
    resolve(repositoryRoot, "patches/eve@0.19.0.patch"),
    "utf8"
  );
  const lockfile = readFileSync(
    resolve(repositoryRoot, "pnpm-lock.yaml"),
    "utf8"
  );
  const guard = readFileSync(
    resolve(repositoryRoot, "scripts/eve-stream-max-duration-check.mjs"),
    "utf8"
  );
  const ci = readFileSync(
    resolve(repositoryRoot, ".github/workflows/ci.yml"),
    "utf8"
  );

  assert.match(patch, /maxDuration:`max`/u);
  assert.match(patch, /applyEveServiceRoutePrefixWrapperWithMaxDuration/u);
  assert.match(
    lockfile,
    /eve@0\.19\.0:\n\s+hash: ca8d2bc1e2fc5efca1348608ebe7fbc9914bc68047f7e5dc202b76127d586f6c\n\s+path: patches\/eve@0\.19\.0\.patch/u
  );
  assert.match(guard, /config\.maxDuration,[\s\S]*"max"/u);
  assert.match(ci, /VERCEL=1 pnpm --filter web exec eve build/u);
  assert.match(ci, /VERCEL=1 pnpm check:eve-stream-duration/u);
  assert.ok(
    ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS > VERCEL_NODE_ABSOLUTE_CEILING_SECONDS
  );

  const contract = [
    "eve_max_duration=max",
    `vercel_node_absolute_ceiling_seconds=${VERCEL_NODE_ABSOLUTE_CEILING_SECONDS}`,
    `drain_margin_seconds=${OLD_INSTANCE_DRAIN_MARGIN_SECONDS}`,
    `drain_seconds=${ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS}`,
  ].join("\n");

  return {
    drainSeconds: ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS,
    contractSha256: createHash("sha256").update(`${contract}\n`).digest("hex"),
  };
}

function main() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = validateIssue606RuntimeDrainContract(repositoryRoot);
  console.log(`ISSUE_606_OLD_INSTANCE_DRAIN_SECONDS=${result.drainSeconds}`);
  console.log(
    `ISSUE_606_RUNTIME_DRAIN_CONTRACT_SHA256=${result.contractSha256}`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
