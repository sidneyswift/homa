import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Sandbox } from "@vercel/sandbox";

import { withWorkspaceDrive, deleteFamilyWorkspaceDrives } from "./provider";
import { workspaceDriveName, workspaceHash, workspaceObjectDirectory, workspacePath, type WorkspaceFile } from "./contract";
import { familyWorkspaceNamespace, operateFamilyWorkspace, workspaceDependencies } from "./service";

const family = "11111111-1111-4111-8111-111111111111";
const foreign = "22222222-2222-4222-8222-222222222222";
const path = "drafts/week-2.md";

function harness() {
  const rows = new Map<string, WorkspaceFile>();
  const objects = new Map<string, Buffer>();
  const checkpoints = new Map<string, Buffer>();
  const calls: string[] = [];
  const fake = { readFileToBuffer: async ({ path }: { path: string }) => objects.get(path) ?? null,
    fs: { rm: async (path: string) => { calls.push(`remove:${path}`); for (const key of objects.keys()) if (key.startsWith(path)) objects.delete(key); } },
  } as unknown as Sandbox;
  const dependencies: typeof workspaceDependencies = {
    authorize: async () => { calls.push("authorize"); },
    list: async (id) => [...rows.entries()].filter(([key, row]) => key.startsWith(`${id}:`) && !row.deleted_at).map(([, row]) => row),
    get: async (id, _namespace, filePath) => rows.get(`${id}:${filePath}`) ?? null,
    save: async (id, _namespace, file, expected) => {
      calls.push("save");
      const old = rows.get(`${id}:${file.path}`);
      if ((old && !old.deleted_at ? old.revision : null) !== expected) return false;
      rows.set(`${id}:${file.path}`, { ...file, deleted_at: null, updated_at: "2026-09-28" });
      return true;
    },
    move: async (id, _namespace, from, to, revision) => {
      const file = rows.get(`${id}:${from}`);
      if (!file || file.revision !== revision || rows.has(`${id}:${to}`)) return false;
      rows.delete(`${id}:${from}`); rows.set(`${id}:${to}`, { ...file, path: to }); return true;
    },
    remove: async (id, _namespace, name, revision) => {
      const file = rows.get(`${id}:${name}`);
      if (!file || file.revision !== revision) return false;
      file.deleted_at = "2026-09-28"; return true;
    },
    mount: async (_id, _namespace, _signal, work) => { calls.push("mount"); try { return await work(fake); } finally { calls.push("stop"); } },
    mirror: async (_sandbox, bytes, hash, fileId) => { calls.push("mirror"); objects.set(`${workspaceObjectDirectory(fileId)}/${hash}`, bytes); },
    checkpoint: async (id, fileId, revision, bytes) => {
      calls.push("checkpoint"); const url = `https://test.private.blob.vercel-storage.com/families/${id}/workspace/${fileId}/${revision}.txt`;
      checkpoints.set(url, bytes); return url;
    },
    readCheckpoint: async (_id, url, hash) => { const bytes = checkpoints.get(url)!; assert.equal(workspaceHash(bytes), hash); return bytes; },
    deleteCheckpoint: async (_id, url) => { checkpoints.delete(url); },
    deleteCheckpoints: async (id, fileId) => { for (const url of checkpoints.keys()) if (url.includes(`/families/${id}/workspace/${fileId}/`)) checkpoints.delete(url); },
  };
  const run = (input: Parameters<typeof operateFamilyWorkspace>[2], id = family) => operateFamilyWorkspace(id, "development", input, dependencies);
  const write = (content = "Synthetic curriculum outline") => run({ operation: "write", path, content, requestId: randomUUID(), expectedRevision: null });
  return { rows, objects, checkpoints, calls, dependencies, run, write };
}

test("paths cannot escape and provider identity is isolated by family and environment", () => {
  for (const bad of ["/drafts/a.md", "drafts/../a.md", "drafts/a/../../b.md", "drafts/a\\b.md", "drafts/a%2fb.md", "drafts/a\0.md", "drafts/a//b.md"]) assert.throws(() => workspacePath(bad));
  assert.equal(workspacePath(path), path);
  assert.notEqual(workspaceDriveName(family, "production"), workspaceDriveName(foreign, "production"));
  assert.notEqual(workspaceDriveName(family, "production"), workspaceDriveName(family, "preview"));
});

test("checkpoint precedes record commit; writer stop precedes success; a fresh call reads the saved file", async () => {
  const h = harness();
  assert.equal((await h.write()).ok, true);
  assert.ok(h.calls.indexOf("checkpoint") < h.calls.indexOf("save"));
  assert.equal(h.calls.at(-1), "stop");
  const read = await h.run({ operation: "read", path });
  assert.ok("content" in read);
  assert.equal(read.content, "Synthetic curriculum outline");
  assert.equal(read.cacheHit, true);
});

test("a missing Drive object rehydrates verified checkpoint bytes", async () => {
  const h = harness(); await h.write(); h.objects.clear();
  const result = await h.run({ operation: "read", path });
  assert.ok("content" in result); assert.equal(result.cacheHit, false); assert.equal(h.objects.size, 1);
});

