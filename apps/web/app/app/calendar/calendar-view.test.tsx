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
        familyName="The Chen family"
        {...props}
      />
    </AppRouterContext.Provider>,
  );
}

describe("CalendarView", () => {
  it("names the family's calendar and the week span", () => {
    const html = renderView();
    assert.match(html, />The Chen family<\/h1>/);
    assert.match(html, /Aug 3 to 9/);
  });

  it("names one kid's calendar when focused", () => {
    const html = renderView({ focusChildId: "child-leo" });
    assert.match(html, />Leo&#x27;s calendar<\/h1>/);
  });

  it("offers a filter chip per kid plus Everyone, in roster order", () => {
    const html = renderView();
    const everyoneIndex = html.indexOf(">Everyone<");
    const mayaIndex = html.indexOf("Maya");
    const leoIndex = html.indexOf("Leo");
    assert.ok(everyoneIndex > -1 && mayaIndex > -1 && leoIndex > -1);
    assert.ok(everyoneIndex < mayaIndex && mayaIndex < leoIndex);
  });

  it("shows a reassuring line when the whole week is empty", () => {
    const html = renderView();
    assert.match(html, /Nothing on the calendar this week yet/);
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

  it("renders a timed event once, at a 12-hour time, on the grid", () => {
    const html = renderView({ familyEvents: [event()] });
    assert.match(html, /Doctor&#x27;s appt/);
    assert.match(html, /2 to 3 PM/);
    assert.doesNotMatch(html, /Nothing on the calendar this week yet/);
    // Rendered exactly once as visible text (one unified grid, never once
    // per lane); the extra hit inside the hover title attribute is fine.
    assert.equal(html.split(">Doctor&#x27;s appt<").length - 1, 1);
  });

  it("renders an all-day multi-day event as a single spanning banner", () => {
    const html = renderView({
      familyEvents: [
        event({
          title: "Camping trip",
          startsOn: "2026-08-08",
          endsOn: "2026-08-09",
          startTime: null,
          endTime: null,
        }),
      ],
    });
    assert.match(html, /All day/);
    // One banner spanning Sat+Sun (grid columns 7 and 8 after the axis),
    // not one copy per day; the aria-label repeat does not count.
    assert.equal(html.split(">Camping trip<").length - 1, 1);
    assert.match(html, /grid-column:7\s*\/\s*9/);
  });

  it("filters another kid's event out when one kid is selected", () => {
    const html = renderView({
      focusChildId: "child-maya",
      familyEvents: [
        event({ childId: "child-leo", title: "Leo's dentist" }),
        event({ id: "event-2", childId: null, title: "Co-op morning" }),
      ],
    });
    // Maya's filtered view keeps whole-family events and drops Leo's own.
    assert.doesNotMatch(html, /Leo&#x27;s dentist/);
    assert.match(html, /Co-op morning/);
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
