import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DashboardPlan } from "./plan-week";
import { shapePlannerPlan } from "./planner-payload";
import { scheduledDatesByActivity, type ScheduledDateRow } from "./plan-schedule";

/**
 * open_planner's payload bounding (issue #257, arc PR B0). Two rules
 * under test, both council-settled (planner-calendar plan §4.3.1):
 * a childId-narrowed call gets all four weeks in full with real
 * scheduledDate on every activity; a family-wide call gets the current
 * week in full plus one-line summaries, so a large family's payload
 * stays inside a sane token budget. The size guard at the bottom is
 * the ratchet: it fails if the family-wide shape quietly grows back
 * into a whole-board dump.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A plan living in week 2 today: retest 18 days out means the plan
 * started 10 days ago (start = retest minus 28 days). */
function retestForWeekTwo(nowMs: number): string {
  return new Date(nowMs + 18 * DAY_MS).toISOString();
}

function plan(nowMs: number, overrides: Partial<DashboardPlan> = {}): DashboardPlan {
  return {
    childId: "child-1",
    subjectId: "math",
    done: 1,
    total: 8,
    retestAt: retestForWeekTwo(nowMs),
    weeks: [1, 2, 3, 4].map((week) => ({
      week,
      focus: `Week ${week} focus`,
      activities: [`W${week} first activity`, `W${week} second activity`],
    })),
    progress: { "1.0": true },
    ...overrides,
  };
}

const NOW = Date.UTC(2026, 6, 27, 12, 0, 0);

describe("shapePlannerPlan", () => {
  const scheduledDates = scheduledDatesByActivity([
    { childId: "child-1", subjectId: "math", week: 2, activityIndex: 0, scheduledDate: "2026-07-28" },
    { childId: "child-1", subjectId: "math", week: 3, activityIndex: 1, scheduledDate: "2026-08-05" },
    // Another child's row: must never leak into child-1's payload.
    { childId: "child-2", subjectId: "math", week: 2, activityIndex: 0, scheduledDate: "2026-07-29" },
  ]);

  it("returns all four weeks in full on a narrowed call", () => {
    const shaped = shapePlannerPlan(plan(NOW), {
      nowMs: NOW,
      fullWeeks: true,
      scheduledDates,
    });
    assert.equal(shaped.weeks.length, 4);
    assert.equal(shaped.weekSummaries, undefined);
    assert.deepEqual(
      shaped.weeks.map((week) => week.weekNumber),
      [1, 2, 3, 4],
    );
    assert.equal(shaped.currentWeekNumber, 2);
    assert.equal(shaped.weeks[1].current, true);
    assert.equal(shaped.weeks[0].current, false);
  });

  it("carries each activity's real scheduledDate, null when unscheduled", () => {
    const shaped = shapePlannerPlan(plan(NOW), {
      nowMs: NOW,
      fullWeeks: true,
      scheduledDates,
    });
    assert.equal(shaped.weeks[1].activities[0].scheduledDate, "2026-07-28");
    assert.equal(shaped.weeks[1].activities[1].scheduledDate, null);
    assert.equal(shaped.weeks[2].activities[1].scheduledDate, "2026-08-05");
    // The exact-equality asserts above double as the tenancy check:
    // child-2's identically-keyed 2026-07-29 row never leaks in.
  });

  it("marks check-offs on the right activities", () => {
    const shaped = shapePlannerPlan(plan(NOW), {
      nowMs: NOW,
      fullWeeks: true,
      scheduledDates,
    });
    assert.equal(shaped.weeks[0].activities[0].done, true);
    assert.equal(shaped.weeks[0].activities[1].done, false);
  });

  it("returns the current week plus summaries on a family-wide call", () => {
    const shaped = shapePlannerPlan(plan(NOW), {
      nowMs: NOW,
      fullWeeks: false,
      scheduledDates,
    });
    assert.equal(shaped.weeks.length, 1);
    assert.equal(shaped.weeks[0].weekNumber, 2);
    assert.equal(shaped.weeks[0].activities[0].scheduledDate, "2026-07-28");
    assert.deepEqual(
      shaped.weekSummaries?.map((week) => week.weekNumber),
      [1, 3, 4],
    );
    const summaryByWeek = new Map(
      (shaped.weekSummaries ?? []).map((week) => [week.weekNumber, week]),
    );
    assert.equal(summaryByWeek.get(1)?.doneCount, 1);
    assert.equal(summaryByWeek.get(1)?.scheduledCount, 0);
    assert.equal(summaryByWeek.get(3)?.scheduledCount, 1);
    assert.equal(summaryByWeek.get(4)?.activityCount, 2);
  });

  it("summaries never carry activity text", () => {
    const shaped = shapePlannerPlan(plan(NOW), {
      nowMs: NOW,
      fullWeeks: false,
      scheduledDates,
    });
    const json = JSON.stringify(shaped.weekSummaries);
    assert.equal(json.includes("first activity"), false);
  });
});

