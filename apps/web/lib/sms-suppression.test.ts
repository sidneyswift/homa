import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifySmsOptKeyword } from "./sms-suppression";

describe("carrier opt-out keyword classification", () => {
  it("matches the exact carrier opt-out keywords, case-insensitively", () => {
    for (const text of ["STOP", "stop", " Stop ", "STOPALL", "UNSUBSCRIBE", "cancel", "END", "quit"]) {
      assert.equal(
        classifySmsOptKeyword({ text, hasAttachments: false }),
        "stop",
        text,
      );
    }
  });

  it("matches the resume keywords", () => {
    for (const text of ["START", "start", "UNSTOP"]) {
      assert.equal(
        classifySmsOptKeyword({ text, hasAttachments: false }),
        "start",
        text,
      );
    }
  });

  it("leaves sentences and near-misses to the agent", () => {
    for (const text of [
      "please stop sending briefs",
      "stop.",
      "Stop!",
      "can we start tomorrow",
      "yes",
      "no",
      "",
      "stop stop",
    ]) {
      assert.equal(
        classifySmsOptKeyword({ text, hasAttachments: false }),
        null,
        JSON.stringify(text),
      );
    }
  });

  it("never treats a text with attachments as an opt-out command", () => {
    assert.equal(
      classifySmsOptKeyword({ text: "STOP", hasAttachments: true }),
      null,
    );
  });
});
