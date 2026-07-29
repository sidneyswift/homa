import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  transcriptAsChatMessage,
  transcriptFromRealtimeMessages,
} from "./voice-transcript";

const text = (t: string) => ({ type: "text", text: t });

describe("transcriptFromRealtimeMessages", () => {
  it("reads both voices in the order they were spoken", () => {
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

describe("transcriptAsChatMessage", () => {
  it("labels who said what", () => {
    const out = transcriptAsChatMessage([
      { role: "assistant", text: "What are we doing today?" },
      { role: "user", text: "Math, then a walk." },
    ]);
    assert.match(out ?? "", /Homa: What are we doing today\?/);
    assert.match(out ?? "", /Me: Math, then a walk\./);
  });

  it("says plainly that this was spoken, not typed", () => {
    const out = transcriptAsChatMessage([{ role: "user", text: "Hi." }]);
    assert.match(out ?? "", /what we said out loud/);
  });

  // A session opened and closed without a word should leave no trace at
  // all, rather than an empty note she has to wonder about.
  it("returns nothing when nothing was said", () => {
    assert.equal(transcriptAsChatMessage([]), null);
  });
});
