import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { DURABLE_WRITE_ENV_VARS } from "./eval-isolation";

const webRoot = resolve("apps/web");
const preloadUrl = pathToFileURL(join(webRoot, "lib/eval-isolation-runtime.mjs")).href;
const eveLoaderUrl = pathToFileURL(
  join(webRoot, "node_modules/eve/dist/src/cli/dev/environment.js"),
).href;
const eveDiscoveryUrl = pathToFileURL(
  join(webRoot, "node_modules/eve/dist/src/evals/runner/discover.js"),
).href;

const descendantProgram = `
import assert from 'node:assert/strict';
const names = ${JSON.stringify(DURABLE_WRITE_ENV_VARS)};
for (const name of names) assert.ok(process.env[name] === undefined, name);
const { loadDevelopmentEnvironmentFiles } = await import(${JSON.stringify(eveLoaderUrl)});
loadDevelopmentEnvironmentFiles(process.env.ISOLATION_TEST_ROOT);
loadDevelopmentEnvironmentFiles(process.env.ISOLATION_TEST_ROOT);
for (const name of names) assert.ok(process.env[name] === undefined, name);
assert.ok(process.env.VERCEL_OIDC_TOKEN === 'offline-oidc-reloaded');
`;

// A fresh process is essential: Eve caches the environment's initially
// inherited keys. A pure record test cannot reproduce the second-load bug.
const program = `
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const names = ${JSON.stringify(DURABLE_WRITE_ENV_VARS)};
const mode = process.env.ISOLATION_TEST_MODE;
const root = process.env.ISOLATION_TEST_ROOT;
const isolated = mode === 'direct' || mode === 'preloaded';
const assertAbsent = () => {
  for (const name of names) assert.ok(process.env[name] === undefined, name + ' must stay absent');
};
if (mode === 'preloaded') assertAbsent(); // Before any Homa module is imported.
const { loadDevelopmentEnvironmentFiles } = await import(${JSON.stringify(eveLoaderUrl)});
loadDevelopmentEnvironmentFiles(root);
if (mode !== 'preloaded') {
  for (const name of names) assert.ok(process.env[name] === 'offline-first', name + ' fixture must load');
}
const { discoverEvalConfig } = await import(${JSON.stringify(eveDiscoveryUrl)});
const config = await discoverEvalConfig(${JSON.stringify(webRoot)});
assert.ok(config._tag === 'EveEvalConfig', 'actual config must be discovered');
if (isolated) assertAbsent();

// This is the same cached loader used by Eve's server-start path.
loadDevelopmentEnvironmentFiles(root);
if (isolated) assertAbsent();
else for (const name of names) assert.ok(process.env[name] === 'offline-first', name + ' mode must preserve credentials');
assert.ok(process.env.VERCEL_OIDC_TOKEN === 'offline-oidc-first', 'model OIDC must load');
assert.ok(process.env.HOMA_EVAL_DATABASE_URL === 'postgres://homa_eval@127.0.0.1:5599/homa_eval', 'local target must survive');

writeFileSync(join(root, '.env.local'), [
  ...names.map(name => name + '=offline-reloaded'),
  'VERCEL_OIDC_TOKEN=offline-oidc-reloaded',
  'ISOLATION_TEST_ORDINARY=updated',
].join('\\n'));
loadDevelopmentEnvironmentFiles(root);
if (isolated) {
  assertAbsent();
  Object.assign(process.env, Object.fromEntries(names.map(name => [name, 'offline-assignment'])));
  for (const name of names) Object.defineProperty(process.env, name, {
    value: 'offline-definition', configurable: true, enumerable: true, writable: true,
  });
  assertAbsent();
} else for (const name of names) assert.ok(process.env[name] === 'offline-reloaded', name + ' mode must still allow reload');
assert.ok(process.env.VERCEL_OIDC_TOKEN === 'offline-oidc-reloaded', 'model OIDC refresh must survive');
assert.ok(process.env.ISOLATION_TEST_ORDINARY === 'updated', 'ordinary dotenv updates must survive');

if (mode === 'preloaded') {
  const nested = spawnSync(process.execPath, ['--input-type=module', '--eval', ${JSON.stringify(descendantProgram)}], {
    env: process.env, encoding: 'utf8', timeout: 30000,
  });
  assert.ok(nested.status === 0, 'Node descendant must inherit protection: ' + nested.stderr);
}
console.log('actual Eve loader and config: ' + mode + ' passed');
`;

for (const mode of ["direct", "preloaded", "vercel", "opt-out"] as const) {
  test(`actual Eve loader preserves ${mode} isolation behavior across reloads`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "homa-eval-env-"));
    try {
      await writeFile(join(directory, ".env.local"), [
        ...DURABLE_WRITE_ENV_VARS.map((name) => `${name}=offline-first`),
        "VERCEL_OIDC_TOKEN=offline-oidc-first",
      ].join("\n"));
      // Never inherit the developer's credentials into these subprocesses.
      const environment: NodeJS.ProcessEnv = {
        NODE_ENV: "test",
        PATH: process.env.PATH,
        ISOLATION_TEST_MODE: mode,
        ISOLATION_TEST_ROOT: directory,
        HOMA_EVAL_DATABASE_URL: "postgres://homa_eval@127.0.0.1:5599/homa_eval",
      };
      if (mode !== "direct") {
        environment.HOMA_EVAL_ISOLATION = "1";
        environment.NODE_OPTIONS = `--import=${JSON.stringify(preloadUrl)}`;
      }
      if (mode === "preloaded") {
        for (const name of DURABLE_WRITE_ENV_VARS) environment[name] = "offline-inherited";
      }
      if (mode === "vercel") environment.VERCEL = "1";
      if (mode === "opt-out") environment.HOMA_EVAL_ALLOW_PROD_WRITES = "1";
      const child = spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
        cwd: webRoot,
        env: environment,
        encoding: "utf8",
        timeout: 45_000,
      });
      assert.ok(child.status === 0, `synthetic ${mode} process failed: ${child.stderr}`);
      assert.match(child.stdout, /actual Eve loader and config: .* passed/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
