/** No model calls. Run with eval:sandbox --exec pnpm exec tsx ../../scripts/eval-isolation-sandbox-probe.mts. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Check before importing any Homa isolation helper: the process preload owns
// this guarantee even when a --exec command never discovers the eval config.
assert.ok(process.env.SUPABASE_DB_PASSWORD === undefined, "preload must remove durable credentials");
assert.ok(process.env.HOMA_EVAL_ISOLATION === "1", "sandbox must activate isolation");
assert.ok(process.env.VERCEL === undefined, "probe requires a local sandbox");
assert.ok(process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1", "probe cannot opt out");
const localUrl = new URL(process.env.HOMA_EVAL_DATABASE_URL ?? "");
assert.ok(localUrl.hostname === "127.0.0.1" && localUrl.pathname === "/homa_eval", "probe requires disposable Postgres");
const oidcBefore = process.env.VERCEL_OIDC_TOKEN;
const require = createRequire(join(process.cwd(), "package.json"));
const evePackage = dirname(require.resolve("eve/package.json"));
const { loadDevelopmentEnvironmentFiles } = await import(
  pathToFileURL(join(evePackage, "dist/src/cli/dev/environment.js")).href
);
loadDevelopmentEnvironmentFiles(process.cwd());
loadDevelopmentEnvironmentFiles(process.cwd());
const { DURABLE_WRITE_ENV_VARS } = await import("../apps/web/lib/eval-isolation.ts");
for (const name of DURABLE_WRITE_ENV_VARS) {
  assert.ok(process.env[name] === undefined, `${name} must remain absent after actual Eve reloads`);
}
if (oidcBefore) assert.ok(process.env.VERCEL_OIDC_TOKEN === oidcBefore, "inherited OIDC must survive");
assert.ok(process.env.VERCEL_OIDC_TOKEN, "local model OIDC must remain available");
const { mapDb, resolveMapDbTarget } = await import("../apps/web/lib/map/db.ts");
assert.ok(resolveMapDbTarget(process.env).kind === "eval-sandbox", "actual database client must select sandbox");
const database = mapDb();
try {
  const [row] = await database`select current_database() as name, current_user as role`;
  assert.ok(row?.name === "homa_eval" && row?.role === "homa_eval", "actual query must reach disposable database");
  console.log("eval isolation: actual Eve reloads, OIDC preservation, and disposable Postgres query passed; model calls: 0");
} finally {
  await database.end({ timeout: 1 });
}
