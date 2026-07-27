import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import type { FamilyEventRow } from "../../../lib/family-events";
import type { PlanActivityScheduleRow } from "../../../lib/plan-schedule";
import type { DashboardPlan } from "../../../lib/plan-week";
import { CalendarView, type CalendarKid } from "./calendar-view";

/**
 * /app/calendar (issue #176, CG-03). Same posture as the Hours and Tasks
 * UI tests: static server render, assertions on the HTML contract, no
 * browser. usePlanChecks' useSyncExternalStore reads its SSR snapshot
 * (always null) during renderToStaticMarkup, so the checkbox renders
 * from the plan's own initialChecks without ever touching localStorage.
 */

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const MAYA: CalendarKid = { id: "child-maya", name: "Maya", avatar_url: null };
const LEO: CalendarKid = { id: "child-leo", name: "Leo", avatar_url: null };

// Saturday Aug 8, 2026: the week is Mon Aug 3 to Sun Aug 9.
const NOW = new Date("2026-08-08T22:00:00.000Z");

function mayaPlan(overrides: Partial<DashboardPlan> = {}): DashboardPlan {
  return {
    childId: "child-maya",
    subjectId: "math",
    done: 0,
    total: 1,
    retestAt: "2026-08-31T00:00:00Z",
    weeks: [{ week: 1, focus: "counting", activities: ["Count to 20 daily"] }],
    progress: {},
    ...overrides,
  };
}

function event(overrides: Partial<FamilyEventRow> = {}): FamilyEventRow {
  return {
    id: "event-1",
    familyId: "family-1",
    childId: null,
    title: "Doctor's appt",
    startsOn: "2026-08-04",
    endsOn: "2026-08-04",
    startTime: "14:00",
    endTime: "15:00",
    note: null,
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function schedule(overrides: Partial<PlanActivityScheduleRow> = {}): PlanActivityScheduleRow {
  return {
    id: "schedule-1",
    familyId: "family-1",
    childId: "child-maya",
    subjectId: "math",
    week: 1,
    activityIndex: 0,
    scheduledDate: "2026-08-04",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function renderView(props: Partial<Parameters<typeof CalendarView>[0]> = {}): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <CalendarView
        kids={[MAYA, LEO]}
        plans={[]}
        reports={new Map([
          ["child-maya", { token: "token-maya" }],
          ["child-leo", { token: "token-leo" }],
        ])}
        familyEvents={[]}
        scheduledActivities={[]}
        hoursEntries={[]}
        timeZone="America/New_York"
        now={NOW}
        focusChildId={null}
        weekOffset={0}
        {...props}
      />
    </AppRouterContext.Provider>,
  );
}

describe("CalendarView", () => {
  it("names the whole family's calendar and the week span", () => {
    const html = renderView();
    assert.match(html, />Your calendar<\/h1>/);
    assert.match(html, /Aug 3 to 9/);
  });

  it("names one kid's calendar when focused", () => {
    const html = renderView({ focusChildId: "child-leo" });
    assert.match(html, />Leo&#x27;s calendar<\/h1>/);
  });

  it("renders one lane per kid, in family roster order", () => {
    const html = renderView();
    const mayaIndex = html.indexOf(">Maya<");
    const leoIndex = html.indexOf(">Leo<");
    assert.ok(mayaIndex > -1 && leoIndex > -1 && mayaIndex < leoIndex);
  });

  it("shows a reassuring line when nothing is on the family lane", () => {
    const html = renderView();
    assert.match(html, /No family-wide events this week/);
  });

  it("places a scheduled activity on its real day with subject label and checkbox", () => {
    const html = renderView({
      plans: [mayaPlan()],
      scheduledActivities: [schedule()],
    });
    assert.match(html, />Math<\/span>/);
    assert.match(html, /Count to 20 daily/);
    assert.match(html, /type="checkbox"/);
  });

  it("checks the box when the plan already marks that activity done", () => {
    const html = renderView({
      plans: [mayaPlan({ progress: { "1.0": true } })],
      scheduledActivities: [schedule()],
    });
    assert.match(html, /type="checkbox"[^>]*checked=""/);
  });

  it("renders a whole-family event on the family lane, not any kid's lane", () => {
    const html = renderView({ familyEvents: [event()] });
    assert.match(html, /Doctor&#x27;s appt/);
    assert.match(html, /14:00 to 15:00/);
    assert.doesNotMatch(html, /No family-wide events this week/);
  });

  it("renders a child-scoped event only under that kid", () => {
    const html = renderView({
      familyEvents: [event({ childId: "child-leo", title: "Leo's dentist" })],
    });
    assert.match(html, /Leo&#x27;s dentist/);
    // The family lane still shows its empty-state line since this event
    // is not whole-family.
    assert.match(html, /No family-wide events this week/);
  });

  it("shows the hours indicator only when time was logged that day", () => {
    const withHours = renderView({
      hoursEntries: [{ childId: "child-maya", happenedOn: "2026-08-04", minutes: 45 }],
    });
    assert.match(withHours, /45m/);

    const withoutHours = renderView();
    assert.doesNotMatch(withoutHours, /\d+m<\/span>/);
  });

  it("links to the existing week planner rather than replacing it", () => {
    const html = renderView();
    assert.match(html, /href="\/app\/planner"/);
    assert.match(html, />Open the week planner<\/a>/);
  });
});

describe("week navigation", () => {
  it("labels this week and omits a Today link when already on it", () => {
    const html = renderView({ weekOffset: 0 });
    assert.match(html, /This week/);
    assert.doesNotMatch(html, />Today<\/a>/);
  });

  it("prev/next hrefs step exactly one week either way from this week", () => {
    const html = renderView({ weekOffset: 0 });
    assert.match(html, /href="\/app\/calendar\?week=-1"/);
    assert.match(html, /href="\/app\/calendar\?week=1"/);
  });

  it("labels next week and shows a Today link back to the param-free URL", () => {
    const html = renderView({ weekOffset: 1 });
    assert.match(html, /Next week/);
    assert.match(html, /href="\/app\/calendar">Today<\/a>/);
  });

  it("labels last week correctly", () => {
    const html = renderView({ weekOffset: -1 });
    assert.match(html, /Last week/);
  });

  it("labels a week further out by count rather than singular wording", () => {
    const forward = renderView({ weekOffset: 3 });
    assert.match(forward, /In 3 weeks/);

    const backward = renderView({ weekOffset: -3 });
    assert.match(backward, /3 weeks ago/);
  });

  it("prev/next hrefs keep stepping from a non-zero week, not resetting to it", () => {
    const html = renderView({ weekOffset: 2 });
    assert.match(html, /href="\/app\/calendar\?week=1"/);
    assert.match(html, /href="\/app\/calendar\?week=3"/);
  });
});
