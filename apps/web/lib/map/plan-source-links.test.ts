import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FourWeekPlan } from "@homa/core";

import type { DashboardPlan } from "../plan-week";
import {
  attachPlanSourceRows,
  planSourceLinksAfterEdits,
} from "./plan-source-links";

const ASSET_A = "60000000-0000-4000-8000-000000000001";
const ASSET_B = "60000000-0000-4000-8000-000000000002";

function plan(): FourWeekPlan {
  return {
    subjectId: "math",
    subjectName: "Math",
    childAgeLabel: "7 years",
    startingLine: null,
    targets: ["count to 100"],
    weeks: [
      {
        week: 1,
        focus: "counting",
        activities: ["Count the stairs", "Play shop", "Roll two dice"],
      },
      { week: 2, focus: "adding", activities: ["Add snack pieces"] },
    ],
    styleNote: null,
    bankVersion: "test",
  };
}

describe("planSourceLinksAfterEdits", () => {
  it("moves surviving provenance with an activity after removal", () => {
    const rows = planSourceLinksAfterEdits({
      plan: plan(),
      existing: [
        {
          assetId: ASSET_A,
          week: 1,
          activityIndex: 1,
          activityText: "Play shop",
          sourceTitle: "Money workbook",
          sourceLocator: "page 12",
        },
      ],
      edits: [{ action: "remove", week: 1, index: 0 }],
      canonicalSources: [],
    });
    assert.deepEqual(rows, [
      {
        assetId: ASSET_A,
        week: 1,
        activityIndex: 0,
        activityText: "Play shop",
        sourceTitle: "Money workbook",
        sourceLocator: "page 12",
      },
    ]);
  });

  it("clears replaced provenance and attaches only explicitly supplied sources", () => {
    const rows = planSourceLinksAfterEdits({
      plan: plan(),
      existing: [
        {
          assetId: ASSET_A,
          week: 1,
          activityIndex: 1,
          activityText: "Play shop",
          sourceTitle: "Money workbook",
          sourceLocator: null,
        },
      ],
      edits: [
        {
          action: "replace",
          week: 1,
          index: 1,
          text: "Practice doubles",
          sourceFamilyAssetIds: [ASSET_B],
        },
      ],
      canonicalSources: [{ id: ASSET_B, title: "Doubles worksheet" }],
    });
    assert.deepEqual(rows, [
      {
        assetId: ASSET_B,
        week: 1,
        activityIndex: 1,
        activityText: "Practice doubles",
        sourceTitle: "Doubles worksheet",
        sourceLocator: null,
      },
    ]);
  });

  it("drops a stale row whose text no longer matches its coordinate", () => {
    const rows = planSourceLinksAfterEdits({
      plan: plan(),
      existing: [
        {
          assetId: ASSET_A,
          week: 1,
          activityIndex: 0,
          activityText: "Different activity",
          sourceTitle: "Wrong source",
          sourceLocator: null,
        },
      ],
      edits: [{ action: "add", week: 1, text: "Count buttons" }],
      canonicalSources: [],
    });
    assert.deepEqual(rows, []);
  });
});

describe("attachPlanSourceRows", () => {
  it("attaches only rows whose activity text still matches", () => {
    const dashboard: DashboardPlan = {
      childId: "child-1",
      subjectId: "math",
      done: 0,
      total: 4,
      retestAt: "2026-09-01T00:00:00.000Z",
      weeks: plan().weeks,
      progress: {},
      activitySources: {},
    };
    const [attached] = attachPlanSourceRows([dashboard], [
      {
        child_id: "child-1",
        subject_id: "math",
        week: 1,
        activity_index: 0,
        activity_text: "Count the stairs",
        asset_id: ASSET_A,
        source_title: "Counting workbook",
        source_locator: "page 12",
      },
      {
        child_id: "child-1",
        subject_id: "math",
        week: 1,
        activity_index: 1,
        activity_text: "Stale text",
        asset_id: ASSET_B,
        source_title: "Wrong workbook",
        source_locator: null,
      },
    ]);
    assert.deepEqual(attached.activitySources, {
      "1.0": [
        { id: ASSET_A, title: "Counting workbook", sourceLocator: "page 12" },
      ],
    });
    assert.deepEqual(dashboard.activitySources, {});
  });
});
