import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateFamilyHistory,
  generatedSubjectsAreValid,
  HISTORY_PROFILES,
  HISTORY_PROFILE_SHAPES,
  seededRandom,
} from "./family-history-fixture";

/**
 * The family time machine's guarantees (gh#343): deterministic output,
 * schema-legal rows, and history that actually accumulates with the
 * profile. Pure module, so none of this needs a database.
 */

const AS_OF = new Date("2026-07-28T00:00:00Z");

describe("seededRandom", () => {
  it("is deterministic for a seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = [a(), a(), a()];
    const second = [b(), b(), b()];
    assert.deepEqual(first, second);
  });
  it("differs across seeds", () => {
    assert.notEqual(seededRandom(1)(), seededRandom(2)());
  });
});

describe("generateFamilyHistory", () => {
  it("is reproducible: same inputs, identical history", () => {
    const one = generateFamilyHistory({ profile: "month6", childCount: 2, asOf: AS_OF });
    const two = generateFamilyHistory({ profile: "month6", childCount: 2, asOf: AS_OF });
    assert.deepEqual(one.hours, two.hours);
    assert.deepEqual(one.totals, two.totals);
  });

  it("accumulates with the profile", () => {
    const totals = HISTORY_PROFILES.map(
      (profile) =>
        generateFamilyHistory({ profile, childCount: 2, asOf: AS_OF }).totals.minutes,
    );
    for (let index = 1; index < totals.length; index += 1) {
      assert.ok(
        totals[index] > totals[index - 1],
        `${HISTORY_PROFILES[index]} (${totals[index]}) must exceed ${HISTORY_PROFILES[index - 1]} (${totals[index - 1]})`,
      );
    }
    // A school year should read like one: hundreds of hours, not dozens.
    const year = totals[totals.length - 1] / 60;
    assert.ok(year > 200 && year < 1200, `a year came to ${Math.round(year)} hours`);
  });

  for (const profile of HISTORY_PROFILES) {
    it(`${profile}: emits only schema-legal rows`, () => {
      const history = generateFamilyHistory({ profile, childCount: 3, asOf: AS_OF });
      assert.ok(generatedSubjectsAreValid(history));
      for (const row of history.hours) {
        // migration #37: minutes between 1 and 600, and a real source.
        assert.ok(row.minutes >= 1 && row.minutes <= 600, `minutes ${row.minutes}`);
        assert.ok(["chat", "sms", "call"].includes(row.source));
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.happenedOn));
        assert.ok(row.note.length <= 200);
        assert.ok(
          row.childIndex === null || (row.childIndex >= 0 && row.childIndex < 3),
        );
      }
    });

    it(`${profile}: never emits a row the unique block index would reject`, () => {
      // (family, subject, minutes, day, coalesce(child, zero-uuid)) is
      // unique and fails closed, so a seeder that emits a duplicate dies
      // halfway and leaves a half-built family.
      const history = generateFamilyHistory({ profile, childCount: 2, asOf: AS_OF });
      const keys = history.hours.map(
        (row) =>
          `${row.happenedOn}:${row.subject}:${row.minutes}:${row.childIndex ?? "family"}`,
      );
      assert.equal(new Set(keys).size, keys.length, "duplicate hours row emitted");
    });
  }

  it("ends at the reference date and stays inside its window", () => {
    const history = generateFamilyHistory({ profile: "month3", childCount: 1, asOf: AS_OF });
    const dates = history.hours.map((row) => row.happenedOn).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    assert.ok(latest <= "2026-07-28", `latest ${latest} is in the future`);
    assert.ok(earliest >= "2026-04-01", `earliest ${earliest} predates the window`);
  });

  it("logs no weekends", () => {
    const history = generateFamilyHistory({ profile: "month6", childCount: 2, asOf: AS_OF });
    for (const row of history.hours) {
      const day = new Date(`${row.happenedOn}T00:00:00Z`).getUTCDay();
      assert.ok(day !== 0 && day !== 6, `${row.happenedOn} is a weekend`);
    }
  });

  it("leaves the profile's quiet weeks genuinely quiet", () => {
    // Gaps are the point: honest-gap copy and reconstruction prompts
    // need a real empty stretch to meet.
    const history = generateFamilyHistory({ profile: "year1", childCount: 2, asOf: AS_OF });
    const logged = new Set(history.hours.map((row) => row.happenedOn));
    let longestGap = 0;
    let current = 0;
    for (let offset = 0; offset < 360; offset += 1) {
      const date = new Date(AS_OF.getTime() - offset * 86_400_000);
      const day = date.getUTCDay();
      if (day === 0 || day === 6) continue;
      if (logged.has(date.toISOString().slice(0, 10))) {
        current = 0;
      } else {
        current += 1;
        longestGap = Math.max(longestGap, current);
      }
    }
    assert.ok(
      longestGap >= 4,
      `expected a real quiet stretch, longest was ${longestGap} school days`,
    );
  });

  it("counts family-wide rows separately from per-child rows", () => {
    const history = generateFamilyHistory({ profile: "month6", childCount: 2, asOf: AS_OF });
    const perChild = history.totals.perChildMinutes.reduce((a, b) => a + b, 0);
    assert.equal(perChild + history.totals.familyWideMinutes, history.totals.minutes);
    assert.ok(
      history.totals.familyWideMinutes > 0,
      "a family-wide row counts for every child and must appear",
    );
  });

  it("carries a label and memories that grow with the window", () => {
    const short = generateFamilyHistory({ profile: "month1", childCount: 2, asOf: AS_OF });
    const long = generateFamilyHistory({ profile: "year1", childCount: 2, asOf: AS_OF });
    assert.equal(short.shape.label, HISTORY_PROFILE_SHAPES.month1.label);
    assert.ok(long.memories.length >= short.memories.length);
    for (const memory of long.memories) {
      assert.ok(memory.content.length <= 500);
      assert.ok(["fact", "what_works", "daily_note"].includes(memory.kind));
    }
  });
});
