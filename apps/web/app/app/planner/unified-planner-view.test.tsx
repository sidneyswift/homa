import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import type { FamilyEventRow } from "../../../lib/family-events";
import type { HoursEntry } from "../../../lib/hours-view";
import type { PlanActivityScheduleRow } from "../../../lib/plan-schedule";
import type { DashboardPlan } from "../../../lib/plan-week";
import type { PlannerLearningActivity } from "../../../lib/planner-learning-activities";
import {
  UnifiedPlannerView,
  type UnifiedPlannerKid,
} from "./unified-planner-view";

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const KID: UnifiedPlannerKid = {
  id: "kid-1",
  name: "Ari",
  avatar_url: null,
};

const SECOND_KID: UnifiedPlannerKid = {
  id: "kid-2",
  name: "Remy",
  avatar_url: null,
};

const plannerSource = readFileSync(new URL("./unified-planner-view.tsx", import.meta.url), "utf8");
const calendarActionsSource = readFileSync(new URL("../calendar/actions.ts", import.meta.url), "utf8");

const PLAN: DashboardPlan = {
  childId: KID.id,
  subjectId: "math",
  planRevision: 1,
  progressRevision: 1,
  done: 1,
  total: 2,
  retestAt: "2026-08-31T00:00:00.000Z",
  weeks: [
    {
      week: 1,
      focus: "fractions",
      activities: ["Fractions with measuring cups", "Count the garden rows"],
    },
  ],
  progress: { "1.1": true },
  activitySources: {},
};

const SCHEDULE: PlanActivityScheduleRow[] = [
  {
    id: "schedule-1",
    familyId: "family-1",
    childId: KID.id,
    subjectId: "math",
    week: 1,
    activityIndex: 0,
    scheduledDate: "2026-08-03",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "schedule-2",
    familyId: "family-1",
    childId: KID.id,
    subjectId: "math",
    week: 1,
    activityIndex: 1,
    scheduledDate: "2026-08-03",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
];

const EVENT: FamilyEventRow = {
  id: "event-1",
  familyId: "family-1",
  childId: null,
  title: "Dentist",
  startsOn: "2026-08-03",
  endsOn: "2026-08-03",
  startTime: "10:30",
  endTime: "11:15",
  note: null,
  createdAt: "2026-08-01T00:00:00.000Z",
};

const HOURS: HoursEntry = {
  id: "hours-1",
  childId: KID.id,
  childName: KID.name,
  subject: "math",
  minutes: 30,
  happenedOn: "2026-08-03",
  source: "chat",
  note: "Fractions",
};

const PLANNED_LOG: PlannerLearningActivity = {
  id: "learning-1",
  familyId: "family-1",
  title: "Horizons lesson 42",
  subject: "math",
  activityDate: "2026-08-03",
  status: "planned",
  durationMinutes: null,
  note: null,
  sourceChannel: "web",
  sourceQuote: "We will do Horizons lesson 42.",
  sourceMessageId: "10000000-0000-4000-8000-000000000001",
  completionSourceChannel: null,
  completionSourceQuote: null,
  completionSourceMessageId: null,
  completedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  childIds: [KID.id, SECOND_KID.id],
  hoursEntryIds: [],
};

const COMPLETED_LOG: PlannerLearningActivity = {
  ...PLANNED_LOG,
  id: "learning-2",
  title: "Piano practice",
  subject: "music",
  status: "completed",
  durationMinutes: 20,
  sourceQuote: "Piano practice took 20 minutes.",
  sourceMessageId: "10000000-0000-4000-8000-000000000002",
  completionSourceChannel: "web",
  completionSourceQuote: "Piano practice took 20 minutes.",
  completionSourceMessageId: "10000000-0000-4000-8000-000000000002",
  completedAt: "2026-08-03T14:00:00.000Z",
  childIds: [KID.id],
  hoursEntryIds: ["20000000-0000-4000-8000-000000000001"],
};

function renderView(
  overrides: Partial<Parameters<typeof UnifiedPlannerView>[0]> = {},
): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <UnifiedPlannerView
        kids={[KID]}
        plans={[PLAN]}
        familyEvents={[EVENT]}
        scheduledActivities={SCHEDULE}
        learningActivities={[]}
        hoursEntries={[]}
        timeZone="America/New_York"
        now={new Date("2026-08-03T14:00:00.000Z")}
        today="2026-08-03"
        activeDate="2026-08-03"
        view="day"
        focusChildId={null}
        {...overrides}
      />
    </AppRouterContext.Provider>,
  );
}

