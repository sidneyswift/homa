import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChildPlanRecord } from "../../lib/child-plans";
import type { ChildRecord } from "../../lib/family";
import type { FamilyAssetPlanLinkRecord } from "../../lib/family-asset-plan-links";
import { buildScheduledActivities } from "./planner-model";

const child: ChildRecord = {
  id: "child-1",
  family_id: "family-1",
  name: "Mia",
  birth_month: "2019-05-01",
  profile: {},
};

const plan: ChildPlanRecord = {
  id: "plan-1",
  child_id: child.id,
  subject_id: "math",
  plan: {
    subjectId: "math",
    subjectName: "Math",
    childAgeLabel: "7 years",
    startingLine: null,
    targets: ["count to 100"],
    weeks: [
      { week: 1, focus: "counting", activities: ["Count the stairs"] },
    ],
    styleNote: null,
    bankVersion: "test",
  },
  progress: {},
  retest_at: "2026-09-01T00:00:00.000Z",
};

const source: FamilyAssetPlanLinkRecord = {
  childId: child.id,
  subjectId: "math",
  week: 1,
  activityIndex: 0,
  activityText: "Count the stairs",
  assetId: "80000000-0000-4000-8000-000000000001",
  sourceTitle: "Counting workbook",
  libraryUrl:
    "https://thankshoma.com/app/library?asset=80000000-0000-4000-8000-000000000001",
};

describe("native planner Family Library sources", () => {
  it("attaches an exact source and drops the same row when its text is stale", () => {
    const schedule = [
      {
        id: "schedule-1",
        family_id: child.family_id,
        child_id: child.id,
        subject_id: "math",
        week: 1,
        activity_index: 0,
        scheduled_date: "2026-08-03",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ];
    const [matched] = buildScheduledActivities(
      schedule,
      [plan],
      [child],
      [source],
    );
    assert.deepEqual(matched.sources, [
      {
        id: source.assetId,
        title: source.sourceTitle,
        libraryUrl: source.libraryUrl,
      },
    ]);

    const [stale] = buildScheduledActivities(
      schedule,
      [plan],
      [child],
      [{ ...source, activityText: "Old activity text" }],
    );
    assert.deepEqual(stale.sources, []);
  });
});
