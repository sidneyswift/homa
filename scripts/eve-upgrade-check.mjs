#!/usr/bin/env node
/**
 * eve upgrade regression check (automated M0-01 test (a)).
 *
 * Exists because eve 0.18.2 -> 0.19.0 corrupted a session parked in HITL on
 * resume, and the resume API returned ok:true with a DIFFERENT sessionId
 * instead of erroring instead of resuming or failing loudly
 * (docs/homa-planning/eve-churn-log.md, 2026-07-04). Run this against any
 * candidate eve version BEFORE changing the pin in apps/web/package.json.
 * Per docs/homa-planning/runbooks/eve-version-bump.md, a version bump is not
 * safe to ship until this passes.
 *
 * What it does: starts eve at --from, parks a session in HITL via the
 * built-in ask_question tool, stops the server, installs --to, restarts,
 * and resumes with the saved continuation token. Fails loudly if the resume
 * response names a different session, the original session never receives
 * the answer, or the server log shows a replay divergence or corrupted
 * event log.
 *
 * Usage:
 *   node scripts/eve-upgrade-check.mjs --to 0.20.0            (from = current pin)
 *   node scripts/eve-upgrade-check.mjs --from 0.19.0 --to 0.20.0
 *
 * Exit code 0 = safe to bump the pin. Exit code 1 = do not, read the report.
 */

import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webPackageJsonPath = path.join(repoRoot, "apps/web/package.json");
const webDir = path.join(repoRoot, "apps/web");
const port = 4321; // scratch port, distinct from any dev server
const baseUrl = `http://127.0.0.1:${port}`;
const logPath = path.join(repoRoot, ".eve-upgrade-check.log");

function parseArgs() {
  const args = { from: undefined, to: undefined };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from") args.from = argv[++i];
    if (argv[i] === "--to") args.to = argv[++i];
  }
  if (!args.to) {
    console.error("Usage: node scripts/eve-upgrade-check.mjs [--from <version>] --to <version>");
    process.exit(2);
  }
  return args;
}

function readPinnedEveVersion() {
  const pkg = JSON.parse(readFileSync(webPackageJsonPath, "utf8"));
  return pkg.dependencies.eve;
}

function setEveVersion(version) {
  const raw = readFileSync(webPackageJsonPath, "utf8");
  const updated = raw.replace(/"eve":\s*"[^"]+"/, `"eve": "${version}"`);
  writeFileSync(webPackageJsonPath, updated);
  execFileSync("pnpm", ["install"], { cwd: repoRoot, stdio: "inherit" });
}

async function waitForHealth(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/eve/v1/health`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startServer() {
  writeFileSync(logPath, "");
  const log = createWriteStream(logPath, { flags: "a" });
  const child = spawn(
    "npx",
    ["eve", "dev", "--no-ui", "--port", String(port), "--logs", "all"],
    { cwd: webDir, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  child.stdout.on("data", (chunk) => log.write(chunk));
  child.stderr.on("data", (chunk) => log.write(chunk));
  return child;
}

function stopServer(child) {
  if (!child) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // already dead
  }
}

async function readNdjson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events = [];
  try {
    const res = await fetch(url, { signal: controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    }
  } catch {
    // timeout is expected; the stream stays open waiting for more
  } finally {
    clearTimeout(timer);
  }
  return events;
}

function logLineContains(needle) {
  if (!existsSync(logPath)) return false;
  return readFileSync(logPath, "utf8").includes(needle);
}

async function main() {
  const { from: fromArg, to } = parseArgs();
  const originalPin = readPinnedEveVersion();
  const from = fromArg ?? originalPin;
  const failures = [];
  let server;

  function report(label, ok, detail) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail ?? ""})`}`);
    if (!ok) failures.push(label);
  }

  try {
    console.log(`eve upgrade check: ${from} -> ${to}\n`);

    console.log(`[1/4] starting eve ${from} and parking a session in HITL...`);
    setEveVersion(from);
    server = startServer();
    if (!(await waitForHealth(20000))) throw new Error(`eve ${from} did not become healthy`);

    const startRes = await fetch(`${baseUrl}/eve/v1/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message:
          'Before doing anything else, call the ask_question tool with prompt "What is 2+2?" and options ["3","4","5"], allowFreeform false. Do not answer it yourself.',
      }),
    });
    const startBody = await startRes.json();
    if (!startBody.ok) throw new Error(`session start failed: ${JSON.stringify(startBody)}`);
    const { sessionId, continuationToken } = startBody;

    const parkedEvents = await readNdjson(`${baseUrl}/eve/v1/session/${sessionId}/stream`, 15000);
    const parked = parkedEvents.some((e) => e.type === "session.waiting");
    report("session parks in HITL on the from-version", parked);
    if (!parked) throw new Error("could not establish a parked baseline; aborting");

    console.log(`\n[2/4] stopping eve ${from}, installing eve ${to}...`);
    stopServer(server);
    server = undefined;
    setEveVersion(to);

    console.log(`[3/4] starting eve ${to} and resuming the parked session...`);
    server = startServer();
    if (!(await waitForHealth(20000))) throw new Error(`eve ${to} did not become healthy`);

    const resumeRes = await fetch(`${baseUrl}/eve/v1/session/${sessionId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ continuationToken, message: "4" }),
    });
    const resumeBody = await resumeRes.json();

    report(
      "resume response names the same session",
      resumeBody.ok === true && resumeBody.sessionId === sessionId,
      `expected ${sessionId}, got ${JSON.stringify(resumeBody)}`,
    );

    console.log("\n[4/4] verifying the original session actually processed the answer...");
    const resumedEvents = await readNdjson(`${baseUrl}/eve/v1/session/${sessionId}/stream`, 15000);
    const sawSecondTurn = resumedEvents.some((e) => e.type === "turn.started" && e.data?.turnId !== "turn_0");
    const sawFailure = resumedEvents.some((e) => e.type === "turn.failed" || e.type === "session.failed");
    report("the original session shows a second turn (the answer was processed)", sawSecondTurn && !sawFailure);

    report(
      "no replay divergence or corrupted event log in server logs",
      !logLineContains("REPLAY_DIVERGENCE") && !logLineContains("CorruptedEventLogError") && !logLineContains("CORRUPTED_EVENT_LOG"),
    );
  } catch (error) {
    console.error(`\nAborted: ${error.message}`);
    failures.push("script aborted before completing all checks");
  } finally {
    stopServer(server);
    console.log(`\nRestoring pinned eve version to ${originalPin}...`);
    setEveVersion(originalPin);
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) FAILED. Do not bump the eve pin to ${to} yet.`);
    console.error(`Server log kept for inspection: ${logPath}`);
    process.exit(1);
  }
  if (existsSync(logPath)) unlinkSync(logPath);
  console.log(`\nAll checks passed. Safe to bump the eve pin to ${to} (per this test alone; still review the changelog).`);
}

await main();
