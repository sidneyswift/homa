import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ALL_HOURS_RECORDS, deriveRecordedLearningDays, hoursRecordChildLabel, hoursRecordParams, matchesHoursRecordScope, parseHoursRecordRequest, summarizeRecordedLearningDays } from "./hours-record-scope";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const children = [{ id: A, name: "Same" }, { id: B, name: "Same" }];
const entries = [
  { childId: A, happenedOn: "2026-09-01", minutes: 20, subject: "math" },
  { childId: A, happenedOn: "2026-09-01", minutes: 7, subject: "reading" },
  { childId: B, happenedOn: "2026-09-01", minutes: 30, subject: "reading" },
  { childId: null, happenedOn: "2026-09-02", minutes: 10, subject: "art" },
];

describe("visible Hours child identity", () => {
  it("only disambiguates matching names and keeps the saved names untouched", () => {
    assert.equal(hoursRecordChildLabel(children[0], children), "Same (record 111111)");
    assert.equal(hoursRecordChildLabel(children[1], children), "Same (record 222222)");
    assert.equal(hoursRecordChildLabel({ id: A, name: "Renamed" }, [{ id: A, name: "Renamed" }, children[1]]), "Renamed");
    assert.equal(children[0].name, "Same");
  });
  it("extends colliding suffixes and handles case/space variants without changing names", () => {
    const sameSuffix = [{ id: "11111111-1111-4111-8111-111111111111", name: "Same" }, { id: "22222222-2222-4222-8222-211111111111", name: " same " }];
    const labels = sameSuffix.map((child) => hoursRecordChildLabel(child, sameSuffix));
    assert.notEqual(labels[0], labels[1]);
    assert.ok(labels[0].includes("111111111111") && labels[1].includes("211111111111"));
    assert.equal(hoursRecordChildLabel(sameSuffix[0], [...sameSuffix].reverse()), labels[0]);
  });
});

describe("explicit Hours record scope", () => {
  it("normalizes the spelling of an otherwise valid UUID before exact ownership matching", () => {
    const id = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
    assert.equal(parseHoursRecordRequest(new URLSearchParams({ child: id.toUpperCase() }))?.scope.childId, id);
  });
  it("preserves full history including future entries when no bounds are supplied", () => {
    assert.deepEqual(parseHoursRecordRequest(new URLSearchParams())?.scope, ALL_HOURS_RECORDS);
    assert.equal(matchesHoursRecordScope({ childId: A, happenedOn: "2099-01-01" }, ALL_HOURS_RECORDS), true);
  });
  it("round-trips one owned-child scope without converting calendar days to instants", () => {
    const scope = { childId: A, from: "2024-02-29", through: "2026-09-01", includeShared: false };
    assert.deepEqual(parseHoursRecordRequest(hoursRecordParams(scope))?.scope, scope);
  });
  for (const query of ["child=bad", "from=2026-02-29", "from=2026-13-01", "through=2026-09-31", "from=2026-09-01T00:00:00Z", "from=2026-09-02&through=2026-09-01", "shared=maybe", "format=pdf", "child=&child=" , "revision=bad", "familyId=other"]) {
    it(`rejects invalid or ambiguous input: ${query}`, () => {
      assert.equal(parseHoursRecordRequest(new URLSearchParams(query)), null);
    });
  }
  it("includes both boundary dates and only the selected child plus explicit shared time", () => {
    const scope = { childId: A, from: "2026-09-01", through: "2026-09-02", includeShared: true };
    assert.deepEqual(entries.filter((row) => matchesHoursRecordScope(row, scope)), [entries[0], entries[1], entries[3]]);
    assert.equal(matchesHoursRecordScope({ childId: A, happenedOn: "2026-08-31" }, scope), false);
    assert.equal(matchesHoursRecordScope({ childId: A, happenedOn: "2026-09-03" }, scope), false);
    assert.deepEqual(entries.filter((row) => matchesHoursRecordScope(row, { ...scope, includeShared: false })), [entries[0], entries[1]]);
  });
});

describe("recorded learning days use identity", () => {
  it("keeps duplicate names separate and counts repeated activities once per date", () => {
    const days = deriveRecordedLearningDays(entries, children);
    assert.equal(days.length, 4);
    assert.deepEqual(summarizeRecordedLearningDays(days, children), [
      { childId: A, childName: "Same", recordedDays: 2, minutes: 37 },
      { childId: B, childName: "Same", recordedDays: 2, minutes: 40 },
    ]);
    assert.deepEqual(days[0].subjects, ["math", "reading"]);
  });
  it("renaming changes labels without changing recorded days or minutes", () => {
    const renamed = [{ id: A, name: "Renamed" }, children[1]];
    const result = summarizeRecordedLearningDays(deriveRecordedLearningDays(entries, renamed), renamed);
    assert.deepEqual(result[0], { childId: A, childName: "Renamed", recordedDays: 2, minutes: 37 });
  });
  it("shared inclusion matches selected-child entries and days", () => {
    const scope = { ...ALL_HOURS_RECORDS, childId: A };
    assert.equal(deriveRecordedLearningDays(entries, children, scope).length, 2);
    assert.deepEqual(summarizeRecordedLearningDays(deriveRecordedLearningDays(entries, children, { ...scope, includeShared: false }), children, scope), [
      { childId: A, childName: "Same", recordedDays: 1, minutes: 27 },
    ]);
  });
  it("no children means shared family records, with no inferred child", () => {
    const days = deriveRecordedLearningDays([entries[3]], []);
    assert.deepEqual(summarizeRecordedLearningDays(days, []), [{ childId: null, childName: "Whole family", recordedDays: 1, minutes: 10 }]);
  });
  it("empty records produce zero recorded days, not attendance or absence", () => {
    assert.deepEqual(summarizeRecordedLearningDays([], children).map((row) => row.recordedDays), [0, 0]);
  });
  it("never guesses a missing child by display name or accepts a foreign selection", () => {
    assert.throws(() => deriveRecordedLearningDays(entries, [children[0]]), /no owned child/);
    assert.throws(() => deriveRecordedLearningDays([], [children[0]], { ...ALL_HOURS_RECORDS, childId: B }), /not in/);
    assert.throws(() => deriveRecordedLearningDays([], [children[0], children[0]]), /Duplicate/);
  });
});
