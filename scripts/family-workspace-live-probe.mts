/** Explicit synthetic acceptance probe: real Drive, disposable DB, in-memory checkpoints. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { mapDb } from "../apps/web/lib/map/db";
import { workspaceHash } from "../apps/web/lib/family-workspace/contract";
import { deleteFamilyWorkspaceDrives } from "../apps/web/lib/family-workspace/provider";
import { operateFamilyWorkspace, workspaceDependencies } from "../apps/web/lib/family-workspace/service";

const { values } = parseArgs({ options: { execute: { type: "boolean" }, output: { type: "string" }, "oidc-env": { type: "string" } } });
if (!values.execute || !values.output || !values["oidc-env"]) throw Error("Use --execute --output <receipt> --oidc-env <local env> through pnpm eval:sandbox --exec.");
const dbUrl = new URL(process.env.HOMA_EVAL_DATABASE_URL ?? "https://missing.invalid");
if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname) || process.env.VERCEL) throw Error("Requires the disposable local database, never Vercel.");
const token = /^VERCEL_OIDC_TOKEN\s*=\s*["']?([^"'\r\n]+)/mu.exec(readFileSync(values["oidc-env"], "utf8"))?.[1];
if (!token) throw Error("Refresh the local OIDC token first.");
process.env.VERCEL_OIDC_TOKEN = token;
// This explicit operator probe exercises production provider code with a fresh
// synthetic family in local Postgres. It never boots the agent or Blob adapter.
process.env.VERCEL_ENV = "production";
process.env.HOMA_EVAL_ISOLATION = "0";
const family = randomUUID();
const checkpoints = new Map<string, Buffer>();
const dependencies: typeof workspaceDependencies = {
  ...workspaceDependencies,
  checkpoint: async (id, fileId, revision, bytes) => {
    assert.equal(id, family);
    const key = `${fileId}/${revision}`; checkpoints.set(key, bytes); return key;
  },
  readCheckpoint: async (id, key, hash) => {
    assert.equal(id, family); const bytes = checkpoints.get(key);
    assert.ok(bytes); assert.equal(workspaceHash(bytes), hash); return bytes;
  },
  deleteCheckpoint: async (id, key) => { assert.equal(id, family); checkpoints.delete(key); },
  deleteCheckpoints: async (id, fileId) => {
    assert.equal(id, family); for (const key of checkpoints.keys()) if (key.startsWith(`${fileId}/`)) checkpoints.delete(key);
  },
};
const receipt = { startedAt: new Date().toISOString(), database: "disposable local Postgres", checkpoints: "in-memory test adapter", provider: "real Vercel Drive", family, checks: [] as string[], cleanup: "unconfirmed", error: undefined as string | undefined };
const run = (input: Parameters<typeof operateFamilyWorkspace>[2]) => operateFamilyWorkspace(family, "production", input, dependencies);
try {
  await mapDb()`insert into public.families (id, name, sandbox) values (${family}, 'Synthetic Drive acceptance', true)`;
  const revision = randomUUID();
  const write = { operation: "write" as const, path: "drafts/lesson.md", content: "Synthetic apples lesson, revision one.", expectedRevision: null, requestId: revision };
  assert.equal((await run(write)).ok, true);
  const read = await run({ operation: "read", path: write.path });
  assert.ok("content" in read); assert.equal(read.content, write.content); assert.equal(read.cacheHit, true);
  receipt.checks.push("service write and read across fresh sandboxes");
  assert.equal((await run(write)).ok, true); assert.equal(checkpoints.size, 1);
  receipt.checks.push("idempotent retry reuses checkpoint");
  await deleteFamilyWorkspaceDrives(family);
  const restored = await run({ operation: "read", path: write.path });
  assert.ok("content" in restored); assert.equal(restored.content, write.content); assert.equal(restored.cacheHit, false);
  receipt.checks.push("deleted Drive rebuilt from verified checkpoint");
  const destination = "drafts/next-lesson.md";
  assert.equal((await run({ operation: "move", path: write.path, destination, expectedRevision: revision })).ok, true);
  assert.equal((await run({ operation: "remove", path: destination, expectedRevision: revision })).ok, true);
  assert.equal(checkpoints.size, 0);
  receipt.checks.push("move and remove clear index and checkpoints");
} catch (error) {
  receipt.error = error instanceof Error ? error.message : String(error); process.exitCode = 1;
} finally {
  try { await deleteFamilyWorkspaceDrives(family); receipt.cleanup = "Drive verified absent; operation sandboxes stopped and deleted"; }
  catch (error) { receipt.cleanup = String(error); process.exitCode = 1; }
  await mapDb().end({ timeout: 5 });
  writeFileSync(values.output, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(receipt, null, 2));
}
