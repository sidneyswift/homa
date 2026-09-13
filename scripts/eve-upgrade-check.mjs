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
 * and resumes the same session using the candidate's HTTP protocol. Fails if the resume
 * response names a different session, the original session never receives
 * the answer, or the server log shows a replay divergence or corrupted
 * event log.
 *
 * This check mutates apps/web/package.json, pnpm-lock.yaml, and installed
 * dependencies while it runs, starts local servers, and calls the configured
 * model through AI Gateway. Start from a clean tree. If interrupted, restore
 * the original pin and lockfile, then run pnpm install. The candidate install
 * does not port the version-specific patch in pnpm-workspace.yaml.
 *
 * Usage:
 *   node scripts/eve-upgrade-check.mjs --to 0.20.0            (from = current pin)
 *   node scripts/eve-upgrade-check.mjs --from 0.19.0 --to 0.20.0
 *
 * Exit code 0 = this local regression passed. Exit code 1 = regression failure.
 * Exit code 2 = invalid or missing arguments. Patch review, parked-session
 * inventory, and an authenticated production smoke remain separate gates.
 */

import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { assertUpgradeReply, parkedUpgradeQuestion, readUpgradeStream, upgradeAnswerBody, usesSessionHandles, UPGRADE_QUESTION } from "./eve-upgrade-proof.mjs";

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

function logLineContains(needle) {
  if (!existsSync(logPath)) return false;
  return readFileSync(logPath, "utf8").includes(needle);
}

async function main() {
  const { from: fromArg, to } = parseArgs();
  const originalPin = readPinnedEveVersion();
  const from = fromArg ?? originalPin;
  usesSessionHandles(from);
  usesSessionHandles(to);
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
          `Before doing anything else, call ask_question with prompt "${UPGRADE_QUESTION}" and allowFreeform true, without options. Wait for the answer. Once answered, reply with exactly the supplied probe value and nothing else. Do not call any other tools.`,
      }),
    });
    const startBody = await startRes.json();
    if (!startRes.ok || !startBody.ok) throw new Error("Session start failed.");
    const { sessionId, continuationToken } = startBody;
    if (typeof sessionId !== "string" || !sessionId ||
      (!usesSessionHandles(from) && (typeof continuationToken !== "string" || !continuationToken))) {
      throw new Error("Session start did not return the identity required by its protocol.");
    }

    const parkedEvents = await readUpgradeStream(`${baseUrl}/eve/v1/session/${sessionId}/stream`, 15000);
    const question = parkedUpgradeQuestion(parkedEvents);
    report("the expected question is pending on the from-version", true);
    // Generated only after parking, so old history cannot contain a valid reply.
    const probe = `upgrade-proof:${randomUUID()}`;

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
      body: JSON.stringify(upgradeAnswerBody({ version: to, continuationToken, requestId: question.requestId, probe })),
    });
    const resumeBody = await resumeRes.json();

    report(
      "resume response names the same session",
      resumeRes.ok && resumeBody.ok === true && resumeBody.sessionId === sessionId,
      "The resume response must preserve the original session ID.",
    );
    if (!resumeRes.ok || resumeBody.ok !== true || resumeBody.sessionId !== sessionId) {
      throw new Error("Resume did not preserve the original session; aborting.");
    }

    console.log("\n[4/4] verifying the original session actually processed the answer...");
    const resumedEvents = await readUpgradeStream(`${baseUrl}/eve/v1/session/${sessionId}/stream`, 15000);
    assertUpgradeReply({ baseline: parkedEvents, resumed: resumedEvents, probe });
    report("the original session repeats the supplied probe and completes its new turn", true);

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
