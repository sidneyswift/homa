import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkingPlanShelf } from "./working-plan-shelf";

const plan = {
  id: "00000000-0000-4000-8000-000000000003",
  kind: "month_plan" as const,
  title: "September, lighter Fridays",
  currentRevision: 3,
  updatedAt: "2026-08-16T20:30:00.000Z",
};

describe("WorkingPlanShelf", () => {
  it("renders nothing when the family has no working plans", () => {
    assert.equal(
      renderToStaticMarkup(
        <WorkingPlanShelf plans={[]} timeZone="America/New_York" />,
      ),
      "",
    );
  });

  it("links the exact plan id back to the safe chat resume route", () => {
    const html = renderToStaticMarkup(
      <WorkingPlanShelf plans={[plan]} timeZone="America/New_York" />,
    );
    assert.match(html, /Month plans in progress/u);
    assert.match(html, /September, lighter Fridays/u);
    assert.doesNotMatch(html, /revision 3/u);
    assert.match(html, /Your Planner stays the same until you approve the plan/u);
    assert.match(
      html,
      /href="\/app\?draft=resume-month-plan&amp;plan=00000000-0000-4000-8000-000000000003"/u,
    );
    assert.match(html, />Review with Homa</u);
    assert.doesNotMatch(html, /behind|overdue|failed/iu);
  });
});