test("foreign family cannot list, read, move, remove, or overwrite an existing file", async () => {
  const h = harness(); await h.write(); const original = h.rows.get(`${family}:${path}`)!;
  assert.deepEqual(await h.run({ operation: "list" }, foreign), { ok: true, files: [] });
  assert.equal((await h.run({ operation: "read", path }, foreign)).ok, false);
  assert.equal((await h.run({ operation: "move", path, destination: "drafts/stolen.md", expectedRevision: original.revision }, foreign)).ok, false);
  assert.equal((await h.run({ operation: "remove", path, expectedRevision: original.revision }, foreign)).ok, false);
  assert.equal((await h.run({ operation: "write", path, content: "Overwrite", expectedRevision: original.revision, requestId: randomUUID() }, foreign)).ok, false);
  assert.equal(h.rows.get(`${family}:${path}`), original);
});

test("idempotent retry does not duplicate checkpoints; changed content cannot reuse a request ID", async () => {
  const h = harness(); const requestId = randomUUID();
  const input = { operation: "write" as const, path, content: "First", expectedRevision: null, requestId };
  await h.run(input); await h.run(input); assert.equal(h.checkpoints.size, 1);
  assert.deepEqual(await h.run({ ...input, content: "Other" }), { ok: false, reason: "request-conflict" });
});

test("stale edits and oversized UTF-8 content cannot replace current work", async () => {
  const h = harness(); await h.write();
  assert.equal((await h.run({ operation: "write", path, content: "Stale", expectedRevision: randomUUID(), requestId: randomUUID() })).ok, false);
  await assert.rejects(h.write("🙂".repeat(20_000)), /65536/);
  assert.equal(h.checkpoints.size, 1);
});

test("checkpoint failure cannot create a file record", async () => {
  const h = harness(); h.dependencies.checkpoint = async () => { throw new Error("offline"); };
  await assert.rejects(h.write(), /offline/); assert.equal(h.rows.size, 0); assert.equal(h.calls.at(-1), "stop");
});

test("revocation after checkpoint prevents record commit and cleans the uncommitted checkpoint", async () => {
  const h = harness(); let authorizations = 0;
  h.dependencies.authorize = async () => { if (++authorizations === 3) throw new Error("deleted"); };
  await assert.rejects(h.write(), /deleted/); assert.equal(h.rows.size, 0); assert.equal(h.checkpoints.size, 0);
});

test("move retries are safe; removal erases all cached versions and checkpoints", async () => {
  const h = harness(); await h.write(); const file = h.rows.get(`${family}:${path}`)!;
  const move = { operation: "move" as const, path, destination: "drafts/next-week.md", expectedRevision: file.revision };
  assert.equal((await h.run(move)).ok, true); assert.equal((await h.run(move)).ok, true);
  h.objects.set(`${workspaceObjectDirectory(file.id)}/old-version`, Buffer.from("old"));
  const remove = { operation: "remove" as const, path: move.destination, expectedRevision: file.revision };
  assert.equal((await h.run(remove)).ok, true); assert.equal((await h.run(remove)).ok, true);
  assert.equal(h.objects.size, 0); assert.equal(h.checkpoints.size, 0);
  assert.equal((await h.run({ operation: "read", path: move.destination })).ok, false);
});


test("isolated evals cannot allocate or delete live Drives even with model OIDC", async () => {
  const previous = { ...process.env };
  try {
    delete process.env.VERCEL;
    process.env.HOMA_EVAL_ISOLATION = "1";
    delete process.env.HOMA_EVAL_ALLOW_PROD_WRITES;
    process.env.HOMA_FAMILY_DRIVES_ENABLED = "true";
    process.env.VERCEL_ENV = "production";
    assert.equal(await familyWorkspaceNamespace(family), null);
    await assert.rejects(withWorkspaceDrive(family, "production", AbortSignal.timeout(1000), async () => true), /disabled/);
    assert.equal(await deleteFamilyWorkspaceDrives(family), 0);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test("an ambiguous committed write retains its checkpoint for safe retry", async () => {
  const h = harness();
  const save = h.dependencies.save;
  h.dependencies.save = async (...args) => { await save(...args); throw new Error("response lost"); };
  await assert.rejects(h.write(), /response lost/);
  assert.equal(h.rows.size, 1); assert.equal(h.checkpoints.size, 1);
});

test("a failed Drive mirror can be retried without creating another checkpoint", async () => {
  const h = harness();
  const mirror = h.dependencies.mirror;
  h.dependencies.mirror = async () => { throw new Error("writer stopped"); };
  const input = { operation: "write" as const, path, content: "Recover me", expectedRevision: null, requestId: randomUUID() };
  await assert.rejects(h.run(input), /writer stopped/);
  assert.equal(h.checkpoints.size, 1);
  h.dependencies.mirror = mirror;
  assert.equal((await h.run(input)).ok, true);
  assert.equal(h.checkpoints.size, 1); assert.equal(h.objects.size, 1);
});


test("recreating a removed file first clears leftovers from interrupted cleanup", async () => {
  const h = harness(); await h.write();
  const old = h.rows.get(`${family}:${path}`)!;
  old.deleted_at = "2026-09-28";
  assert.equal((await h.write("New draft")).ok, true);
  assert.equal(h.checkpoints.size, 1); assert.equal(h.objects.size, 1);
});
