import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DashboardPlan } from "./plan-week";
import {
  PLANNER_ACTIVITY_HELP_DRAFT,
  plannerActivityHelpDraft,
  plannerActivityHelpHref,
} from "./planner-activity-help";

const PLAN: DashboardPlan = {
  childId: "kid-1",
  subjectId: "math",
  planRevision: 1,
  progressRevision: 0,
  done: 0,
  total: 1,
  retestAt: "2026-08-31T00:00:00.000Z",
  weeks: [{ week: 1, focus: "fractions", activities: ["Measure water in halves."] }],
  progress: {},
  activitySources: {},
};

describe("planner activity help", () => {
  it("builds a coordinate-only help link", () => {
    assert.equal(
      plannerActivityHelpHref({ childId: "kid-1", subjectId: "math", checkId: "1.0" }),
      "/app?draft=planner-activity-help&child=kid-1&subject=math&check=1.0",
    );
  });

  it("resolves composer text from the authenticated family plan", () => {
    assert.equal(
      plannerActivityHelpDraft({
        draft: PLANNER_ACTIVITY_HELP_DRAFT,
        childId: "kid-1",
        subjectId: "math",
        checkId: "1.0",
        children: [{ id: "kid-1", name: "Ari" }],
        plans: [PLAN],
      }),
      "Give me simple steps for this activity with Ari: Measure water in halves.",
    );
  });

  it("fails closed when any coordinate is outside the family plan", () => {
    assert.equal(
      plannerActivityHelpDraft({
        draft: PLANNER_ACTIVITY_HELP_DRAFT,
        childId: "someone-else",
        subjectId: "math",
        checkId: "1.0",
        children: [{ id: "kid-1", name: "Ari" }],
        plans: [PLAN],
      }),
      undefined,
    );
    assert.equal(
      plannerActivityHelpDraft({
        draft: PLANNER_ACTIVITY_HELP_DRAFT,
        childId: "kid-1",
        subjectId: "math",
        checkId: "1.9",
        children: [{ id: "kid-1", name: "Ari" }],
        plans: [PLAN],
      }),
      undefined,
    );
  });
});
