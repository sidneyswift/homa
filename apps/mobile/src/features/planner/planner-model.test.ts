import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChildPlanRecord } from "../../lib/child-plans";
import type { ChildRecord } from "../../lib/family";
import type { FamilyAssetPlanLinkRecord } from "../../lib/family-asset-plan-links";
import { buildScheduledActivities } from "./planner-model";
import {
  mergeAppliedPlanActivityCheck,
  mergeChildPlanSnapshots,
} from "./plan-check-state";

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
  plan_revision: 4,
  progress_revision: 7,
};

const source: FamilyAssetPlanLinkRecord = {
  childId: child.id,
  subjectId: "math",
  week: 1,
  activityIndex: 0,
  activityText: "Count the stairs",
  assetId: "80000000-0000-4000-8000-000000000001",
  sourceTitle: "Counting workbook",
  sourceLocator: "Page 8",
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
        sourceLocator: source.sourceLocator,
        libraryUrl: source.libraryUrl,
      },
    ]);
    assert.equal(matched.checkKey, "1.0");
    assert.equal(matched.planRevision, 4);
    assert.equal(matched.progressRevision, 7);

    const [stale] = buildScheduledActivities(
      schedule,
      [plan],
      [child],
      [{ ...source, activityText: "Old activity text" }],
    );
    assert.deepEqual(stale.sources, []);
  });

  it("merges only a newer authoritative progress snapshot", () => {
    const initial = [plan];
    const updated = mergeAppliedPlanActivityCheck(
      initial,
      { childId: child.id, subjectId: "math" },
      {
        status: "applied",
        reason: null,
        planId: plan.id,
        planRevision: 4,
        progressRevision: 8,
        progressSnapshot: { "1.0": true },
        progressKey: "1.0",
        done: true,
      },
    );
    assert.notEqual(updated, initial);
    assert.deepEqual(updated[0].progress, { "1.0": true });
    assert.equal(updated[0].progress_revision, 8);

    const delayed = mergeAppliedPlanActivityCheck(
      updated,
      { childId: child.id, subjectId: "math" },
      {
        status: "applied",
        reason: null,
        planId: plan.id,
        planRevision: 4,
        progressRevision: 7,
        progressSnapshot: { "1.0": false },
        progressKey: "1.0",
        done: false,
      },
    );
    assert.equal(delayed, updated);
    assert.deepEqual(delayed[0].progress, { "1.0": true });
  });

  it("keeps newer plan meaning and progress across delayed reads", () => {
    const newerProgress = {
      ...plan,
      progress: { "1.0": true },
      progress_revision: 9,
      retest_at: "2026-09-01T00:00:00.000Z",
    };
    const staleProgressRead = {
      ...plan,
      progress: { "1.0": false },
      progress_revision: 8,
      retest_at: "2026-09-02T00:00:00.000Z",
    };
    const [progressMerged] = mergeChildPlanSnapshots(
      [newerProgress],
      [staleProgressRead],
    );
    assert.deepEqual(progressMerged.progress, { "1.0": true });
    assert.equal(progressMerged.progress_revision, 9);
    assert.equal(progressMerged.retest_at, "2026-09-02T00:00:00.000Z");

    const newerPlan = {
      ...newerProgress,
      plan_revision: 5,
      progress_revision: 1,
    };
    const stalePlanRead = {
      ...staleProgressRead,
      plan_revision: 4,
      progress_revision: 100,
    };
    const [planMerged] = mergeChildPlanSnapshots([newerPlan], [stalePlanRead]);
    assert.equal(planMerged, newerPlan);
  });

  it("accepts a genuinely newer plan read", () => {
    const newerPlan = {
      ...plan,
      plan_revision: 5,
      progress_revision: 0,
      progress: {},
    };
    const [merged] = mergeChildPlanSnapshots([plan], [newerPlan]);
    assert.equal(merged, newerPlan);
  });
});
