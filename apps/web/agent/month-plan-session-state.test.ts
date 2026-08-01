import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  abandonMonthPlanDraftState,
  activateMonthPlanDraft,
  approveMonthPlanDraftState,
  canUseMonthPlanDraft,
} from "./month-plan-session-state";

describe("month plan session state", () => {
  it("makes an abandoned token terminal even though its signature remains valid", () => {
    const active = activateMonthPlanDraft(
      { activeDraftId: null, lastApprovedDraftId: null },
      "draft-a",
    );
    assert.equal(canUseMonthPlanDraft(active, "draft-a"), true);
    const abandoned = abandonMonthPlanDraftState(active, "draft-a");
    assert.equal(canUseMonthPlanDraft(abandoned, "draft-a"), false);
  });

  it("allows an idempotent retry only for the last approved draft", () => {
    const approved = approveMonthPlanDraftState(
      { activeDraftId: "draft-a", lastApprovedDraftId: null },
      "draft-a",
    );
    assert.equal(canUseMonthPlanDraft(approved, "draft-a"), true);
    assert.equal(canUseMonthPlanDraft(approved, "draft-b"), false);
  });
});
