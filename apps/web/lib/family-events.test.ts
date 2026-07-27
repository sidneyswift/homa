import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFamilyEventInput } from "./family-events";

/**
 * parseFamilyEventInput (issue #176, CG-03): the one validation gate
 * shared by the caller and pinned write paths, so a bad appointment
 * (backwards date range, a garbled time) can never reach a query no
 * matter which channel Homa heard it on.
 */

describe("parseFamilyEventInput", () => {
  it("accepts a single-day, all-day event with just a title and date", () => {
    const result = parseFamilyEventInput({ title: "Co-op day", startsOn: "2026-08-04" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      title: "Co-op day",
      startsOn: "2026-08-04",
      endsOn: "2026-08-04",
      startTime: null,
      endTime: null,
      note: null,
    });
  });

  it("keeps an explicit multi-day range for a trip", () => {
    const result = parseFamilyEventInput({
      title: "Camping trip",
      startsOn: "2026-08-05",
      endsOn: "2026-08-09",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.startsOn, "2026-08-05");
    assert.equal(result.value.endsOn, "2026-08-09");
  });

  it("keeps a start and end time for a doctor's appointment", () => {
    const result = parseFamilyEventInput({
      title: "Doctor's appt",
      startsOn: "2026-08-04",
      startTime: "14:00",
      endTime: "15:00",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.startTime, "14:00");
    assert.equal(result.value.endTime, "15:00");
  });

  it("trims and caps an overlong title", () => {
    const result = parseFamilyEventInput({
      title: `  ${"x".repeat(250)}  `,
      startsOn: "2026-08-04",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.title.length, 200);
  });

  it("rejects a blank title", () => {
    const result = parseFamilyEventInput({ title: "   ", startsOn: "2026-08-04" });
    assert.equal(result.ok, false);
  });

  it("rejects a malformed start date", () => {
    const result = parseFamilyEventInput({ title: "Trip", startsOn: "not-a-date" });
    assert.equal(result.ok, false);
  });

  it("rejects an end date before the start date", () => {
    const result = parseFamilyEventInput({
      title: "Trip",
      startsOn: "2026-08-09",
      endsOn: "2026-08-05",
    });
    assert.equal(result.ok, false);
  });

  it("rejects a malformed time of day", () => {
    const result = parseFamilyEventInput({
      title: "Appt",
      startsOn: "2026-08-04",
      startTime: "2pm",
    });
    assert.equal(result.ok, false);
  });

  it("rejects an end time before the start time on the same day", () => {
    const result = parseFamilyEventInput({
      title: "Appt",
      startsOn: "2026-08-04",
      startTime: "15:00",
      endTime: "14:00",
    });
    assert.equal(result.ok, false);
  });

  it("allows an end time earlier in the clock when the event spans multiple days", () => {
    // "8am to 5pm each day" written as one range: the same-day guard must
    // not misfire across a real multi-day span.
    const result = parseFamilyEventInput({
      title: "Camp",
      startsOn: "2026-08-04",
      endsOn: "2026-08-08",
      startTime: "17:00",
      endTime: "08:00",
    });
    assert.equal(result.ok, true);
  });

  it("drops an empty note to null and caps an overlong one", () => {
    const blank = parseFamilyEventInput({ title: "Trip", startsOn: "2026-08-04", note: "   " });
    assert.equal(blank.ok, true);
    if (blank.ok) assert.equal(blank.value.note, null);

    const long = parseFamilyEventInput({
      title: "Trip",
      startsOn: "2026-08-04",
      note: "y".repeat(600),
    });
    assert.equal(long.ok, true);
    if (long.ok) assert.equal(long.value.note?.length, 500);
  });
});
