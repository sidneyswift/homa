import assert from "node:assert/strict";
import { test } from "node:test";

import { emitStreamContent } from "../node_modules/eve/dist/src/harness/emission.js";
import type { HandleMessageStreamEvent } from "eve/client";
import type { ConversationContentEvent } from "./conversation-recording";
import { projectConversationText } from "./conversation-source-projection";

test("actual Eve text-tool-text stream preserves separate equal segments without double counting", async () => {
  const events: HandleMessageStreamEvent[] = [];
  async function* provider() {
    yield { type: "text-delta", id: "a", text: "yes " };
    yield { type: "tool-call", toolCallId: "lookup", toolName: "lookup", input: {}, providerExecuted: true };
    yield { type: "text-delta", id: "b", text: "yes " };
  }
  await emitStreamContent(async event => { events.push(event); }, {
    sessionStarted: true, turnId: "turn_0", sequence: 0, stepIndex: 0,
  }, provider() as Parameters<typeof emitStreamContent>[2]);
  assert.equal(projectConversationText(events.filter((event): event is Extract<HandleMessageStreamEvent, { type: ConversationContentEvent["type"] }> =>
    ["message.received", "message.appended", "message.completed"].includes(event.type))), "yes yes ");
});
test("partial output and completed corrections survive without accumulating duplicate text", () => {
  const identity = { turnId: "t", sequence: 0, stepIndex: 0 };
  const events: ConversationContentEvent[] = [{ type: "message.appended", data: { ...identity, messageDelta: "Hel", messageSoFar: "Hel" } }];
  assert.equal(projectConversationText(events), "Hel");
  events.push({ type: "message.completed", data: { ...identity, message: "Hello", finishReason: "stop" } });
  assert.equal(projectConversationText(events), "Hello");
  assert.throws(() => projectConversationText([{ type: "message.appended", data: { ...identity, messageDelta: "lo", messageSoFar: "Hello" } }]), /Incomplete/);
});

test("absent snapshots preserve partial words while explicit corrections can erase them", () => {
  const identity = { turnId: "t", sequence: 0, stepIndex: 0 };
  const partial: ConversationContentEvent = { type: "message.appended", data: { ...identity, messageDelta: "Hel", messageSoFar: "Hel" } };
  assert.equal(projectConversationText([partial, { type: "message.completed", data: { ...identity, message: null, finishReason: "error" } }]), "Hel");
  assert.equal(projectConversationText([partial, { type: "message.completed", data: { ...identity, message: "", finishReason: "stop" } }]), "");
  assert.throws(() => projectConversationText([partial, { type: "message.appended", data: { ...identity, messageDelta: "lo", messageSoFar: "Byelo" } }]), /Conflicting/);
});
