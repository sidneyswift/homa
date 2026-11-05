import assert from "node:assert/strict";
import test from "node:test";
import type { HandleMessageStreamEvent, SessionState } from "eve/client";

import { readVoiceBridgeStream } from "./bridge-stream";

const reply = { type: "message.completed", data: { message: "Which child is this for?", finishReason: "stop", sequence: 1, stepIndex: 0, turnId: "turn-1" } } as HandleMessageStreamEvent;
const terminal = { type: "session.waiting", data: { wait: "next-user-message" } } as HandleMessageStreamEvent;
const waitForAbort = (signal: AbortSignal) => new Promise<void>((resolve) => {
  if (signal.aborted) resolve();
  else signal.addEventListener("abort", () => resolve(), { once: true });
});

test("a stalled reader reattaches to the same task at the next unread event", async () => {
  const opens: SessionState[] = [];
  const result = await readVoiceBridgeStream({
    state: { sessionId: "existing-task", continuationToken: "continuation", streamIndex: 7 },
    signal: new AbortController().signal,
    idleMs: 5,
    open: async function* (state, signal) {
      opens.push(state);
      if (opens.length === 1) {
        yield reply;
        await waitForAbort(signal);
        throw new DOMException("Aborted", "AbortError");
      }
      yield terminal;
    },
  });
  assert.deepEqual(opens.map(state => [state.sessionId, state.streamIndex]), [["existing-task", 7], ["existing-task", 8]]);
  assert.equal(result.message, "Which child is this for?");
  assert.equal(result.status, "waiting");
  assert.deepEqual(result.events, [reply, terminal]);
  assert.deepEqual(result.sessionState, { sessionId: "existing-task", continuationToken: "continuation", streamIndex: 9 });
});

test("a stream that never delivered its first event can recover durable results", async () => {
  let opens = 0;
  const result = await readVoiceBridgeStream({
    state: { sessionId: "same-task", streamIndex: 0 },
    signal: new AbortController().signal, idleMs: 5,
    open: async function* (state, signal) {
      assert.equal(state.sessionId, "same-task");
      assert.equal(state.streamIndex, 0);
      if (++opens === 1) { await waitForAbort(signal); return; }
      yield reply;
      yield terminal;
    },
  });
  assert.equal(opens, 2);
  assert.equal(result.message, "Which child is this for?");
});

test("overall cancellation cannot turn an incomplete stream into success", async () => {
  const deadline = new AbortController();
  let opens = 0;
  await assert.rejects(readVoiceBridgeStream({
    state: { sessionId: "same-task", streamIndex: 0 }, signal: deadline.signal,
    open: async function* () { opens++; yield reply; deadline.abort(); },
  }));
  assert.equal(opens, 1);
});

test("EOF and authorization failures do not produce success or retry", async () => {
  for (const error of [null, new Error("Unauthorized")]) {
    let opens = 0;
    await assert.rejects(readVoiceBridgeStream({
      state: { sessionId: "same-task", streamIndex: 0 }, signal: new AbortController().signal,
      open: async function* () { opens++; yield reply; if (error) throw error; },
    }));
    assert.equal(opens, 1);
  }
});
