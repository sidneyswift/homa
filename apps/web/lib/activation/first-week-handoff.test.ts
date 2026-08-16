import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FIRST_WEEK_ADJUSTMENT_DRAFT,
  firstWeekAdjustmentDraft,
  firstWeekAdjustmentHref,
} from "./first-week-handoff";

describe("first-week activation handoff", () => {
  it("carries an action and child coordinate, never parent-facing prose", () => {
    assert.equal(
      firstWeekAdjustmentHref("kid-1"),
      "/app?draft=first-week-adjustment&child=kid-1",
    );
  });

  it("resolves the parent-facing draft from an authenticated child", () => {
    assert.equal(
      firstWeekAdjustmentDraft({
        draft: FIRST_WEEK_ADJUSTMENT_DRAFT,
        childId: "kid-1",
        children: [{ id: "kid-1", name: "Ari" }],
      }),
      "One part of Ari's first week does not fit: ",
    );
  });

  it("fails closed for an unknown action or child", () => {
    assert.equal(
      firstWeekAdjustmentDraft({
        draft: "anything-else",
        childId: "kid-1",
        children: [{ id: "kid-1", name: "Ari" }],
      }),
      undefined,
    );
    assert.equal(
      firstWeekAdjustmentDraft({
        draft: FIRST_WEEK_ADJUSTMENT_DRAFT,
        childId: "not-this-family",
        children: [{ id: "kid-1", name: "Ari" }],
      }),
      undefined,
    );
  });
});
