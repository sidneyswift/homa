import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { after, before, it } from "node:test";
import { getMapItem, personalizeStatement } from "@homa/core";

import { bindProgressCheckInAfterSuccessfulDelivery } from "./delivery-binding";
import type { ProgressCheckInRecord } from "./types";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild") as {
  build(options: unknown): Promise<{outputFiles: Array<{text: string}>}>;
};
const calls: Array<{name: string; input: Record<string, unknown>}> = [];
let canonical = true;
const previousFlag = process.env.HOMA_LIVE_PROGRESS_ENABLED;
process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
after(() => {if (previousFlag === undefined) delete process.env.HOMA_LIVE_PROGRESS_ENABLED; else process.env.HOMA_LIVE_PROGRESS_ENABLED = previousFlag;});
const statement = personalizeStatement("Maya", getMapItem("math.counts-to-5")!.item);
const persistedMessages = new Map<string, string>();
let bound = 0;
let lastBinding: unknown;
const checkIn: ProgressCheckInRecord = {
  id: "check-in", familyId: "family", childId: "child", childName: "Maya", purpose: "subject_deep_dive", scope: {subjectIds: ["math"]},
  state: "active", ownerMemberUserId: "adult", recipientMemberUserId: "adult", ownerDisplayName: null, recipientDisplayName: null,
  revision: 1, currentItemId: "math.counts-to-5", currentDeliveryId: null, episodeId: "owned-episode",
  pendingRuntimeSessionId: "exact-runtime", pendingTurnId: "exact-turn", pauseReason: null,
  openedAt: "2026-09-06T12:00:00Z", updatedAt: "2026-09-06T12:00:00Z", pausedAt: null, stoppedAt: null, completedAt: null,
};
const fixture = {
  async persistCanonicalMessage(input: Record<string, unknown>) {calls.push({name: "persist", input}); if (!canonical) return null;
    const content = String(input.content).trim().slice(0, 8000);
    persistedMessages.set("canonical-message", content); return {id: "canonical-message", episodeId: "owned-episode", content};},
  async recordReactiveDelivery(input: Record<string, unknown>) {calls.push({name: "delivery", input});
    assert.equal(input.content, persistedMessages.get(String(input.messageId)));
    return {attempt: {id: "owned-delivery", familyId: "family", memberUserId: "adult", episodeId: "owned-episode", channel: "web", messageId: input.messageId}, deliveryOutcome: "sent"};},
  async bindDeliveredProgressCheckIn(input: Parameters<typeof bindProgressCheckInAfterSuccessfulDelivery>[0]) {
    calls.push({name: "bind", input: input as unknown as Record<string, unknown>});
    if (input.requireExactStatement) assert.equal(input.deliveredContent, persistedMessages.get(input.attempt.messageId));
    lastBinding = await bindProgressCheckInAfterSuccessfulDelivery(input, {
      listFamilyCheckIns: async () => [checkIn],
      bindDelivery: async () => {bound += 1; return {status: "bound", checkIn};},
      pauseUndeliveredPrompt: async () => {throw new Error("Completed screen text cannot pause a delivery");},
      openReplyLoop: async () => {},
    });
    return lastBinding;
  },
  async openReplyLoop(input: Record<string, unknown>) {calls.push({name: "generic-loop", input});},
};
let completed: (event: unknown, context: unknown) => Promise<void>;
before(async () => {
  const built = await esbuild.build({
    entryPoints: [fileURLToPath(new URL("../../agent/hooks/continuity-web-delivery.ts", import.meta.url))],
    bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{name: "owned-delivery-effects", setup(build: {
      onResolve(options: {filter: RegExp}, callback: (args: {path: string}) => unknown): void;
      onLoad(options: {filter: RegExp; namespace: string}, callback: (args: {path: string}) => unknown): void;
    }) {
      build.onResolve({filter: /^(eve\/hooks)$|\/(delivery-binding\.server|delivery-ledger|ledger)$/}, args => ({path: args.path, namespace: "effects"}));
      build.onLoad({filter: /.*/, namespace: "effects"}, args => ({contents: args.path === "eve/hooks" ? "export const defineHook = value => value;" :
        "export const {persistCanonicalMessage, recordReactiveDelivery, bindDeliveredProgressCheckIn, openReplyLoop} = globalThis.__ownedScreenDelivery;", loader: "js"}));
    }}],
  });
  (globalThis as unknown as Record<string, unknown>).__ownedScreenDelivery = fixture;
  const imported = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
  completed = imported.default.events["message.completed"];
  delete (globalThis as unknown as Record<string, unknown>).__ownedScreenDelivery;
});
const event = {data: {finishReason: "stop", message: statement, sequence: 8, turnId: "exact-turn"}};
const session = (attributes: Record<string, string>, parent: unknown = undefined) => ({session: {id: "exact-runtime", auth: {current: {attributes}}, parent}});

