import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isVoiceTranscriptionText,
  markVoiceTranscription,
  stripVoiceTranscriptionMarker,
  VOICE_TRANSCRIPTION_MARKER,
} from "./transcription-marker";

describe("voice transcription marker", () => {
  it("marks dictated words once and keeps the marker on retries", () => {
    const marked = markVoiceTranscription("  We finished the maze page.  ");
    assert.equal(
      marked,
      `${VOICE_TRANSCRIPTION_MARKER}: We finished the maze page.`,
    );
    assert.equal(markVoiceTranscription(marked), marked);
  });

  it("finds an exact marker in a later queued paragraph", () => {
    const text = [
      "I typed this part.",
      "",
      `${VOICE_TRANSCRIPTION_MARKER}: Then I said this part.`,
    ].join("\n");
    assert.equal(isVoiceTranscriptionText(text), true);
    assert.equal(isVoiceTranscriptionText("I said voice note, transcribed"), false);
  });

  it("strips only the exact render prefix and preserves the transcript", () => {
    assert.equal(
      stripVoiceTranscriptionMarker(
        `${VOICE_TRANSCRIPTION_MARKER}: Maya read nine pages.`,
      ),
      "Maya read nine pages.",
    );
    assert.equal(
      stripVoiceTranscriptionMarker("[Voice note]: Maya read nine pages."),
      "[Voice note]: Maya read nine pages.",
    );
  });
});
