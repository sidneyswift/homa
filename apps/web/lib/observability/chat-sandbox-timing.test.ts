import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { SandboxBackend } from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

import { withPreviewSandboxTiming } from "./chat-sandbox-timing";

function enablePreview() {
  const before = [process.env.VERCEL_ENV, process.env.HOMA_PREVIEW_SANDBOX_TIMING];
  process.env.VERCEL_ENV = "preview";
  process.env.HOMA_PREVIEW_SANDBOX_TIMING = "1";
  return () => {
    for (const [index, key] of ["VERCEL_ENV", "HOMA_PREVIEW_SANDBOX_TIMING"].entries()) {
      if (before[index] === undefined) delete process.env[key]; else process.env[key] = before[index];
    }
  };
}

test("real local backend retains seeded skill contents, writes, reconnect state and missing-file behavior", async (t) => {
  const restore = enablePreview();
  t.after(restore);
  const appRoot = await mkdtemp(join(tmpdir(), "homa-sandbox-timing-"));
  t.after(() => rm(appRoot, { recursive: true, force: true }));
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const original = justbash();
  const backend = withPreviewSandboxTiming(original);
  assert.equal(backend.name, original.name);
  const runtimeContext = { appRoot };
  const templateKey = "synthetic-template";
  const skillPath = "/workspace/skills/synthetic/SKILL.md";
  await backend.prewarm({ runtimeContext, templateKey, seedFiles: [{ path: skillPath, content: "private-skill-body" }] });
  const input = { runtimeContext, templateKey, sessionKey: "synthetic-session",
    tags: { sessionId: "synthetic-eve-session", secret: "private-tag" } };
  const handle = await backend.create(input);
  assert.equal(await handle.session.readTextFile({ path: skillPath }), "private-skill-body");
  await handle.session.writeTextFile({ path: "/workspace/scratch.txt", content: "private-scratch" });
  assert.equal(await handle.session.readTextFile({ path: "/workspace/scratch.txt" }), "private-scratch");
  assert.equal(await handle.session.readTextFile({ path: "/workspace/skills/missing/SKILL.md" }), null);
  const state = await handle.captureState();
  assert.equal(state.backendName, backend.name);
  assert.equal(state.sessionKey, input.sessionKey);
  await handle.dispose();
  const resumed = await backend.create({ ...input, existingMetadata: state.metadata });
  assert.equal(resumed.session.id, handle.session.id);
  assert.equal(await resumed.session.readTextFile({ path: "/workspace/scratch.txt" }), "private-scratch");
  await resumed.dispose();
  const rows = logs.filter(row => row[0] === "[chat-sandbox]").map(row => JSON.parse(row[1] as string));
  assert.equal(rows.filter(row => row.stage === "acquire").length, 2);
  assert.equal(rows.filter(row => row.stage === "read_skill").length, 2);
  assert.deepEqual(rows.filter(row => row.stage === "read_skill").map(row => row.outcome), ["ok", "ok"]);
  assert.deepEqual(rows.filter(row => row.stage === "acquire").map(row => row.reconnectMetadataPresent), [false, true]);
  assert.ok(rows.every(row => row.sessionId === input.tags.sessionId && row.durationMs >= 0));
  assert.equal(new Set(rows.map(row => row.acquisitionId)).size, 2);
  assert.doesNotMatch(JSON.stringify(rows), /private-|scratch|SKILL\.md|missing|template|metadata"|authorization/i);
});

test("failed acquisition preserves the original error even if logging fails", async (t) => {
  const restore = enablePreview();
  t.after(restore);
  const error = new Error("private-provider-error");
  const original: SandboxBackend = {
    name: "synthetic",
    async prewarm() { return { reused: true }; },
    async create() { assert.equal(this, original); throw error; },
  };
  t.mock.method(console, "info", () => { throw new Error("logger unavailable"); });
  const backend = withPreviewSandboxTiming(original);
  await assert.rejects(backend.create({ runtimeContext: { appRoot: "/synthetic" }, templateKey: null,
    sessionKey: "synthetic-session" }), thrown => thrown === error);
});

test("production and disabled previews preserve exact backend identity", (t) => {
  const restore = enablePreview();
  t.after(restore);
  const original = justbash();
  process.env.VERCEL_ENV = "production";
  assert.equal(withPreviewSandboxTiming(original), original);
  process.env.VERCEL_ENV = "preview";
  process.env.HOMA_PREVIEW_SANDBOX_TIMING = "0";
  assert.equal(withPreviewSandboxTiming(original), original);
});
