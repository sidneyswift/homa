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
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(path.join(repoRoot, "apps/web/package.json"));
const eveRoot = path.dirname(webRequire.resolve("eve/package.json"));
const guardPath = path.join(
  eveRoot,
  "dist/src/harness/empty-delivery-guard.js",
);
const toolLoopPath = path.join(eveRoot, "dist/src/harness/tool-loop.js");
const patchPath = path.join(repoRoot, "patches/eve@0.19.0.patch");
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
    source.match(/isUnbackedEmptyDelivery\([pe],o\)/gu)?.length,
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

const checks = [
  ["guard distinguishes action-backed silence", assertGuardBehavior],
  ["installed Eve harness calls the guard", assertInstalledHarnessUsesGuard],
  ["Eve patch keeps the guard", assertPatchKeepsGuard],
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
