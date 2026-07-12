import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nextChecklistItemFromAnswers,
} from "../sms-onboarding";

describe("SMS onboarding compatibility resume", () => {
  it("continues after a compatibility answer instead of asking it again", () => {
    const first = nextChecklistItemFromAnswers(84, {});
    assert.ok(first);

    const resumed = nextChecklistItemFromAnswers(84, {
      [first.itemId]: "not_sure",
    });

    assert.ok(resumed);
    assert.equal(resumed.answered, 1);
    assert.notEqual(resumed.itemId, first.itemId);
  });
});
