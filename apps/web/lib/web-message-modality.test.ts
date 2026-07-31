import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOMA_MESSAGE_MODALITY_HEADER,
  messageModalityFromRequest,
  messageModalityHeaders,
  voiceTranscriptionContext,
} from "./web-message-modality";

describe("web message modality", () => {
  it("accepts only the closed voice value and defaults every other header to text", () => {
    for (const [value, expected] of [
      ["voice", "voice"],
      ["text", "text"],
      ["VOICE", "text"],
      ["audio", "text"],
    ] as const) {
      const request = new Request("https://example.test/eve", {
        headers: { [HOMA_MESSAGE_MODALITY_HEADER]: value },
      });
      assert.equal(messageModalityFromRequest(request), expected);
    }
    assert.equal(
      messageModalityFromRequest(new Request("https://example.test/eve")),
      "text",
    );
    assert.deepEqual(messageModalityHeaders("voice"), {
      [HOMA_MESSAGE_MODALITY_HEADER]: "voice",
    });
  });

  it("tells Homa that dictated words arrived without claiming saved audio", () => {
    assert.deepEqual(voiceTranscriptionContext("text"), []);
    const context = voiceTranscriptionContext("voice").join("\n");
    assert.match(context, /parent dictated/iu);
    assert.match(context, /transcribed words arrived/iu);
    assert.match(context, /audio is not retained/iu);
    assert.match(context, /do not claim that an audio file was saved/iu);
  });
});