it("actual native text hook uses canonical owned message, recipient and exact runtime turn for binding", async () => {
  for (const channel of ["web", "mobile"]) {
    calls.length = 0; canonical = true; bound = 0;
    const attributes = {channel, familyId: "family", memberUserId: "adult"};
    await completed(event, session(attributes));
    assert.deepEqual(calls.map(row => row.name), ["persist", "delivery", "bind"]);
    assert.deepEqual(calls[0].input, {attributes, sessionId: "exact-runtime", channel: "web", sequence: 8,
      role: "assistant", content: event.data.message, turnId: "exact-turn", terminal: true});
    assert.equal(calls[1].input.familyId, "family");
    assert.equal(calls[1].input.memberUserId, "adult");
    assert.equal(calls[1].input.messageId, "canonical-message");
    assert.equal(calls[1].input.channel, "web");
    assert.deepEqual(calls[2].input, {attempt: {id: "owned-delivery", familyId: "family", memberUserId: "adult", episodeId: "owned-episode", channel: "web", messageId: "canonical-message"},
      deliveryOutcome: "sent", runtimeSessionId: "exact-runtime", turnId: "exact-turn",
      ...(channel === "mobile" ? {deliveredContent: statement, requireExactStatement: true} : {})});
    assert.equal(bound, 1);
  }
});

it("native canonical prose must contain the exact selected question before the real binder opens it", async () => {
  for (const message of ["Ready when you are.", statement.split(" ").reverse().join(" "), statement.replace("Maya", "Another child"), "word ".repeat(1600) + statement]) {
    calls.length = 0; canonical = true; bound = 0;
    await completed({data: {...event.data, message}}, session({channel: "mobile", familyId: "family", memberUserId: "adult"}));
    assert.equal(persistedMessages.get("canonical-message"), message.trim().slice(0, 8000));
    assert.equal(bound, 0);
    assert.deepEqual(lastBinding, {status: "no_unique_prompt"});
  }
  bound = 0;
  await completed({data: {...event.data, message: "Choose an answer on the card."}}, session({channel: "web", familyId: "family", memberUserId: "adult"}));
  assert.equal(bound, 1, "browser card proof remains sufficient without repeated prose");
});

it("actual hook never binds a partial, empty, parented or unauthenticated message", async () => {
  const own = {channel: "mobile", familyId: "family", memberUserId: "adult"};
  for (const [incoming, context] of [
    [{data: {...event.data, finishReason: "length"}}, session(own)],
    [{data: {...event.data, message: " "}}, session(own)],
    [event, session({...own, familyId: ""})],
    [event, session({...own, memberUserId: ""})],
    [event, session({...own, channel: "voice"})],
    [event, session({...own, voiceBridge: "true"})],
    [event, session(own, {sessionId: "parent-session"})],
  ]) {
    calls.length = 0; canonical = true;
    await completed(incoming, context);
    assert.deepEqual(calls, []);
  }
  calls.length = 0; canonical = false;
  await completed(event, session(own));
  assert.deepEqual(calls.map(row => row.name), ["persist"]);
});
