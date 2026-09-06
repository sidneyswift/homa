import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hoursEditContextSchema, hoursMutationError, hoursNoteCharacterCount, recordedTimeAudience, type HoursEditContext } from "./hours-edit";
import { recordedHoursForDate, type HoursEntry } from "./hours-view";

const first = "a0000000-0000-4000-8000-000000000001";
const second = "a0000000-0000-4000-8000-000000000002";
const entry: HoursEntry = { id: first, childId: first, childName: "Avery", subject: "math", customLabel: null,
  minutes: 11, happenedOn: "2026-09-06", source: "chat", note: "The full recorded note" };
const context: HoursEditContext = { result: "ready", revision: "a".repeat(32), entry,
  activity: { id: second, title: "Shared activity", note: "Separate Planner note",
    children: [{ id: first, name: "Avery" }, { id: second, name: "Alexandria Clementine Montgomery-Swift" }], hoursEntryIds: [first, second] } };

describe("recorded-time edit scope", () => {
  it("names every participant even when the entry is one child's row", () => {
    assert.equal(recordedTimeAudience(context), "Avery and Alexandria Clementine Montgomery-Swift");
    assert.equal(recordedTimeAudience({ ...context, activity: { ...context.activity!, children: [] } }), "the whole family");
    assert.equal(recordedTimeAudience({ ...context, activity: null }), "Avery");
  });
  it("Day and Week filter by recorded day, keeping shared family rows but excluding sibling-only rows", () => {
    const rows = [entry, { ...entry, id: second, childId: second }, { ...entry, id: "family", childId: null }, { ...entry, id: "tomorrow", happenedOn: "2026-09-07" }];
    assert.deepEqual(recordedHoursForDate(rows, "2026-09-06", first).map((row) => row.id), [first, "family"]);
    assert.equal(recordedHoursForDate(rows, "2026-09-06", null).length, 3);
  });
  it("requires authenticated record identity and a revision before the editor can write", () => {
    assert.equal(hoursEditContextSchema.safeParse(context).success, true);
    assert.equal(hoursEditContextSchema.safeParse({ ...context, revision: null }).success, false);
    assert.equal(hoursEditContextSchema.safeParse({ ...context, entry: { ...entry, id: "foreign-looking-label" } }).success, false);
  });
  it("counts saved note characters consistently with Unicode PostgreSQL limits", () => {
    assert.equal(hoursNoteCharacterCount("  🧡🧡  "), 2);
    assert.equal(hoursNoteCharacterCount("🧡".repeat(200)), 200);
    assert.equal(hoursNoteCharacterCount("🧡".repeat(201)), 201);
  });
  it("explains malformed links without implying a review or automatic repair", () => {
    const error = hoursMutationError({ result: "conflict", reason: "link-shape" })!;
    assert.match(error, /^Nothing changed\. Homa couldn't update this shared activity's recorded time\./u);
    assert.match(error, /Close this editor and refresh/u);
    assert.doesNotMatch(error, /needs a review|Ask Homa/u);
  });
  it("never treats a missing or failed receipt as success", () => {
    for (const receipt of [null, [], {}, { result: "not_found" }, { result: "invalid" }, { result: "conflict", reason: "stale" }]) {
      assert.equal(typeof hoursMutationError(receipt), "string");
    }
    assert.equal(hoursMutationError({ result: "applied" }), null);
    assert.match(hoursMutationError(null)!, /Close this editor and reopen the time record/u);
    assert.match(hoursMutationError(null, "planner")!, /Reopen the activity/u);
    assert.doesNotMatch(hoursMutationError(null, "planner")!, /reopen the time record/iu);
    for (const receipt of [{ result: "not_found" }, { result: "conflict", reason: "stale" }]) {
      assert.match(hoursMutationError(receipt, "planner")!, /activity/u);
      assert.doesNotMatch(hoursMutationError(receipt, "planner")!, /time record/u);
    }
  });
});
