import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recordResearchBriefFeedbackAction } from "./actions";

describe("recordResearchBriefFeedbackAction", () => {
  it("rejects a malformed task run id before authenticated work", async () => {
    assert.deepEqual(
      await recordResearchBriefFeedbackAction("not-a-uuid", "helpful"),
      { error: "That brief isn't available for feedback." },
    );
  });

  it("rejects a non-string task run id before authenticated work", async () => {
    assert.deepEqual(
      await recordResearchBriefFeedbackAction(42, "helpful"),
      { error: "That brief isn't available for feedback." },
    );
  });
});