describe("UnifiedPlannerView", () => {
  it("offers one occurrence or the entire recurring series for move and delete", () => {
    assert.match(plannerSource, /What do you want to move\?/u);
    assert.match(plannerSource, /What do you want to delete\?/u);
    assert.match(plannerSource, /Move this event/u);
    assert.match(plannerSource, /Edit entire series/u);
    assert.match(plannerSource, /Delete this event/u);
    assert.match(plannerSource, /Delete entire series/u);
    assert.match(calendarActionsSource, /save_family_event_occurrence_exception/u);
    assert.match(calendarActionsSource, /data !== input\.occurrenceOn/u);
  });

  it("opens on one day with one Add action and four quiet views", () => {
    const html = renderView();
    assert.match(html, />Planner<\/h1>/);
    assert.match(html, /data-brand-surface="planner"/);
    assert.match(html, /quiet-action quiet-action--primary/);
    assert.match(plannerSource, /aria-label="Close"/);
    assert.match(html, />Day<\/a>/);
    assert.match(html, />Week<\/a>/);
    assert.match(html, />Month<\/a>/);
    assert.match(html, />School hours<\/a>/);
    assert.equal((html.match(/ Choose an event or activity<\/button>/g) ?? []).length, 1);
    assert.match(html, /Monday, August 3/);
  });

  it("shows fixed appointments and unfinished work, then collapses finished work", () => {
    const html = renderView();
    assert.match(html, /Dentist/);
    assert.match(html, /10:30 AM/);
    assert.match(html, /Fractions with measuring cups/);
    assert.match(html, /Show 1 finished activity/);
    assert.doesNotMatch(html, /Count the garden rows/);
    assert.match(html, /h-\[22px\] w-\[22px\]/);
  });

  it("renders logged learning as planned work and completed history across every view", () => {
    const learningActivities = [PLANNED_LOG, COMPLETED_LOG];
    const dayHtml = renderView({
      kids: [KID, SECOND_KID],
      learningActivities,
    });
    assert.match(dayHtml, /Horizons lesson 42/);
    assert.match(dayHtml, /Ari \+ Remy · Math/);
    assert.match(dayHtml, /Show 2 finished activities/);
    assert.doesNotMatch(dayHtml, /Piano practice/);

    const weekHtml = renderView({
      view: "week",
      kids: [KID, SECOND_KID],
      learningActivities,
    });
    assert.match(weekHtml, /2 activities · 1 event/);

    const monthHtml = renderView({
      view: "month",
      kids: [KID, SECOND_KID],
      learningActivities,
    });
    assert.match(monthHtml, /Monday, August 3, 4 activities, 1 event/);
    assert.match(monthHtml, />5 items</);
  });

  it("confirms the atomic Hours correction and labels duration as reported", () => {
    assert.match(
      plannerSource,
      /Mark this not finished\? The time linked to this activity will also be removed from Hours\./u,
    );
    assert.match(plannerSource, /Reported time/u);
    assert.match(plannerSource, /reported`/u);
    assert.doesNotMatch(plannerSource, /Correct it in Hours/u);
  });

  it("summarizes seven days in Week instead of rendering seven agenda cards", () => {
    const html = renderView({ view: "week" });
    assert.match(html, /Week summary/);
    assert.equal((html.match(/min-h-\[78px\]/g) ?? []).length, 7);
    assert.match(html, /1 activity · 1 event/);
  });

  it("uses a familiar month grid that opens dates in Day", () => {
    const html = renderView({ view: "month" });
    assert.match(html, /August 2026 calendar/);
    assert.match(html, /Monday, August 3, 2 activities, 1 event/);
    assert.match(html, />3 items</);
    assert.match(html, /view=day&amp;date=2026-08-03/);
  });

  it("embeds the existing editable Hours record without a second page title", () => {
    const html = renderView({ view: "hours", familyEvents: [], scheduledActivities: [], hoursEntries: [HOURS] });
    assert.equal((html.match(/<h1/g) ?? []).length, 1);
    assert.match(html, />Recorded time<\/h2>/);
    assert.match(html, /Your Hours stay available and downloadable if you cancel\./u);
    assert.match(html, /href="\/api\/hours\/export"/u);
    assert.match(html, />Download CSV<\/span>/u);
    assert.match(html, /30m/);
    assert.match(html, /Homa records the school time you tell her about\. Review or correct it here\./);
    assert.doesNotMatch(html, /The compliance record/);
  });

  it("shows recorded time on the day with subject and child context", () => {
    const html = renderView({ kids: [KID, SECOND_KID], hoursEntries: [HOURS] });
    assert.match(html, /Filter this day by child/);
    assert.match(html, />Whole family<\/button>/);
    assert.match(html, />Ari<\/button>/);
    assert.match(html, />Recorded time<\/h3>/);
    assert.match(html, />Math<\/span>/);
    assert.match(html, />30m<\/span>/);
    assert.match(html, />Ari<\/span>/);
  });

  it("names every explicitly included child on one shared event", () => {
    const html = renderView({
      kids: [KID, SECOND_KID],
      familyEvents: [{ ...EVENT, childId: KID.id, childIds: [KID.id, SECOND_KID.id] }],
    });
    assert.match(html, /Ari \+ Remy/);
    assert.equal((html.match(/>Dentist</g) ?? []).length, 1);
  });

  it("shows a weekly event on a later occurrence date", () => {
    const html = renderView({
      activeDate: "2026-08-10",
      familyEvents: [
        {
          ...EVENT,
          title: "Co-op",
          recurrence: {
            frequency: "weekly",
            interval: 1,
            weekdays: [1],
            until: "2026-08-31",
          },
        },
      ],
    });
    assert.match(html, /Co-op/);
    assert.match(html, /Monday, August 10/);
  });
});
