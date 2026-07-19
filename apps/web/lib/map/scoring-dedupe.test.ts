import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_BANK_VERSION, MAP_SCORER_VERSION, scoreMap, type MapScores } from "@homa/core";

import {
  DUPLICATE_SCORING_WINDOW_MS,
  isDuplicateScoring,
  jsonDeepEqual,
  type NextScoring,
  type PriorScoring,
} from "./scoring-dedupe";

/** jsonb does not preserve object key order; a stored row never comes
 * back with the serializer's ordering. This rebuilds every object with
 * reversed key order to prove the comparison is structural. */
function reorderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    return Object.fromEntries(entries.map(([key, child]) => [key, reorderKeys(child)]));
  }
  return value;
}

const AGE_MONTHS = 60;

function freshScores(): MapScores {
  return scoreMap(AGE_MONTHS, []);
}

function prior(overrides: Partial<PriorScoring> = {}): PriorScoring {
  return {
    scores: reorderKeys(freshScores()) as MapScores,
    generatedAgeMs: 500,
    bankVersion: MAP_BANK_VERSION,
    scorerVersion: MAP_SCORER_VERSION,
    scoredAgeMonths: AGE_MONTHS,
    ...overrides,
  };
}

function next(overrides: Partial<NextScoring> = {}): NextScoring {
  return {
    scores: freshScores(),
    bankVersion: MAP_BANK_VERSION,
    scorerVersion: MAP_SCORER_VERSION,
    ageMonths: AGE_MONTHS,
    ...overrides,
  };
}

describe("jsonDeepEqual", () => {
  it("treats key order as irrelevant, matching jsonb round-trips", () => {
    const scores = freshScores();
    assert.equal(jsonDeepEqual(scores, reorderKeys(scores)), true);
  });

  it("keeps array order significant", () => {
    assert.equal(jsonDeepEqual([1, 2], [2, 1]), false);
  });

  it("rejects a missing key even when lengths differ elsewhere", () => {
    assert.equal(jsonDeepEqual({ a: 1, b: 2 }, { a: 1, c: 2 }), false);
    assert.equal(jsonDeepEqual({ a: 1 }, { a: 1, b: 2 }), false);
  });

  it("rejects same-shape different values", () => {
    assert.equal(jsonDeepEqual({ a: 1 }, { a: "1" }), false);
  });
});

describe("isDuplicateScoring", () => {
  it("flags the observed production shape: same numbers, well under a second apart", () => {
    assert.equal(isDuplicateScoring(prior({ generatedAgeMs: 90 }), next()), true);
  });

  it("survives jsonb key reordering of the stored scores", () => {
    assert.equal(isDuplicateScoring(prior(), next()), true);
  });

  it("lets a same-numbers scoring through once the window has passed", () => {
    assert.equal(
      isDuplicateScoring(prior({ generatedAgeMs: DUPLICATE_SCORING_WINDOW_MS + 1 }), next()),
      false,
    );
  });

  it("never dedupes changed numbers, however close in time", () => {
    const changed = freshScores() as unknown as { observationCount: number };
    changed.observationCount += 1;
    assert.equal(
      isDuplicateScoring(prior({ generatedAgeMs: 90 }), next({ scores: changed as unknown as MapScores })),
      false,
    );
  });

  it("never dedupes across a bank, scorer, or age change (a new ruler is a real rescore)", () => {
    assert.equal(isDuplicateScoring(prior({ bankVersion: "old-bank" }), next()), false);
    assert.equal(isDuplicateScoring(prior({ scorerVersion: null }), next()), false);
    assert.equal(isDuplicateScoring(prior({ scoredAgeMonths: AGE_MONTHS + 1 }), next()), false);
  });

  it("treats an unreadable row age as not a duplicate", () => {
    assert.equal(isDuplicateScoring(prior({ generatedAgeMs: Number.NaN }), next()), false);
  });

  it("tolerates a slightly-future generated_at (same-instant writes on either side of now)", () => {
    assert.equal(isDuplicateScoring(prior({ generatedAgeMs: -50 }), next()), true);
  });
});