describe("payload bounding for a large family", () => {
  // The stated large family: 4 children, 5 plans each (4 subjects plus
  // the month plan), 4 weeks of 4 activities, realistic ~110-char
  // activity sentences, every activity scheduled. The measured JSON
  // sizes here back the token numbers stated in the PR body
  // (tokens roughly chars / 4).
  function largeFamily(): { plans: DashboardPlan[]; dates: Map<string, string> } {
    const plans: DashboardPlan[] = [];
    const rows: ScheduledDateRow[] = [];
    const activity = (subject: string, week: number, index: number) =>
      `Ten minutes of ${subject} practice, week ${week} item ${index}: played not taught, dice and cards and cooking, one real moment a day.`;
    for (let child = 0; child < 4; child += 1) {
      const childId = `child-${child}`;
      for (const subject of ["math", "literacy", "phonics", "writing", "month"]) {
        plans.push(
          plan(NOW, {
            childId,
            subjectId: subject,
            weeks: [1, 2, 3, 4].map((week) => ({
              week,
              focus: `Week ${week}: ${subject} rhythm, kept light and daily.`,
              activities: [0, 1, 2, 3].map((index) => activity(subject, week, index)),
            })),
          }),
        );
        for (let week = 1; week <= 4; week += 1) {
          for (let index = 0; index < 4; index += 1) {
            rows.push({
              childId,
              subjectId: subject,
              week,
              activityIndex: index,
              scheduledDate: "2026-07-28",
            });
          }
        }
      }
    }
    return { plans, dates: scheduledDatesByActivity(rows) };
  }

  it("keeps the family-wide payload an order smaller than the full board", () => {
    const { plans, dates } = largeFamily();
    const familyWide = JSON.stringify(
      plans.map((entry) =>
        shapePlannerPlan(entry, { nowMs: NOW, fullWeeks: false, scheduledDates: dates }),
      ),
    );
    const fullBoard = JSON.stringify(
      plans.map((entry) =>
        shapePlannerPlan(entry, { nowMs: NOW, fullWeeks: true, scheduledDates: dates }),
      ),
    );
    // Ratchets, not aspirations: measured 2026-07-27 the family-wide
    // shape is ~2.4x smaller than the full board for this family. If
    // either number grows past its cap, the bounding regressed.
    assert.equal(familyWide.length < 45_000, true, `family-wide payload is ${familyWide.length} chars`);
    assert.equal(familyWide.length * 2 < fullBoard.length, true);
  });

  it("keeps a one-child narrowed payload small", () => {
    const { plans, dates } = largeFamily();
    const oneChild = JSON.stringify(
      plans
        .filter((entry) => entry.childId === "child-0")
        .map((entry) =>
          shapePlannerPlan(entry, { nowMs: NOW, fullWeeks: true, scheduledDates: dates }),
        ),
    );
    assert.equal(oneChild.length < 30_000, true, `narrowed payload is ${oneChild.length} chars`);
  });
});
