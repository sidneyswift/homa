import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarCreatePayload,
  calendarExportFingerprint,
  familyEventExportItem,
  planActivityExportItem,
  zonedDateTime,
} from "./device-calendar-export";

const FAMILY_EVENT = {
  id: "event-1",
  family_id: "family-1",
  child_id: "child-1",
  title: "Co-op",
  starts_on: "2026-11-02",
  ends_on: "2026-11-02",
  start_time: "09:00",
  end_time: "10:30",
  note: "Bring nature journal",
  created_at: "2026-08-01T00:00:00Z",
};

describe("device calendar export contract", () => {
  it("converts a timed event using the family's zone across DST", () => {
    const item = familyEventExportItem(FAMILY_EVENT, "Maya", "America/New_York");
    const payload = calendarCreatePayload(item);
    assert.equal(payload.startDate.toISOString(), "2026-11-02T14:00:00.000Z");
    assert.equal(payload.endDate.toISOString(), "2026-11-02T15:30:00.000Z");
    assert.equal(payload.timeZone, "America/New_York");
  });

  it("rejects a local time that disappears during the spring DST jump", () => {
    assert.throws(
      () => zonedDateTime("2026-03-08", "02:30", "America/New_York"),
      /does not exist/,
    );
  });

  it("uses an exclusive end date for all-day and multi-day events", () => {
    const item = familyEventExportItem(
      { ...FAMILY_EVENT, starts_on: "2026-08-10", ends_on: "2026-08-12", start_time: null, end_time: null },
      null,
      "America/Chicago",
    );
    const payload = calendarCreatePayload(item);
    assert.equal(payload.allDay, true);
    assert.equal(payload.startDate.getFullYear(), 2026);
    assert.equal(payload.startDate.getMonth(), 7);
    assert.equal(payload.startDate.getDate(), 10);
    assert.equal(payload.endDate.getDate(), 13);
  });

  it("maps weekly recurrence and keeps a stable Homa link", () => {
    const item = familyEventExportItem(FAMILY_EVENT, "Maya", "America/New_York", {
      frequency: "weekly",
      interval: 1,
      weekdays: [1],
      until: "2026-12-14",
    });
    const payload = calendarCreatePayload(item);
    assert.deepEqual(payload.recurrenceRule?.daysOfTheWeek, [{ dayOfTheWeek: 2 }]);
    assert.equal(payload.recurrenceRule?.frequency, "weekly");
    assert.equal(payload.recurrenceRule?.endDate?.toISOString(), "2026-12-15T04:59:00.000Z");
    assert.match(payload.url, /^homa:\/\/planner\?source=family-event%2Fevent-1$/);
    assert.match(payload.notes, /Homa planner link/);
  });

  it("exports an occurrence from the canonical series start", () => {
    const item = familyEventExportItem(
      {
        ...FAMILY_EVENT,
        starts_on: "2026-11-09",
        ends_on: "2026-11-09",
        series_starts_on: "2026-11-02",
        series_ends_on: "2026-11-02",
      },
      "Maya",
      "America/New_York",
      { frequency: "weekly", interval: 1, weekdays: [1], until: null },
    );
    assert.equal(item.startsOn, "2026-11-02");
    assert.equal(item.endsOn, "2026-11-02");
  });

  it("rejects invalid recurrence rather than sending a malformed native event", () => {
    const item = familyEventExportItem(FAMILY_EVENT, "Maya", "America/New_York", {
      frequency: "weekly",
      interval: 0,
      weekdays: [1],
      until: null,
    });
    assert.throws(() => calendarCreatePayload(item), /positive whole number/);
    assert.throws(
      () => calendarCreatePayload({
        ...item,
        recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 1], until: null },
      }),
      /unique values/,
    );
  });

  it("gives retries the same fingerprint until the source changes", () => {
    const item = familyEventExportItem(FAMILY_EVENT, "Maya", "America/New_York");
    assert.equal(calendarExportFingerprint(item), calendarExportFingerprint({ ...item }));
    assert.notEqual(calendarExportFingerprint(item), calendarExportFingerprint({ ...item, title: "Co-op moved" }));
  });

  it("uses the schedule row as the stable source for plan activities", () => {
    const item = planActivityExportItem(
      {
        scheduleId: "schedule-9",
        scheduledDate: "2026-08-03",
        childId: "child-1",
        childIndex: 0,
        childName: "Maya",
        subjectId: "math",
        subjectName: "Math",
        week: 2,
        activityIndex: 3,
        text: "Fraction picnic",
        done: false,
      },
      "America/New_York",
    );
    assert.equal(item.sourceKey, "plan-schedule/schedule-9");
    assert.equal(item.childScope, "Maya");
    assert.equal(calendarCreatePayload(item).allDay, true);
  });
});
