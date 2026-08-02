import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEADLINE_ANCHORS } from "./deadline-anchors.generated";
import {
  addDays,
  daysBetween,
  deadlineNeedingReminder,
  filingDeadlines,
  nextOccurrence,
  REMINDER_LEAD_DAYS,
  schoolYearStartFor,
} from "./deadlines";

/**
 * The deadline engine decides what date Homa puts in front of a family
 * about a legal filing, so its refusals matter as much as its answers
 * (gh#419). Every test here is either "the date is right" or "Homa
 * correctly declined to invent one".
 */

describe("calendar helpers", () => {
  it("counts whole days across a month boundary", () => {
    assert.equal(daysBetween("2026-07-29", "2026-08-01"), 3);
    assert.equal(daysBetween("2026-08-01", "2026-07-29"), -3);
    assert.equal(daysBetween("2026-07-29", "2026-07-29"), 0);
  });

  it("counts across a leap day", () => {
    assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
    assert.equal(daysBetween("2027-02-28", "2027-03-01"), 1);
  });

  it("adds days across year end", () => {
    assert.equal(addDays("2026-12-30", 3), "2027-01-02");
    assert.equal(addDays("2026-07-29", 30), "2026-08-28");
  });

  it("finds this year's occurrence when it is still ahead", () => {
    assert.equal(nextOccurrence(10, 1, "2026-07-29"), "2026-10-01");
  });

  it("rolls to next year once the date has passed", () => {
    // New York's July 1 read on July 29 means next July, not one gone by.
    assert.equal(nextOccurrence(7, 1, "2026-07-29"), "2027-07-01");
  });

  it("treats the day itself as still due today", () => {
    assert.equal(nextOccurrence(7, 29, "2026-07-29"), "2026-07-29");
  });

  it("skips a February 29 in a non-leap year", () => {
    assert.equal(nextOccurrence(2, 29, "2027-01-01"), "2028-02-29");
  });
});

describe("which school year a family is actually in", () => {
  it("uses this year's anniversary once it has arrived", () => {
    assert.equal(schoolYearStartFor("2026-08-17", "2026-09-01"), "2026-08-17");
  });

  it("keeps working in later years without the family re-entering it", () => {
    // Read literally, a 2026 start would measure a 2027 family from two
    // school years back and land every counted deadline in the past.
    assert.equal(schoolYearStartFor("2026-08-17", "2027-09-01"), "2027-08-17");
  });

  it("stays on last year's start when this year's has not arrived", () => {
    // June 2027: the family is still inside the year that began in
    // August 2026, so that is the start their deadlines count from.
    assert.equal(schoolYearStartFor("2026-08-17", "2027-06-01"), "2026-08-17");
  });

  it("asks rather than assumes when never answered", () => {
    assert.equal(schoolYearStartFor(null, "2026-09-01"), null);
    assert.equal(schoolYearStartFor("not a date", "2026-09-01"), null);
  });

  it("handles a February 29 start in a non-leap year", () => {
    assert.equal(schoolYearStartFor("2028-02-29", "2029-06-01"), "2028-02-29");
  });
});

describe("states that name a date in law", () => {
  it("gives New York its July 1 without needing anything from the family", () => {
    const outcome = filingDeadlines({
      stateCode: "NY",
      todayIso: "2026-06-20",
      schoolYearStartIso: null,
    });
    assert.ok(outcome.ok);
    const july = outcome.deadlines.find((d) => d.dueOn === "2026-07-01");
    assert.ok(july, "July 1 is on the calendar");
    assert.equal(july.basis, "state_calendar");
    assert.equal(july.daysAway, 11);
  });

  it("gives District of Columbia its August 15 continuation date", () => {
    const outcome = filingDeadlines({
      stateCode: "DC",
      todayIso: "2026-08-01",
      schoolYearStartIso: null,
    });
    assert.ok(outcome.ok);
    assert.deepEqual(outcome.deadlines, [
      {
        stateCode: "DC",
        dueOn: "2026-08-15",
        label: "File annual continuation by August 15",
        basis: "state_calendar",
        daysAway: 14,
      },
    ]);
  });

  it("points California at the opening of its October window", () => {
    // CA's rule is a window, October 1 through 15, and the verified
    // anchor carries both ends in its label. The date Homa puts on the
    // calendar is the OPENING, because a family reminded on the 1st
    // files inside the window and one reminded on the 15th may not.
    const outcome = filingDeadlines({
      stateCode: "CA",
      todayIso: "2026-09-01",
      schoolYearStartIso: null,
    });
    assert.ok(outcome.ok);
    assert.equal(outcome.deadlines[0].dueOn, "2026-10-01");
    assert.match(outcome.deadlines[0].label, /October 15/);
  });

  it("returns the soonest deadline first", () => {
    const outcome = filingDeadlines({
      stateCode: "CA",
      todayIso: "2026-09-01",
      schoolYearStartIso: null,
    });
    assert.ok(outcome.ok);
    const dates = outcome.deadlines.map((d) => d.dueOn);
    assert.deepEqual([...dates].sort(), dates);
  });
});

