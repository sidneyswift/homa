import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  transcriptFromRealtimeMessages,
  voiceTurns,
} from "./voice-transcript";

const text = (t: string) => ({ type: "text", text: t });

describe("transcriptFromRealtimeMessages", () => {
  it("reads both voices in snapshot order", () => {
    const out = transcriptFromRealtimeMessages([
      { role: "assistant", parts: [text("Hi, what are we working on?")] },
      { role: "user", parts: [text("Reading with Ruby.")] },
    ]);
    assert.deepEqual(out, [
      { role: "assistant", text: "Hi, what are we working on?" },
      { role: "user", text: "Reading with Ruby." },
    ]);
  });

  it("joins the deltas a streamed turn arrives in", () => {
    const out = transcriptFromRealtimeMessages([
      { role: "assistant", parts: [text("Let me "), text("look at that.")] },
    ]);
    assert.deepEqual(out, [{ role: "assistant", text: "Let me look at that." }]);
  });

  // Rendering these as empty rows makes the transcript flicker with blanks
  // while Homa is thinking or running a tool.
  it("drops a turn that has no words yet", () => {
    const out = transcriptFromRealtimeMessages([
      { role: "assistant", parts: [] },
      { role: "assistant", parts: [{ type: "tool-call", toolName: "recall" }] },
      { role: "user", parts: [text("There we go.")] },
    ]);
    assert.deepEqual(out, [{ role: "user", text: "There we go." }]);
  });

  it("ignores anything that is not one of the two voices", () => {
    const out = transcriptFromRealtimeMessages([
      { role: "system", parts: [text("internal")] },
      { role: "assistant", parts: [text("Only this.")] },
    ]);
    assert.deepEqual(out, [{ role: "assistant", text: "Only this." }]);
  });

  it("survives a message shape it has never seen", () => {
    assert.deepEqual(transcriptFromRealtimeMessages([null, 7, {}, { role: "user" }]), []);
  });
});

describe("voiceTurns", () => {
  it("keeps a turn that has no words yet, in place", () => {
    const out = voiceTurns([
      { id: "u1", role: "user", parts: [] },
      { id: "a1", role: "assistant", parts: [text("Go on.")] },
    ]);
    assert.deepEqual(out, [
      { id: "u1", role: "user", text: "" },
      { id: "a1", role: "assistant", text: "Go on." },
    ]);
  });

  it("falls back to a positional id when the store gives none", () => {
    const out = voiceTurns([{ role: "user", parts: [text("no id")] }]);
    assert.equal(out[0].id, "turn-0");
  });
});
