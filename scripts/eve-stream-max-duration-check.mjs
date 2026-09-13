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
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const evePackageJsonPath = webRequire.resolve("eve/package.json");
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--package-root"),
  "Usage: node scripts/eve-stream-max-duration-check.mjs [--package-root <extracted-eve>]");
assert.ok(!(args.length && process.env.VERCEL),
  "An extracted package cannot certify the installed build. Run its fixture check without VERCEL, then verify the candidate's real installed build separately.");
const eveRoot = args.length ? path.resolve(args[1]) : path.dirname(evePackageJsonPath);
const eveMetadata = JSON.parse(await readFile(path.join(eveRoot, "package.json"), "utf8"));
assert.equal(eveMetadata.name, "eve");
assert.ok(["0.19.0", "0.54.3"].includes(eveMetadata.version), "Review the duration guard for this Eve version");
const usesNormalizedOutput = eveMetadata.version === "0.54.3";
const routeOutputPath = path.join(
  eveRoot,
  usesNormalizedOutput
    ? "dist/src/internal/workflow-bundle/vercel-workflow-output.js"
    : "dist/src/internal/workflow-bundle/eve-service-route-output.js",
);
const patchPath = path.join(repoRoot, `patches/eve@${eveMetadata.version}.patch`);
const builtConfigPath = path.join(
  repoRoot,
  "apps/web/.vercel/output/functions/eve/__server.func/.vc-config.json",
);

async function assertPatchedModuleWritesMaxDuration() {
  if (usesNormalizedOutput) return assertNormalizedFunctionWritesMaxDuration();
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

async function assertNormalizedFunctionWritesMaxDuration() {
  const { normalizeEveVercelFunctionOutput } = await import(routeOutputPath);
  const tempDir = await mkdtemp(path.join(tmpdir(), "eve-normalized-duration-"));
  try {
    for (const duration of [undefined, 300, "max"]) {
      const output = path.join(tempDir, String(duration));
      const functions = path.join(output, "functions");
      const source = path.join(functions, "__server.func");
      const shared = path.join(functions, "eve/__server.func");
      const route = path.join(functions, "eve/v1/session/stream.func");
      const workflow = path.join(functions, ".well-known/workflow/v1/flow.func");
      const original = {
        runtime: "nodejs24.x", supportsResponseStreaming: true, handler: "index.mjs",
        ...(duration === undefined ? {} : { maxDuration: duration }),
      };
      await mkdir(source, { recursive: true });
      await mkdir(path.dirname(route), { recursive: true });
      await mkdir(workflow, { recursive: true });
      await writeFile(path.join(source, ".vc-config.json"), JSON.stringify(original));
      await writeFile(path.join(source, "index.mjs"), "export default {};\n");
      await writeFile(path.join(workflow, ".vc-config.json"), JSON.stringify({ maxDuration: 777 }));
      await symlink(path.relative(path.dirname(route), source), route, "dir");
      await normalizeEveVercelFunctionOutput(output);
      assert.deepEqual(JSON.parse(await readFile(path.join(shared, ".vc-config.json"), "utf8")),
        { ...original, maxDuration: "max" });
      assert.equal(await realpath(route), await realpath(shared));
      assert.equal(await readFile(path.join(shared, "index.mjs"), "utf8"), "export default {};\n");
      assert.deepEqual(JSON.parse(await readFile(path.join(workflow, ".vc-config.json"), "utf8")),
        { maxDuration: 777 });
    }
    // Do not publish a partial shared function when its configuration is invalid.
    for (const invalid of ["{broken", "[]"]) {
      const output = path.join(tempDir, invalid === "[]" ? "array-config" : "broken-config");
      const source = path.join(output, "functions/__server.func");
      const previous = path.join(output, "functions/eve/__server.func");
      await mkdir(source, { recursive: true });
      await mkdir(previous, { recursive: true });
      await writeFile(path.join(source, ".vc-config.json"), invalid);
      await writeFile(path.join(previous, ".vc-config.json"), "previous-output");
      await assert.rejects(normalizeEveVercelFunctionOutput(output));
      assert.equal(await readFile(path.join(previous, ".vc-config.json"), "utf8"), "previous-output");
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function assertPatchFileKeepsMaxDurationHunk() {
  const patch = await readFile(patchPath, "utf8");
  assert.match(patch, /maxDuration:`max`/, `${patchPath} must keep the duration hunk`);
  assert.match(patch, usesNormalizedOutput
    ? /setSharedEveFunctionMaxDuration/
    : /applyEveServiceRoutePrefixWrapperWithMaxDuration/,
  `${patchPath} must patch the reviewed output writer`);
}

async function assertBuiltOutputWhenPresent() {
  if (!process.env.VERCEL) {
    // Eve only rewrites eve/__server.func during the Vercel-mode build path.
    // Local `eve build` without VERCEL=1 can leave a stale config around, so
    // only enforce the built artifact when we are on that path (CI/deploy).
    return false;
  }
  let raw;
  try {
    raw = await readFile(builtConfigPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `VERCEL=1 build must emit ${path.relative(repoRoot, builtConfigPath)}. ` +
          "Standalone eve build skips that path unless a co-deployed " +
          "Next+Eve experimentalServices config is present (CI seeds " +
          "apps/web/.vercel/output/config.json before eve build).",
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
let passed = 0;
let skipped = 0;
for (const [name, run] of checks) {
  try {
    if (await run() === false) {
      skipped += 1;
      console.log(`skip - ${name} needs VERCEL=1`);
    } else {
      passed += 1;
      console.log(`ok  - ${name}`);
    }
  } catch (error) {
    failed += 1;
    console.error(`fail - ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`eve-stream-max-duration-check: ${passed} checks passed, ${skipped} skipped`);
