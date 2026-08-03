import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyFamilyEventPatch,
  expandRecurringFamilyEvents,
  familyEventChildIds,
  familyEventPatchIsEmpty,
  MAX_EVENT_WINDOW_DAYS,
  parseFamilyEventInput,
  parseFamilyEventRecurrence,
  resolveEventWindow,
} from "./family-events";

describe("family event recurrence", () => {
  it("normalizes a valid weekly series", () => {
    assert.deepEqual(
      parseFamilyEventRecurrence(
        { frequency: "weekly", interval: 1, weekdays: [4, 2], until: "2026-12-31" },
        "2026-08-04",
      ),
      {
        ok: true,
        value: { frequency: "weekly", interval: 1, weekdays: [2, 4], until: "2026-12-31" },
      },
    );
  });

  it("rejects duplicate weekdays and an end before the series starts", () => {
    assert.equal(
      parseFamilyEventRecurrence(
        { frequency: "weekly", interval: 1, weekdays: [2, 2], until: null },
        "2026-08-04",
      ).ok,
      false,
    );
    assert.equal(
      parseFamilyEventRecurrence(
        { frequency: "weekly", interval: 1, weekdays: [2], until: "2026-08-01" },
        "2026-08-04",
      ).ok,
      false,
    );
  });

  it("expands only the occurrences inside the requested window", () => {
    const events = expandRecurringFamilyEvents(
      [
        {
          id: "event-1",
          familyId: "family-1",
          childId: null,
          childIds: [],
          title: "Co-op",
          startsOn: "2026-08-03",
          endsOn: "2026-08-03",
          startTime: "09:00",
          endTime: "12:00",
          note: null,
          recurrence: {
            frequency: "weekly",
            interval: 1,
            weekdays: [1],
            until: "2026-08-31",
          },
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      "2026-08-10",
      "2026-08-16",
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].startsOn, "2026-08-10");
    assert.equal(events[0].seriesStartsOn, "2026-08-03");
    assert.equal(events[0].occurrenceKey, "event-1:2026-08-10");
  });
});

describe("family event child audience", () => {
  it("uses all consistent links and falls back to the legacy marker", () => {
    assert.deepEqual(
      familyEventChildIds({ childId: "child-a", childIds: ["child-a", "child-b"] }),
      ["child-a", "child-b"],
    );
    assert.deepEqual(familyEventChildIds({ childId: "child-b", childIds: ["child-a"] }), ["child-b"]);
    assert.deepEqual(familyEventChildIds({ childId: null, childIds: ["stale-link"] }), []);
  });
});

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
      recurrence: null,
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

/**
 * The list_family_events read window (issue #257, arc PR B0): look-back
 * became legal (a Tuesday reshuffle must see Monday), so the clamp is
 * what keeps a wild date from turning one read into a scan of years.
 */
describe("resolveEventWindow", () => {
  const today = "2026-07-27";

  it("defaults to today plus daysAhead", () => {
    assert.deepEqual(resolveEventWindow({ today, daysAhead: 30 }), {
      ok: true,
      fromDate: "2026-07-27",
      toDate: "2026-08-26",
      clamped: false,
    });
  });

  it("allows a from in the past (the mid-week look-back)", () => {
    const window = resolveEventWindow({ today, from: "2026-07-21", to: "2026-07-27" });
    assert.deepEqual(window, {
      ok: true,
      fromDate: "2026-07-21",
      toDate: "2026-07-27",
      clamped: false,
    });
  });

  it("extends from alone by daysAhead", () => {
    const window = resolveEventWindow({ today, daysAhead: 7, from: "2026-07-20" });
    assert.deepEqual(window, {
      ok: true,
      fromDate: "2026-07-20",
      toDate: "2026-07-27",
      clamped: false,
    });
  });

  it("accepts to alone as today-to-then", () => {
    const window = resolveEventWindow({ today, to: "2026-08-15" });
    assert.deepEqual(window, {
      ok: true,
      fromDate: "2026-07-27",
      toDate: "2026-08-15",
      clamped: false,
    });
  });

  it("clamps a window wider than the cap", () => {
    const window = resolveEventWindow({ today, from: "2026-01-01", to: "2026-12-31" });
    assert.equal(window.ok, true);
    if (!window.ok) return;
    assert.equal(window.fromDate, "2026-01-01");
    assert.equal(window.clamped, true);
    // 2026-01-01 plus 120 days.
    assert.equal(window.toDate, "2026-05-01");
  });

  it("keeps a window of exactly the cap unclamped", () => {
    const window = resolveEventWindow({ today, from: "2026-01-01", to: "2026-05-01" });
    assert.equal(window.ok, true);
    if (!window.ok) return;
    assert.equal(window.clamped, false);
    assert.equal(window.toDate, "2026-05-01");
    assert.equal(MAX_EVENT_WINDOW_DAYS, 120);
  });

  it("rejects a backwards window and malformed dates", () => {
    assert.equal(resolveEventWindow({ today, from: "2026-08-10", to: "2026-08-01" }).ok, false);
    assert.equal(resolveEventWindow({ today, from: "next week" }).ok, false);
    assert.equal(resolveEventWindow({ today, to: "soon" }).ok, false);
  });
});

/**
 * update_family_event's merge (issue #257, arc PR B0): a patch merges
 * onto the stored event and revalidates through parseFamilyEventInput,
 * so an update can never produce a shape an add would have refused.
 */
describe("applyFamilyEventPatch", () => {
  const existing = {
    title: "Camping trip",
    startsOn: "2026-08-05",
    endsOn: "2026-08-09",
    startTime: "09:00" as string | null,
    endTime: "17:00" as string | null,
    note: "Pack the tent" as string | null,
  };

  it("retitles without touching dates or times", () => {
    const result = applyFamilyEventPatch(existing, { title: "Lake trip" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      title: "Lake trip",
      startsOn: "2026-08-05",
      endsOn: "2026-08-09",
      startTime: "09:00",
      endTime: "17:00",
      note: "Pack the tent",
      recurrence: null,
    });
  });

  it("moves startsOn alone and keeps the event's length", () => {
    const result = applyFamilyEventPatch(existing, { startsOn: "2026-08-12" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.startsOn, "2026-08-12");
    // Five days long before, five days long after.
    assert.equal(result.value.endsOn, "2026-08-16");
  });

  it("moves a single-day event as a single day", () => {
    const appt = { ...existing, startsOn: "2026-08-04", endsOn: "2026-08-04" };
    const result = applyFamilyEventPatch(appt, { startsOn: "2026-08-06" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.startsOn, "2026-08-06");
    assert.equal(result.value.endsOn, "2026-08-06");
  });

  it("moves backwards in time too", () => {
    const result = applyFamilyEventPatch(existing, { startsOn: "2026-08-01" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.endsOn, "2026-08-05");
  });

  it("honors an explicit endsOn over the length-preserving shift", () => {
    const result = applyFamilyEventPatch(existing, {
      startsOn: "2026-08-12",
      endsOn: "2026-08-13",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.endsOn, "2026-08-13");
  });

  it("clears a time with null and keeps it when omitted", () => {
    const cleared = applyFamilyEventPatch(existing, { startTime: null, endTime: null });
    assert.equal(cleared.ok, true);
    if (cleared.ok) {
      assert.equal(cleared.value.startTime, null);
      assert.equal(cleared.value.endTime, null);
    }
    const kept = applyFamilyEventPatch(existing, { title: "Still camping" });
    assert.equal(kept.ok, true);
    if (kept.ok) assert.equal(kept.value.startTime, "09:00");
  });

  it("rejects a merge that add would have refused", () => {
    // New end date lands before the (unmoved) start date.
    assert.equal(applyFamilyEventPatch(existing, { endsOn: "2026-08-01" }).ok, false);
    // Malformed date never reaches the day-shift arithmetic.
    assert.equal(applyFamilyEventPatch(existing, { startsOn: "next Tuesday" }).ok, false);
    // Backwards times on a single-day event.
    const appt = { ...existing, startsOn: "2026-08-04", endsOn: "2026-08-04" };
    assert.equal(
      applyFamilyEventPatch(appt, { startTime: "15:00", endTime: "14:00" }).ok,
      false,
    );
  });

  it("knows an empty patch when it sees one", () => {
    assert.equal(familyEventPatchIsEmpty({}), true);
    assert.equal(familyEventPatchIsEmpty({ title: "X" }), false);
    assert.equal(familyEventPatchIsEmpty({ startTime: null }), false);
  });
});
