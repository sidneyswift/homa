#!/usr/bin/env node
/**
 * Regression guard for the onboarding dead-end incident in issue #315.
 *
 * Eve's empty-delivery sentinel is intentional after a tool or card has
 * already done the turn's work. It is never a valid terminal response to a
 * fresh parent message by itself. The patched harness routes that second case
 * through Eve's existing one-time empty-response recovery instead of accepting
 * a successful turn with no visible message and no action.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === "--package-root"),
  "Usage: node scripts/eve-empty-delivery-guard-check.mjs [--package-root <extracted-eve>]");
const eveRoot = args.length ? path.resolve(args[1]) : path.dirname(webRequire.resolve("eve/package.json"));
const metadata = JSON.parse(await readFile(path.join(eveRoot, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.ok(["0.19.0", "0.54.3"].includes(metadata.version), "Review the empty-delivery guard for this Eve version");
const guardPath = path.join(
  eveRoot,
  "dist/src/harness/empty-delivery-guard.js",
);
const toolLoopPath = path.join(eveRoot, "dist/src/harness/tool-loop.js");
const patchPath = path.join(repoRoot, `patches/eve@${metadata.version}.patch`);
const SENTINEL = "<eve-empty-delivery/>";

function result(text, toolCalls = []) {
  return {
    response: { messages: [{ role: "assistant", content: text }] },
    text,
    toolCalls,
    toolResults: [],
  };
}

const parentMessage = { role: "user", content: "Mia's card is saved." };
const cardCall = {
  role: "assistant",
  content: [
    {
      type: "tool-call",
      toolCallId: "card-1",
      toolName: "ask_for_details",
      input: { kind: "child" },
    },
  ],
};
const cardResult = {
  role: "tool",
  content: [
    {
      type: "tool-result",
      toolCallId: "card-1",
      toolName: "ask_for_details",
      output: { type: "json", value: { asked: true } },
    },
  ],
};

async function assertGuardBehavior() {
  const { isUnbackedEmptyDelivery, turnHasActionAfterLastUser } =
    await import(guardPath);

  assert.equal(turnHasActionAfterLastUser([parentMessage]), false);
  assert.equal(
    isUnbackedEmptyDelivery(result(SENTINEL), [parentMessage]),
    true,
    "a sentinel-only reply to a fresh parent message must be retried",
  );

  const cardTurn = [parentMessage, cardCall, cardResult];
  assert.equal(turnHasActionAfterLastUser(cardTurn), true);
  assert.equal(
    isUnbackedEmptyDelivery(result(SENTINEL), cardTurn),
    false,
    "silence remains valid after the current turn produced a card",
  );

  const nextTurn = [
    parentMessage,
    cardCall,
    cardResult,
    { role: "user", content: "Mia, born April 12, 2019." },
  ];
  assert.equal(
    isUnbackedEmptyDelivery(result(SENTINEL), nextTurn),
    true,
    "an action in the previous turn must not authorize silence now",
  );
  assert.equal(
    isUnbackedEmptyDelivery(result("Mia sounds wonderful."), nextTurn),
    false,
  );
  assert.equal(
    isUnbackedEmptyDelivery(
      result(SENTINEL, [{ toolName: "remember", toolCallId: "remember-1" }]),
      nextTurn,
    ),
    false,
    "a current model step with a tool call is not sentinel-only",
  );
}

async function assertInstalledHarnessUsesGuard() {
  const source = await readFile(toolLoopPath, "utf8");
  assert.match(source, /empty-delivery-guard\.js/u);
  assert.equal(
    source.match(metadata.version === "0.19.0"
      ? /isUnbackedEmptyDelivery\([pe],o\)/gu
      : /isUnbackedEmptyDelivery\([fn],o\)/gu)?.length,
    2,
    "streaming and generated model calls must both enforce the guard",
  );
}

async function assertPatchKeepsGuard() {
  const patch = await readFile(patchPath, "utf8");
  assert.match(patch, /empty-delivery-guard\.js/u);
  assert.match(patch, /turnHasActionAfterLastUser/u);
  assert.match(patch, /isUnbackedEmptyDelivery/u);
}

async function assertCandidateHarnessRecovery() {
  const directory = await mkdtemp(path.join(tmpdir(), "eve-empty-harness-"));
  const receipt = path.join(directory, "result.json");
  try {
    await promisify(execFile)(process.execPath, [
      path.join(repoRoot, "scripts/eve-empty-delivery-harness-probe.mjs"), eveRoot, receipt,
    ], { timeout: 25_000, maxBuffer: 1024 * 1024 });
    const result = JSON.parse(await readFile(receipt, "utf8"));
    assert.equal(result.passed, true);
    assert.equal(result.networkRequests, 0);
    assert.equal(result.checks.length, 10);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const checks = [
  ["guard distinguishes action-backed silence", assertGuardBehavior],
  ["installed Eve harness calls the guard", assertInstalledHarnessUsesGuard],
  ["Eve patch keeps the guard", assertPatchKeepsGuard],
  ...(metadata.version === "0.54.3"
    ? [["actual candidate harness retries once in stream and generate modes", assertCandidateHarnessRecovery]]
    : []),
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok  - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`fail - ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

if (failed > 0) process.exit(1);
console.log(`eve-empty-delivery-guard-check: ${checks.length} checks passed`);
