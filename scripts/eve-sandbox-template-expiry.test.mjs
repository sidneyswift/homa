#!/usr/bin/env node
/**
 * Eve 0.19 sandbox-template guard (patches/eve@0.19.0.patch).
 *
 * eve builds one Vercel Sandbox template per agent at deploy time and
 * reuses it across deploys by content key. When a session fails to start
 * from it with any 404 or 410, the runtime deletes the template, and every
 * load_skill and read_file fails with SandboxTemplateNotProvisionedError
 * until a later build recreates it. That took every fleet skill down for
 * every family from 2026-10-13 to 2026-10-22 (Carolyng: "Materials guide
 * won't load"). eve threw the original error away, so the trigger is not
 * known: the snapshot's 30-day expiry (it slides with use) or a transient
 * Sandbox API error both fit.
 *
 * The patch snapshots templates with expiration 0 (never expires), salts
 * the template key so a pre-patch template whose snapshot still expires is
 * never reused, and logs the original error when a template is dropped.
 * Detection and alerting live in apps/web/lib/observability/skills-health.ts.
 *
 * Runs the installed patched package against a fake sandbox module. No
 * network, no credentials.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createVercelSandbox } from "../apps/web/node_modules/eve/dist/src/execution/sandbox/bindings/vercel.js";
import { createRuntimeSandboxTemplateKey } from "../apps/web/node_modules/eve/dist/src/runtime/sandbox/keys.js";

globalThis.fetch = async () => { throw new Error("Network is forbidden in this regression guard."); };
const installedPackage = JSON.parse(await readFile(new URL("../apps/web/node_modules/eve/package.json", import.meta.url), "utf8"));
assert.equal(installedPackage.version, "0.19.0", "Review this sandbox-template guard before changing Eve versions.");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const missing = () => Object.assign(new Error("not found"), { response: { status: 404 } });

function fakeTemplateSandbox(name, snapshotCalls) {
  return {
    name,
    currentSnapshotId: undefined,
    status: "running",
    tags: undefined,
    async runCommand() {
      return { exitCode: 0, stdout: async () => "", stderr: async () => "" };
    },
    async update() {},
    async writeFiles() {},
    async snapshot(options) {
      snapshotCalls.push(options);
      return { snapshotId: "snap_fake" };
    },
    async delete() {},
  };
}

test("a freshly built template snapshot never expires", async () => {
  const snapshotCalls = [];
  const backend = createVercelSandbox({
    loadSandboxModule: async () => ({ Sandbox: { get: async () => { throw missing(); } } }),
    createSandbox: async ({ createOptions }) => fakeTemplateSandbox(createOptions.name, snapshotCalls),
    createOptions: { networkPolicy: "deny-all" },
  });

  const result = await backend.prewarm({ templateKey: "eve-sbx-tpl-vercel-test", seedFiles: [] });

  assert.deepEqual(result, { reused: false });
  assert.deepEqual(snapshotCalls, [{ expiration: 0 }]);
});

test("the template key is salted so pre-patch templates are never reused", async () => {
  const previousProject = process.env.VERCEL_PROJECT_ID;
  process.env.VERCEL_PROJECT_ID = "prj_guard";
  try {
    const key = await createRuntimeSandboxTemplateKey({
      backendName: "vercel",
      compiledArtifactsSource: { kind: "guard" },
      nodeId: "__root__",
      sourceId: "guard-source",
      templatePlan: { kind: "workspace-content", contentHash: "guard-content" },
    });
    const scope = sha256("vercel-project:prj_guard").slice(0, 16);
    const versionHash = sha256("workspace-content:guard-content:__root__:guard-source");
    const keyFor = (salt) => `eve-sbx-tpl-vercel-${scope}-${sha256(`0.19.0:${salt}:${versionHash}`).slice(0, 20)}`;

    assert.equal(key, keyFor("6-homa-no-expiry"));
    assert.notEqual(key, keyFor("6"), "An unsalted key would reuse a template whose snapshot still expires.");
  } finally {
    if (previousProject === undefined) delete process.env.VERCEL_PROJECT_ID;
    else process.env.VERCEL_PROJECT_ID = previousProject;
  }
});

test("a dropped template logs the error that dropped it", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...parts) => { logged.push(parts.join(" ")); };
  const deleted = [];
  const template = {
    ...fakeTemplateSandbox("eve-sbx-tpl-vercel-guard", []),
    status: "stopped",
    currentSnapshotId: "snap_gone",
    async delete() { deleted.push("template"); },
  };
  const gone = Object.assign(new Error("Snapshot is no longer available"), { response: { status: 410 } });
  const backend = createVercelSandbox({
    loadSandboxModule: async () => ({
      Sandbox: {
        get: async ({ name }) => {
          if (name === template.name) return template;
          throw missing();
        },
      },
    }),
    createSandbox: async () => { throw gone; },
    createOptions: { networkPolicy: "deny-all" },
  });
  try {
    await assert.rejects(
      backend.create({ templateKey: template.name, sessionKey: "session-guard" }),
      /is not provisioned/u,
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(deleted, ["template"]);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /eve-sbx-tpl-vercel-guard/u);
  assert.match(logged[0], /Snapshot is no longer available/u);
});
