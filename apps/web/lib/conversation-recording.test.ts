import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emitStreamContent } from "../node_modules/eve/dist/src/harness/emission.js";
import type { HandleMessageStreamEvent } from "eve/client";

import { recordingContent } from "./conversation-recording";

describe("lossless conversation content identity", () => {
  it("retains every segment from the actual Eve text/tool/text emitter", async () => {
    const events: HandleMessageStreamEvent[] = [];
    async function* provider() {
      yield { type: "text-delta", id: "a", text: "yes " };
      yield { type: "tool-call", toolCallId: "lookup", toolName: "lookup", input: {}, providerExecuted: true };
      yield { type: "text-delta", id: "b", text: "yes " };
    }
    await emitStreamContent(async event => { events.push(event); }, {
      sessionStarted: true, turnId: "turn_0", sequence: 0, stepIndex: 0,
    }, provider() as Parameters<typeof emitStreamContent>[2]);
    const records = events.flatMap((event, index) =>
      event.type === "message.appended" || event.type === "message.completed"
        ? [recordingContent(event, index)] : []);
    assert.equal(records.length, 4);
    assert.equal(new Set(records.map(record => record.key)).size, 4);
    assert.deepEqual(records.map(record => record.content), ["yes ", "yes ", "yes ", "yes "]);
    assert(records.every(record => record.stepIndex === 0));
    assert(records.every(record => record.offset === 0));
  });
  it("keeps repeated equal words while deduplicating the same source fragment", () => {
    const first = { type: "message.appended" as const, data: {
      turnId: "t", sequence: 0, stepIndex: 0, messageDelta: "yes ", messageSoFar: "yes ",
    } };
    const second = { ...first, data: { ...first.data, messageSoFar: "yes yes " } };
    assert.notEqual(recordingContent(first, 0).key, recordingContent(second, 1).key);
    assert.equal(recordingContent(first, 0).key, recordingContent(structuredClone(first), 0).key);
    assert.equal(recordingContent(second, 1).content, "yes ");
    assert.equal(recordingContent(second, 1).offset, 4);
  });
  it("retains exact long Unicode content and corrections without recording the runtime envelope", () => {
    const content = " 🧡\\n".repeat(5000);
    const recorded = recordingContent({ type: "message.completed", data: {
      turnId: "t", sequence: 1, stepIndex: 0, message: content, finishReason: "stop",
    } }, 4);
    assert.equal(recorded.content, content);
    assert.deepEqual(Object.keys(recorded).sort(), ["content", "finishReason", "key", "kind", "offset", "role", "sequence", "snapshotHash", "snapshotPresent", "stepIndex", "turnId"]);
  });
  it("separates messages and steps within a turn and rejects inconsistent source fragments", () => {
    const event = { type: "message.appended" as const, data: {
      turnId: "t", sequence: 1, stepIndex: 0, messageDelta: "Hello", messageSoFar: "Hello",
    } };
    assert.notEqual(recordingContent(event, 4).key, recordingContent({ ...event, data: { ...event.data, stepIndex: 1 } }, 5).key);
    assert.throws(() => recordingContent({ ...event, data: { ...event.data, messageSoFar: "Different" } }, 4), /delta/);
  });
});
