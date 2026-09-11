import assert from "node:assert/strict";
import test from "node:test";
import { VoiceResultHandoff, voiceHandoffNotice } from "./voice-result-handoff";

const context = { sessionId: "first-call", sourceSequence: 0 };

test("a delayed result reaches an already active replacement call exactly once", () => {
  const handoff = new VoiceResultHandoff();
  const spoken: string[] = [];
  handoff.attach(1, () => assert.fail("closed call"));
  handoff.attach(2, (text) => spoken.push(text));
  handoff.detach(1);
  handoff.complete(1, context, { ok: true, spokenReply: "Your worksheet is ready.", effects: [] });
  handoff.complete(1, context, { ok: true, spokenReply: "Your worksheet is ready.", effects: [] });
  assert.deepEqual(spoken, ["There is an update from your earlier request in our chat."]);
});

test("the originating call speaks for itself and ended calls never receive queued speech", () => {
  const handoff = new VoiceResultHandoff();
  handoff.attach(1, () => assert.fail("duplicate announcement"));
  handoff.complete(1, context, { ok: true, spokenReply: "Ready.", effects: [] });
  handoff.detach(1);
  const later = { ...context, sourceSequence: 2 };
  handoff.complete(1, later, { ok: true, spokenReply: "Finished while voice was off.", effects: [] });
  handoff.attach(2, () => assert.fail("unexpected historical replay"));
  handoff.complete(1, later, { ok: true, spokenReply: "Finished while voice was off.", effects: [] });
});

test("handoff announces only a verified printable and never asks an old question", () => {
  const printable = { ok: true, spokenReply: "Would you like another?", effects: [
    { callId: "material", toolName: "create_printable", output: { created: true, material: {
      id: "one", title: "Letter S", status: "final", reviewPassed: true,
      previewUrl: "https://example.test/preview.png", pdfUrl: "https://example.test/file.pdf",
    } } },
  ] };
  assert.equal(voiceHandoffNotice(printable), "Your printable is ready. You can open it in our chat.");
  assert.equal(voiceHandoffNotice({ ok: true, spokenReply: "Which child is this for?", effects: [] }),
    "There is an update from your earlier request in our chat.");
  assert.equal(voiceHandoffNotice({ ...printable, ok: false }),
    "There is an update from your earlier request in our chat.");
  for (const state of [
    { status: "draft", reviewPassed: true },
    { status: "final", reviewPassed: false },
    { status: "final", reviewPassed: null },
    { status: "superseded", reviewPassed: true },
  ]) {
    const effect = printable.effects[0];
    const result = { ...printable, effects: [{ ...effect, output: {
      ...effect.output, material: { ...effect.output.material, ...state },
    } }] };
    assert.equal(voiceHandoffNotice(result), "There is an update from your earlier request in our chat.");
  }
});
