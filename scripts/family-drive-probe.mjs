import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { APIError, Drive, Sandbox } = require("@vercel/sandbox");
const { values } = parseArgs({ options: {
  "oidc-env": { type: "string" },
  output: { type: "string" },
  execute: { type: "boolean", default: false },
} });

if (!values.execute || !values.output) {
  throw new Error("Pass --execute --output <receipt.json>. Creates and deletes synthetic test resources only.");
}
if (values["oidc-env"]) {
  const text = readFileSync(values["oidc-env"], "utf8");
  const token = /^VERCEL_OIDC_TOKEN\s*=\s*["']?([^"'\r\n]+)/mu.exec(text)?.[1];
  if (!token) throw new Error("OIDC token missing. Use pnpm dev:token in the linked primary checkout.");
  process.env.VERCEL_OIDC_TOKEN = token;
}
if (!process.env.VERCEL_OIDC_TOKEN) throw new Error("Vercel OIDC is required for this probe.");

const name = `homa-drive-probe-${randomUUID().slice(0, 8)}`;
const receipt = { startedAt: new Date().toISOString(), sdk: require("@vercel/sandbox/package.json").version,
  driveName: name, region: "iad1", checks: {}, cleanup: {}, failures: [] };
const started = Date.now();
let drive;
const sandboxes = new Map();
const names = new Set();
const signal = () => AbortSignal.timeout(60_000);
const errorSummary = (error) => ({ name: error?.name ?? "Error",
  code: error instanceof APIError ? error.json?.error?.code ?? error.json?.code : undefined,
  message: error instanceof APIError ? error.json?.error?.message ?? error.json?.message ?? "Provider request failed" : String(error?.message ?? error) });
const save = () => writeFileSync(values.output, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function create(suffix, mount) {
  const sandboxName = `${name}-${suffix}`;
  names.add(sandboxName);
  const sandbox = await Sandbox.create({ name: sandboxName, region: "iad1", persistent: false,
    timeout: 120_000, resources: { vcpus: 1 }, networkPolicy: "deny-all",
    mounts: { "/data": mount }, signal: signal() });
  sandboxes.set(sandboxName, sandbox);
  return sandbox;
}

try {
  drive = await Drive.getOrCreate({ name, region: "iad1", maxSize: 1024 ** 3, signal: signal() });
  receipt.checks.created = true;
  save();
  const writer = await create("writer", drive);
  const first = Buffer.from("Synthetic curriculum: practice adding two apples and three apples.\n");
  await writer.writeFiles([{ path: "/data/lesson.txt", content: first }], { signal: signal() });
  assert.equal(hash(await writer.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() })), hash(first));
  receipt.checks.writeRead = true;

  try {
    await create("conflict", drive);
    throw new Error("Unexpectedly allowed a second writer");
  } catch (error) {
    const detail = errorSummary(error);
    if (!(error instanceof APIError) || detail.code !== "drive_attached") throw error;
    receipt.checks.secondWriterRejected = detail;
  }

  const liveReader = await create("live", drive.snapshot());
  const liveBytes = await liveReader.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() });
  receipt.checks.liveSnapshotSeesAcknowledgedWrite = liveBytes !== null && hash(liveBytes) === hash(first);
  await liveReader.stop({ signal: signal() });
  await writer.stop({ signal: signal() });
  const reader = await create("reader", drive.snapshot());
  const snapshotBytes = await reader.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() });
  assert.ok(snapshotBytes, "Snapshot after writer stop did not contain the acknowledged write");
  assert.equal(hash(snapshotBytes), hash(first));
  const nextWriter = await create("nextwriter", drive);
  assert.equal(hash(await nextWriter.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() })), hash(first));
  const second = Buffer.from("Synthetic curriculum: revised exercise with five apples.\n");
  await nextWriter.writeFiles([{ path: "/data/lesson.txt", content: second }], { signal: signal() });
  assert.equal(hash(await reader.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() })), hash(first));
  receipt.checks.snapshotPointInTime = true;
  await nextWriter.stop({ signal: signal() });
  const freshReader = await create("fresh", drive.snapshot());
  assert.equal(hash(await freshReader.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() })), hash(second));
  receipt.checks.freshSnapshotAfterStop = true;
  const resumed = await create("next", drive);
  assert.equal(hash(await resumed.readFileToBuffer({ path: "/data/lesson.txt" }, { signal: signal() })), hash(second));
  receipt.checks.crossSandboxPersistence = true;
  console.log("Drive persistence, writer exclusion, and snapshot checks passed.");
} catch (error) {
  receipt.failures.push(errorSummary(error));
  process.exitCode = 1;
} finally {
  for (const sandboxName of names) {
    try {
      const sandbox = sandboxes.get(sandboxName) ?? await Sandbox.get({ name: sandboxName, signal: signal() });
      await sandbox.stop({ signal: signal() });
      await sandbox.delete({ signal: signal() });
      receipt.cleanup[sandboxName] = "deleted";
    } catch (error) {
      const detail = errorSummary(error);
      if (/not_found|notfound|not found/iu.test(`${detail.code} ${detail.message}`)) receipt.cleanup[sandboxName] = "absent";
      else { receipt.cleanup[sandboxName] = detail; process.exitCode = 1; }
    }
  }
  try {
    // Recover an ambiguous successful create by exact unique name, never getOrCreate.
    const listed = await Drive.list({ namePrefix: name, sortBy: "name", signal: signal() });
    const exact = listed.drives.find((entry) => entry.name === name);
    if (exact) await exact.delete({ signal: signal() });
    const after = await Drive.list({ namePrefix: name, sortBy: "name", signal: signal() });
    assert.ok(!after.drives.some((entry) => entry.name === name));
    receipt.cleanup.drive = "verified absent";
  } catch (error) {
    receipt.cleanup.drive = errorSummary(error);
    process.exitCode = 1;
  }
  receipt.durationMs = Date.now() - started;
  save();
  console.log(JSON.stringify(receipt, null, 2));
}
