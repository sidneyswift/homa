import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  settledTurns,
  transcriptFromRealtimeMessages,
  voiceTurns,
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

describe("settledTurns", () => {
  const turn = (role: "assistant" | "user", text: string, id = `${role}-${text}`) => ({
    id,
    role,
    text,
  });
  const line = (role: "assistant" | "user", text: string) => ({ role, text });

  // The last turn is usually still arriving in deltas, so writing it on
  // sight would persist half a sentence.
  it("holds back the turn that is still being spoken", () => {
    const out = settledTurns([turn("assistant", "Hi"), turn("user", "Hel")], 0, false);
    assert.deepEqual(out.lines, [{ sequence: 0, line: line("assistant", "Hi") }]);
    assert.equal(out.cursor, 1);
  });

  it("releases everything once the conversation is over", () => {
    const out = settledTurns([turn("assistant", "Hi"), turn("user", "Hello")], 0, true);
    assert.equal(out.lines.length, 2);
    assert.equal(out.lines[1].sequence, 1);
    assert.equal(out.cursor, 2);
  });

  it("never re-emits what the cursor has already passed", () => {
    const t = [turn("assistant", "a"), turn("user", "b"), turn("assistant", "c")];
    assert.deepEqual(settledTurns(t, 2, false).lines, []);
    assert.deepEqual(settledTurns(t, 2, true).lines, [
      { sequence: 2, line: line("assistant", "c") },
    ]);
  });

  it("numbers turns by position so a retry cannot double a line", () => {
    const t = [turn("user", "a"), turn("assistant", "b"), turn("user", "c")];
    const first = settledTurns(t, 0, true);
    const retry = settledTurns(t, 0, true);
    assert.deepEqual(
      first.lines.map((entry) => entry.sequence),
      [0, 1, 2],
    );
    assert.deepEqual(retry, first);
  });

  it("has nothing to write for a session where nobody spoke", () => {
    assert.deepEqual(settledTurns([], 0, true).lines, []);
    assert.deepEqual(settledTurns([], 0, false).lines, []);
  });

  it("holds back a lone first turn until it settles", () => {
    assert.deepEqual(settledTurns([turn("assistant", "Hi the")], 0, false).lines, []);
  });

  // This is the failure the in-order rule exists for. Speech transcription
  // is asynchronous, so the parent's words can land AFTER Homa has begun
  // answering them. Taking Homa's reply first would put the answer above
  // the question AND spend sequence 0 on it, so when the parent's words
  // finally arrived they would be written as sequence 1: a second copy of
  // Homa's turn, with the parent's own words nowhere in the thread.
  it("waits for a parent turn whose transcription has not landed", () => {
    const pending = [
      turn("user", "", "u1"),
      turn("assistant", "That is a big jump.", "a1"),
      turn("user", "", "u2"),
    ];
    const held = settledTurns(pending, 0, false);
    assert.deepEqual(held.lines, []);
    assert.equal(held.cursor, 0, "the cursor must not step over the blank");

    // The transcription lands. Now both go, in the order they happened.
    const landed = [
      turn("user", "Finn read a whole chapter.", "u1"),
      turn("assistant", "That is a big jump.", "a1"),
      turn("user", "", "u2"),
    ];
    const out = settledTurns(landed, held.cursor, false);
    assert.deepEqual(out.lines, [
      { sequence: 0, line: line("user", "Finn read a whole chapter.") },
      { sequence: 1, line: line("assistant", "That is a big jump.") },
    ]);
    assert.equal(out.cursor, 2);
  });

  it("skips a silent turn once the session is over and words can never come", () => {
    const out = settledTurns(
      [turn("user", "", "u1"), turn("assistant", "Talk to you soon.", "a1")],
      0,
      true,
    );
    assert.deepEqual(out.lines, [
      { sequence: 1, line: line("assistant", "Talk to you soon.") },
    ]);
    assert.equal(out.cursor, 2);
  });
});

describe("voiceTurns", () => {
  // The empty entry is load-bearing: it is what settledTurns waits on.
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
