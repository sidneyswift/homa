#!/usr/bin/env node
/**
 * Regression guard for the recurring production
 * "Task timed out after 300 seconds" cluster on /eve/__server.
 *
 * Eve's shared Vercel function for /eve/v1/session/:id/stream was shipping
 * without maxDuration, so Fluid Compute kept the Pro default of 300s while
 * long chat streams stayed open. Workflow functions already request
 * maxDuration: "max". This check proves the shared stream function does too.
 *
 * Usage: node scripts/eve-stream-max-duration-check.mjs
 * For the built-artifact assertion, run under the Vercel build path:
 *   VERCEL=1 pnpm --filter web exec eve build && VERCEL=1 pnpm check:eve-stream-duration
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const evePackageJsonPath = webRequire.resolve("eve/package.json");
const eveRoot = path.dirname(evePackageJsonPath);
const routeOutputPath = path.join(
  eveRoot,
  "dist/src/internal/workflow-bundle/eve-service-route-output.js",
);
const patchPath = path.join(repoRoot, "patches/eve@0.19.0.patch");
const builtConfigPath = path.join(
  repoRoot,
  "apps/web/.vercel/output/functions/eve/__server.func/.vc-config.json",
);

async function assertPatchedModuleWritesMaxDuration() {
  const { applyEveServiceRoutePrefixWrapper } = await import(routeOutputPath);
  const tempDir = await mkdtemp(path.join(tmpdir(), "eve-stream-max-duration-"));
  try {
    await writeFile(
      path.join(tempDir, ".vc-config.json"),
      `${JSON.stringify({ runtime: "nodejs24.x", supportsResponseStreaming: true }, null, 2)}\n`,
    );
    await applyEveServiceRoutePrefixWrapper(tempDir, "/");
    const config = JSON.parse(
      await readFile(path.join(tempDir, ".vc-config.json"), "utf8"),
    );
    assert.equal(
      config.maxDuration,
      "max",
      "Eve shared /eve/__server.func must request Vercel plan maxDuration",
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function assertPatchFileKeepsMaxDurationHunk() {
  const patch = await readFile(patchPath, "utf8");
  assert.match(
    patch,
    /maxDuration:`max`/,
    "patches/eve@0.19.0.patch must keep the stream-function maxDuration hunk",
  );
  assert.match(
    patch,
    /applyEveServiceRoutePrefixWrapperWithMaxDuration/,
    "patches/eve@0.19.0.patch must wrap applyEveServiceRoutePrefixWrapper",
  );
}

async function assertBuiltOutputWhenPresent() {
  if (!process.env.VERCEL) {
    // Eve only rewrites eve/__server.func during the Vercel-mode build path.
    // Local `eve build` without VERCEL=1 can leave a stale config around, so
    // only enforce the built artifact when we are on that path (CI/deploy).
    console.log("skip - built artifact assertion needs VERCEL=1");
    return;
  }
  let raw;
  try {
    raw = await readFile(builtConfigPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `VERCEL=1 build must emit ${path.relative(repoRoot, builtConfigPath)}`,
      );
    }
    throw error;
  }
  const config = JSON.parse(raw);
  assert.equal(
    config.maxDuration,
    "max",
    `Built ${path.relative(repoRoot, builtConfigPath)} must request maxDuration "max"`,
  );
}

const checks = [
  ["patched module writes maxDuration", assertPatchedModuleWritesMaxDuration],
  ["patch file keeps maxDuration hunk", assertPatchFileKeepsMaxDurationHunk],
  ["built eve/__server.func config under VERCEL=1", assertBuiltOutputWhenPresent],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok  - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`fail - ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`eve-stream-max-duration-check: ${checks.length} checks passed`);
