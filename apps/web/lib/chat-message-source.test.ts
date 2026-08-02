import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOMA_MESSAGE_SOURCE_HEADER,
  isSavedOnboardingCardAnswer,
  messageSourceContext,
  messageSourceFromRequest,
  messageSourceHeaders,
} from "./chat-message-source";

describe("chat message source", () => {
  it("round-trips the saved-card source through the request header", () => {
    const headers = messageSourceHeaders("saved_card_answer");
    const request = new Request("https://homa.test/eve", { headers });

    assert.equal(
      headers[HOMA_MESSAGE_SOURCE_HEADER],
      "saved-card-answer",
    );
    assert.equal(messageSourceFromRequest(request), "saved_card_answer");
  });

  it("defaults absent and unknown headers to parent prose", () => {
    assert.equal(
      messageSourceFromRequest(new Request("https://homa.test/eve")),
      "parent",
    );
    assert.equal(
      messageSourceFromRequest(
        new Request("https://homa.test/eve", {
          headers: { [HOMA_MESSAGE_SOURCE_HEADER]: "saved" },
        }),
      ),
      "parent",
    );
  });

  it("activates the no-duplicate contract only during onboarding", () => {
    const savedOnboarding = {
      onboardingActive: "true",
      messageSource: "saved_card_answer",
    };

    assert.equal(isSavedOnboardingCardAnswer(savedOnboarding), true);
    assert.equal(messageSourceContext(savedOnboarding).length, 1);
    assert.equal(
      isSavedOnboardingCardAnswer({
        onboardingActive: "false",
        messageSource: "saved_card_answer",
      }),
      false,
    );
    assert.deepEqual(
      messageSourceContext({
        onboardingActive: "true",
        messageSource: "parent",
      }),
      [],
    );
  });
});