describe("states that count from when the family started", () => {
  it("asks for the start date rather than guessing", () => {
    const outcome = filingDeadlines({
      stateCode: "AZ",
      todayIso: "2026-07-29",
      schoolYearStartIso: null,
    });
    assert.ok(!outcome.ok);
    assert.equal(outcome.reason, "needs_school_year_start");
  });

  it("computes the real date once the family has told us", () => {
    // Arizona: within 30 days of starting.
    const outcome = filingDeadlines({
      stateCode: "AZ",
      todayIso: "2026-08-20",
      schoolYearStartIso: "2026-08-17",
    });
    assert.ok(outcome.ok);
    assert.equal(outcome.deadlines[0].dueOn, "2026-09-16");
    assert.equal(outcome.deadlines[0].basis, "family_start");
  });

  it("never converts business days or school days into a date", () => {
    // New Hampshire counts BUSINESS days. Turning that into a calendar
    // date needs a holiday table Homa does not have, so it declines.
    const outcome = filingDeadlines({
      stateCode: "NH",
      todayIso: "2026-08-20",
      schoolYearStartIso: "2026-08-17",
    });
    assert.ok(!outcome.ok, "NH must not produce a business-day date");
    assert.equal(
      outcome.reason,
      "not_computable",
      "the rule exists and is real; only the conversion is refused",
    );
  });

  it("tells a countable state apart from one with no rule", () => {
    // Texas has no filing rule at all. New Hampshire has one Homa will
    // not convert. A caller must be able to show the family the right
    // thing, so these are different answers.
    const nh = filingDeadlines({
      stateCode: "NH",
      todayIso: "2026-08-20",
      schoolYearStartIso: "2026-08-17",
    });
    const tx = filingDeadlines({
      stateCode: "TX",
      todayIso: "2026-08-20",
      schoolYearStartIso: "2026-08-17",
    });
    assert.ok(!nh.ok && !tx.ok);
    assert.equal(nh.reason, "not_computable");
    assert.equal(tx.reason, "no_anchors");
  });
});

describe("states with no computable date", () => {
  it("says so for a state with no anchors at all", () => {
    const outcome = filingDeadlines({
      stateCode: "TX",
      todayIso: "2026-07-29",
      schoolYearStartIso: "2026-08-17",
    });
    assert.ok(!outcome.ok);
    assert.equal(outcome.reason, "no_anchors");
  });

  it("says so for a state Homa has never heard of", () => {
    const outcome = filingDeadlines({
      stateCode: "ZZ",
      todayIso: "2026-07-29",
      schoolYearStartIso: "2026-08-17",
    });
    assert.ok(!outcome.ok);
    assert.equal(outcome.reason, "no_anchors");
  });
});

describe("which deadline earns a reminder", () => {
  it("fires inside the two-week window", () => {
    const outcome = filingDeadlines({
      stateCode: "NY",
      todayIso: "2026-06-20",
      schoolYearStartIso: null,
    });
    const due = deadlineNeedingReminder(outcome);
    assert.ok(due);
    assert.equal(due.dueOn, "2026-07-01");
  });

  it("stays quiet when the deadline is still far off", () => {
    const outcome = filingDeadlines({
      stateCode: "NY",
      todayIso: "2026-01-05",
      schoolYearStartIso: null,
    });
    assert.equal(deadlineNeedingReminder(outcome), null);
  });

  it("never fires for a date already past", () => {
    // July 2 reads July 1 as next year, which is 364 days out, not
    // yesterday. A passed deadline is a different message than this one.
    const outcome = filingDeadlines({
      stateCode: "NY",
      todayIso: "2026-07-02",
      schoolYearStartIso: null,
    });
    const due = deadlineNeedingReminder(outcome);
    assert.equal(due, null);
  });

  it("stays quiet when Homa cannot compute a date at all", () => {
    const outcome = filingDeadlines({
      stateCode: "AZ",
      todayIso: "2026-07-29",
      schoolYearStartIso: null,
    });
    assert.equal(deadlineNeedingReminder(outcome), null);
  });

  it("uses a two-week lead", () => {
    assert.equal(REMINDER_LEAD_DAYS, 14);
  });
});

describe("across every state with anchors", () => {
  it("never produces a date without a basis, and never throws", () => {
    for (const code of Object.keys(DEADLINE_ANCHORS)) {
      for (const start of [null, "2026-08-17"]) {
        const outcome = filingDeadlines({
          stateCode: code,
          todayIso: "2026-07-29",
          schoolYearStartIso: start,
        });
        if (!outcome.ok) continue;
        for (const deadline of outcome.deadlines) {
          assert.match(
            deadline.dueOn,
            /^\d{4}-\d{2}-\d{2}$/,
            `${code} produced a malformed date`,
          );
          assert.ok(
            deadline.basis === "state_calendar" ||
              deadline.basis === "family_start",
            `${code} produced a date with no basis`,
          );
          assert.ok(deadline.label.length > 0, `${code} has an unlabeled date`);
        }
      }
    }
  });

  it("gives the 14 fixed-date states a deadline with no family input", () => {
    const fixed = [
      "AR", "CA", "DE", "GA", "IA", "MN", "MS", "NE",
      "NY", "OH", "PA", "VA", "WA", "WI",
    ];
    for (const code of fixed) {
      const outcome = filingDeadlines({
        stateCode: code,
        todayIso: "2026-07-29",
        schoolYearStartIso: null,
      });
      assert.ok(outcome.ok, `${code} should not need the family's start date`);
      assert.ok(
        outcome.deadlines.some((d) => d.basis === "state_calendar"),
        `${code} should carry a state-named date`,
      );
    }
  });
});
