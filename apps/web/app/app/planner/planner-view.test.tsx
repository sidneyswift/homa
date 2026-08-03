import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import type { DashboardPlan } from "../../../lib/plan-week";
import { PlannerView, type PlannerKid } from "./planner-view";

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const KID: PlannerKid = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Maya",
  birth_month: "2019-05-10",
  avatar_url: null,
};

const PLAN: DashboardPlan = {
  childId: KID.id,
  subjectId: "math",
  planRevision: 3,
  progressRevision: 5,
  done: 0,
  total: 1,
  retestAt: "2026-08-30T12:00:00.000Z",
  weeks: [
    { week: 1, focus: "counting", activities: ["Count the blue buttons"] },
  ],
  progress: {},
  activitySources: {},
};

function render(reports: Map<string, { token: string | null }>): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <PlannerView
        kids={[KID]}
        reports={reports}
        plans={[PLAN]}
        timeZone="America/New_York"
        now={new Date("2026-08-02T12:00:00.000Z")}
        focusChildId={null}
        surface="canvas"
      />
    </AppRouterContext.Provider>,
  );
}

describe("PlannerView plan authority", () => {
  it("renders a persisted tokenless plan with a writable checkbox", () => {
    const html = render(new Map());
    assert.match(html, /Count the blue buttons/u);
    assert.match(html, /type="checkbox"/u);
    assert.doesNotMatch(html, /There&#x27;s no month set up yet/u);
    assert.doesNotMatch(html, />full month</u);
  });

  it("uses a report token only to offer the full-month link", () => {
    const html = render(new Map([[KID.id, { token: "report-token" }]]));
    assert.match(html, /href="\/onboarding\/r\/report-token\/plan\/math"/u);
    assert.match(html, />full month</u);
  });
});
