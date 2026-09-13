#!/usr/bin/env node
/** Real paused-question regression. This changes local dependencies and calls
 * Homa's configured model. --preflight only inspects configuration. The full
 * procedure and remaining release gates live in the Eve version-bump runbook. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { acceptedUpgradeSession, assertUpgradeReply, parkedUpgradeQuestion, readUpgradeStream,
  upgradeAnswerBody, UPGRADE_QUESTION } from "./eve-upgrade-proof.mjs";
import { assertDependenciesRestored, assertInstalledProfile, existingStoreArguments, installedVersions,
  restoreDependencies, selectDependencies, snapshotDependencies, upgradeProfile } from "./eve-upgrade-install.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webDir = path.join(repoRoot, "apps/web");

function parseArgs(argv) {
  const args = { preflight: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--preflight") {
      assert.equal(args.preflight, false, "Duplicate --preflight");
      args.preflight = true;
    } else if (key === "--from" || key === "--to" || key === "--port") {
      assert.ok(argv[i + 1] && !argv[i + 1].startsWith("--"), `Missing value for ${key}`);
      assert.equal(args[key.slice(2)], undefined, `Duplicate ${key}`);
      args[key.slice(2)] = argv[++i];
    } else throw new Error(`Unknown argument: ${key}`);
  }
  assert.ok(args.to, "Usage: node scripts/eve-upgrade-check.mjs --to <version> [--from <version>] [--preflight]");
  args.port = args.port === undefined ? 4321 : Number(args.port);
  assert.ok(Number.isInteger(args.port) && args.port >= 1024 && args.port <= 65535, "Invalid local port");
  return args;
}

function command(commandName, args, { cwd = repoRoot, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { cwd, stdio: "inherit", signal });
    let failure;
    child.once("error", error => { failure = error; });
    // Await close even after abort, so restoration cannot race the installer.
    child.once("close", (code, killedBy) => failure || code !== 0
      ? reject(failure ?? new Error(`${commandName} failed (${code ?? killedBy})`)) : resolve());
  });
}

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => probe.close(error => error ? reject(error) : resolve()));
  });
}

function startServer(logPath, port) {
  const log = createWriteStream(logPath, { flags: "wx" });
  const state = { child: undefined, error: undefined };
  state.child = spawn("corepack", ["pnpm", "exec", "eve", "dev", "--no-ui", "--port", String(port), "--logs", "all"],
    { cwd: webDir, stdio: ["ignore", "pipe", "pipe"], detached: true });
  state.child.on("error", error => { state.error = error; });
  state.child.stdout.on("data", chunk => log.write(chunk));
  state.child.stderr.on("data", chunk => log.write(chunk));
  state.closed = new Promise(resolve => {
    log.once("error", error => { state.error = error; resolve(); });
    log.once("finish", resolve);
    state.child.once("close", () => log.end());
  });
  return state;
}

async function stopServer(server) {
  if (!server?.child.pid) return;
  const child = server.child;
  try { process.kill(-child.pid, "SIGKILL"); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
  let timer;
  try {
    await Promise.race([server.closed, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Owned Eve server or its log did not close")), 5_000);
    })]);
    if (server.error) throw server.error;
  } finally { clearTimeout(timer); }
}

async function waitForHealth(server, signal, baseUrl) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    if (server.error) throw server.error;
    if (server.child.exitCode !== null || server.child.signalCode !== null) throw new Error("Eve exited before becoming healthy");
    try {
      const response = await fetch(`${baseUrl}/eve/v1/health`, { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) });
      if (response.ok) return;
    } catch { signal.throwIfAborted(); }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Eve did not become healthy within 60 seconds");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = `http://127.0.0.1:${args.port}`;
  const manifest = JSON.parse(readFileSync(path.join(webDir, "package.json"), "utf8"));
  const original = installedVersions(repoRoot);
  assert.equal(original.eve, manifest.dependencies.eve, "Installed Eve must match the original pin");
  assert.equal(original.ai, upgradeProfile(original.eve).ai, "Installed AI SDK must match the reviewed original profile");
  assert.ok([original.ai, `^${original.ai}`].includes(manifest.dependencies.ai),
    "Original AI SDK declaration must match the reviewed installed version");
  const from = upgradeProfile(args.from ?? original.eve);
  const to = upgradeProfile(args.to);
  assert.ok(Number(process.versions.node.split(".")[0]) >= Math.max(from.nodeMajor, to.nodeMajor), "Use Node 24 or later");
  assert.notEqual(process.env.VERCEL_ENV, "production", "This is a local upgrade regression, not a production command");
  for (const profile of [from, to]) assert.ok(existsSync(path.join(repoRoot, profile.patch)), `Missing ${profile.patch}`);
  const storeArguments = existingStoreArguments(repoRoot);
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" });
  const plan = { from, to, originalInstalled: original, cleanCheckout: status.trim() === "",
    logicalMessageSubmissions: 2, observationTimeoutMs: 60_000,
    note: "Configuration preflight only. Real execution installs dependencies, starts local servers, and bills model requests; internal model retries may add calls. Full build and hosted latency are separate gates." };
  if (args.preflight) { console.log(JSON.stringify(plan, null, 2)); return; }
  assert.equal(status.trim(), "", "Start from a clean owned checkout; commit or preserve local work first");
  await requireFreePort(args.port);
  const backupDirectory = mkdtempSync(path.join(tmpdir(), "homa-eve-upgrade-"));
  const snapshot = snapshotDependencies(repoRoot, backupDirectory);
  const receipt = { ...plan, startedAt: new Date().toISOString(), checks: {}, restored: false, success: false };
  const controller = new AbortController();
  let server;
  const interrupted = () => {
    controller.abort(new Error("Upgrade regression interrupted"));
    void stopServer(server).catch(() => {});
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  console.log(`Original dependency files and evidence: ${backupDirectory}`);
  async function install(profile) {
    controller.signal.throwIfAborted();
    selectDependencies(repoRoot, snapshot, profile.eve);
    await command("corepack", ["pnpm", "install", "--no-frozen-lockfile", "--ignore-scripts", ...storeArguments], { signal: controller.signal });
    assertInstalledProfile(repoRoot, profile);
    for (const script of ["eve-empty-delivery-guard-check.mjs", "eve-stream-max-duration-check.mjs"]) {
      await command(process.execPath, [path.join(repoRoot, "scripts", script)], { signal: controller.signal });
    }
  }
  try {
    console.log(`Starting Eve ${from.eve} and parking the exact upgrade question...`);
    await install(from);
    server = startServer(path.join(backupDirectory, "from.log"), args.port);
    await waitForHealth(server, controller.signal, baseUrl);
    const response = await fetch(`${baseUrl}/eve/v1/session`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      body: JSON.stringify({ message: `Before doing anything else, call ask_question with prompt "${UPGRADE_QUESTION}" and allowFreeform true, without options. Wait for the answer. Once answered, reply with exactly the supplied probe value and nothing else. Do not call any other tools.` }),
    });
    const { sessionId, continuationToken } = acceptedUpgradeSession({ version: from.eve, response, body: await response.json() });
    const streamUrl = `${baseUrl}/eve/v1/session/${encodeURIComponent(sessionId)}/stream`;
    const parkedEvents = await readUpgradeStream(streamUrl, 60_000);
    controller.signal.throwIfAborted();
    const question = parkedUpgradeQuestion(parkedEvents);
    receipt.sessionId = sessionId;
    receipt.checks.expectedQuestionParked = true;
    const probe = `upgrade-proof:${randomUUID()}`;
    await stopServer(server);
    server = undefined;
    console.log(`Installing Eve ${to.eve} and resuming the same conversation...`);
    await install(to);
    server = startServer(path.join(backupDirectory, "to.log"), args.port);
    await waitForHealth(server, controller.signal, baseUrl);
    const resumed = await fetch(`${baseUrl}/eve/v1/session/${encodeURIComponent(sessionId)}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      body: JSON.stringify(upgradeAnswerBody({ version: to.eve, continuationToken, requestId: question.requestId, probe })),
    });
    acceptedUpgradeSession({ version: to.eve, response: resumed, body: await resumed.json(), expectedSessionId: sessionId });
    receipt.checks.sameSessionAccepted = true;
    const resumedEvents = await readUpgradeStream(streamUrl, 60_000);
    controller.signal.throwIfAborted();
    assertUpgradeReply({ baseline: parkedEvents, resumed: resumedEvents, probe });
    receipt.checks.newTurnRepeatedProbeAndCompleted = true;
    await stopServer(server);
    server = undefined;
    const logs = ["from.log", "to.log"].map(name => readFileSync(path.join(backupDirectory, name), "utf8")).join("\n");
    assert.ok(!/REPLAY_DIVERGENCE|CorruptedEventLogError|CORRUPTED_EVENT_LOG/.test(logs), "Server logs contain replay corruption");
    receipt.checks.noReplayCorruption = true;
    receipt.probe = probe;
  } catch (error) {
    receipt.error = error.message;
    console.error(`Upgrade regression failed: ${error.message}`);
  } finally {
    try {
      await stopServer(server);
      restoreDependencies(repoRoot, snapshot);
      await command("corepack", ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts", ...storeArguments]);
      assertDependenciesRestored(repoRoot, snapshot);
      assert.deepEqual(installedVersions(repoRoot), original);
      receipt.restored = true;
    } catch (error) {
      receipt.restorationError = error.message;
      console.error(`Restoration failed. Original files remain in ${backupDirectory}: ${error.message}`);
    }
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    receipt.finishedAt = new Date().toISOString();
    receipt.interrupted = controller.signal.aborted;
    receipt.success = receipt.restored && !receipt.error && !receipt.interrupted && Object.keys(receipt.checks).length === 4;
    writeFileSync(path.join(backupDirectory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  assert.ok(receipt.success, `Upgrade proof incomplete. Inspect ${backupDirectory}/receipt.json`);
  console.log("Local paused-session regression passed. Full build, deployment gates, and hosted latency verification remain required.");
}

await main().catch(error => { console.error(error.message); process.exitCode = 1; });
