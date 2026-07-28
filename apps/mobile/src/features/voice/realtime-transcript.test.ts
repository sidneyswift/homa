import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyRealtimeTranscriptEvent } from "./realtime-transcript";

describe("applyRealtimeTranscriptEvent", () => {
  it("keeps the parent's place when her transcript lands after Homa begins replying", () => {
    const parent = "item-parent";
    const homa = "item-homa";
    let turns = applyRealtimeTranscriptEvent([], {
      type: "conversation.item.created",
      item: { id: parent, type: "message", role: "user" },
    });
    turns = applyRealtimeTranscriptEvent(turns, {
      type: "conversation.item.created",
      item: { id: homa, type: "message", role: "assistant" },
    });
    turns = applyRealtimeTranscriptEvent(turns, {
      type: "response.output_audio_transcript.done",
      item_id: homa,
      transcript: "Absolutely.",
    });
    turns = applyRealtimeTranscriptEvent(turns, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: parent,
      transcript: "Can we make a plan?",
    });

    assert.deepEqual(turns, [
      { id: parent, role: "user", text: "Can we make a plan?" },
      { id: homa, role: "assistant", text: "Absolutely." },
    ]);
  });
});
