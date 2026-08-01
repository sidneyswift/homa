import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMonthPlanPreview } from "./month-plan-preview-model";

const preview = {
  draftId: "00000000-0000-4000-8000-000000000010",
  revision: 2,
  monthStart: "2026-09-01",
  title: "September",
  children: [
    {
      childId: "00000000-0000-4000-8000-000000000011",
      childName: "Maya",
      targets: ["Reading stamina"],
      weeks: [1, 2, 3, 4].map((week) => ({
        week,
        focus: "reading",
        activities: [
          {
            text: "Read together.",
            scheduledDate: week === 1 ? "2026-09-01" : null,
            reusedMaterialId: null,
          },
        ],
      })),
      unresolvedChoices: [],
    },
  ],
  conflicts: [],
  unscheduledItems: [],
  unresolvedChoices: [],
  restoredFrom: 1,
};

describe("parseMonthPlanPreview", () => {
  it("accepts the closed server preview shape", () => {
    assert.deepEqual(parseMonthPlanPreview(preview), preview);
  });

  it("rejects malformed nested activities", () => {
    const malformed = structuredClone(preview);
    malformed.children[0].weeks[0].activities[0].scheduledDate = 4 as never;
    assert.equal(parseMonthPlanPreview(malformed), null);
  });

  it("rejects a preview without every required collection", () => {
    const { unresolvedChoices: _choices, ...malformed } = preview;
    assert.equal(parseMonthPlanPreview(malformed), null);
  });
});
