import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyRealtimeTranscriptEvent,
  sourceTurnFromRealtimeEvent,
} from "./realtime-transcript";

describe("applyRealtimeTranscriptEvent", () => {
  it("keeps a tapped question-card answer as the next parent turn", () => {
    const turns = applyRealtimeTranscriptEvent([], {
      type: "conversation.item.created",
      item: {
        id: "item-tap",
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Maya" }],
      },
    });
    assert.deepEqual(turns, [
      { id: "item-tap", role: "user", text: "Maya" },
    ]);
  });

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

describe("sourceTurnFromRealtimeEvent", () => {
  it("claims a fresh empty audio item instead of reusing the prior turn", () => {
    const turns = [
      { id: "old", role: "user" as const, text: "Open the planner" },
      { id: "new", role: "user" as const, text: "" },
    ];
    assert.deepEqual(
      sourceTurnFromRealtimeEvent(
        turns,
        {
          type: "conversation.item.created",
          item: { id: "new", type: "message", role: "user" },
        },
        { text: "Open the planner", sequence: 0 },
      ),
      { text: "", sequence: 1 },
    );
  });

  it("fills the current source when its late transcription arrives", () => {
    const turns = [{ id: "new", role: "user" as const, text: "Make a maze" }];
    assert.deepEqual(
      sourceTurnFromRealtimeEvent(
        turns,
        {
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "new",
        },
        { text: "", sequence: 0 },
      ),
      { text: "Make a maze", sequence: 0 },
    );
  });
});
