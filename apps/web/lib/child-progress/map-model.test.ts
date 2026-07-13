import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MapScores } from "@homa/core";

import {
  buildProgressTiles,
  progressUpdatedLine,
} from "./map-model";
import type {
  ChildProgressView,
  ProgressSubjectView,
} from "./types";

const NOW = new Date("2026-07-12T18:00:00.000Z");

function subjectView(
  overrides: Partial<ProgressSubjectView> & { subjectId: string },
): ProgressSubjectView {
  return {
    displayName: overrides.subjectId,
    evidenceCount: 1,
    latestObservedAt: "2026-07-10T12:00:00.000000Z",
    state: "older",
    summary: null,
    domains: [],
    ...overrides,
  };
}

function scores(
  subjects: Partial<MapScores["subjects"][number]>[],
  strengthOrder: string[],
): MapScores {
  return {
    subjects: subjects.map((subject) => ({
      subjectId: "math",
      position: "ahead",
      monthsAhead: 8,
      frontierDeltaMonths: 8,
      beyondScale: false,
      highConfidence: true,
      observations: 3,
      strongestObservedStatement: null,
      strongestObservedMonths: null,
      frontierStatement: null,
      exposureBased: false,
      ...subject,
    })),
    strengthOrder,
    mappedCount: subjects.length,
    totalSubjects: 16,
    observationCount: 5,
  };
}

function view(
  subjects: ProgressSubjectView[],
  mapScores: MapScores,
): ChildProgressView {
  return {
    childId: "child-1",
    childName: "Maya",
    birthDate: "2022-03-14",
    timeZone: "America/Los_Angeles",
    projectedAt: "2026-07-12T16:00:00.000Z",
    scores: mapScores,
    subjects,
    conflicts: [],
  };
}

describe("buildProgressTiles", () => {
  it("orders tiles strongest first with unscored subjects after", () => {
    const tiles = buildProgressTiles(
      view(
        [
          subjectView({ subjectId: "self_care", displayName: "Self-care" }),
          subjectView({ subjectId: "math", displayName: "Math" }),
          subjectView({ subjectId: "literacy", displayName: "Literacy" }),
        ],
        scores(
          [{ subjectId: "literacy" }, { subjectId: "math" }],
          ["literacy", "math"],
        ),
      ),
      undefined,
      NOW,
    );

    assert.deepEqual(
      tiles.map((tile) => tile.subjectId),
      ["literacy", "math", "self_care"],
    );
  });

  it("reuses core's reviewed badge vocabulary and kidPill tones", () => {
    const tiles = buildProgressTiles(
      view(
        [
          subjectView({ subjectId: "math" }),
          subjectView({ subjectId: "literacy" }),
          subjectView({ subjectId: "science" }),
          subjectView({ subjectId: "art" }),
        ],
        scores(
          [
            { subjectId: "math", position: "ahead", monthsAhead: 8 },
            { subjectId: "literacy", position: "on_track", monthsAhead: 0 },
            { subjectId: "science", position: "growing", monthsAhead: null },
            { subjectId: "art", position: "not_mapped", monthsAhead: null },
          ],
          ["math", "literacy", "science"],
        ),
      ),
      undefined,
      NOW,
    );

    const byId = new Map(tiles.map((tile) => [tile.subjectId, tile]));
    assert.equal(byId.get("math")?.badge?.label, "Ahead \u00b7 +8 mo");
    assert.equal(byId.get("math")?.badge?.background, "var(--gold-100)");
    assert.equal(byId.get("literacy")?.badge?.label, "On track");
    assert.equal(
      byId.get("science")?.badge?.label,
      "Growing right now",
    );
    assert.equal(byId.get("science")?.badge?.color, "var(--sky-600)");
    // Unmapped subjects carry no verdict at all.
    assert.equal(byId.get("art")?.badge, null);
  });

  it("shows positive movement only, from the prior scoring", () => {
    const current = scores(
      [
        { subjectId: "math", monthsAhead: 8 },
        { subjectId: "literacy", position: "on_track", monthsAhead: 2 },
      ],
      ["math", "literacy"],
    );
    const prior = scores(
      [
        { subjectId: "math", monthsAhead: 7 },
        { subjectId: "literacy", position: "on_track", monthsAhead: 3 },
      ],
      ["math", "literacy"],
    );
    const tiles = buildProgressTiles(
      view(
        [
          subjectView({ subjectId: "math" }),
          subjectView({ subjectId: "literacy" }),
        ],
        current,
      ),
      { scores: prior, generated_at: "2026-06-10T16:00:00.000Z" },
      NOW,
    );

    assert.equal(tiles[0].movement?.label, "+1 mo since Jun 10");
    // The literacy drop renders nothing (anti-guilt law).
    assert.equal(tiles[1].movement, null);
  });

  it("labels freshness as today, a dated update, or a quiet stretch", () => {
    const tiles = buildProgressTiles(
      view(
        [
          subjectView({
            subjectId: "math",
            state: "updated_recently",
            latestObservedAt: "2026-07-12T15:00:00.000000Z",
          }),
          subjectView({
            subjectId: "literacy",
            latestObservedAt: "2026-07-05T12:00:00.000000Z",
          }),
          subjectView({
            subjectId: "science",
            latestObservedAt: "2026-05-20T12:00:00.000000Z",
          }),
          subjectView({
            subjectId: "art",
            latestObservedAt: null,
          }),
        ],
        scores([], []),
      ),
      undefined,
      NOW,
    );

    assert.deepEqual(tiles[0].freshness, {
      kind: "today",
      label: "Updated today",
    });
    assert.deepEqual(tiles[1].freshness, {
      kind: "recent",
      label: "Updated Jul 5, 2026",
    });
    assert.deepEqual(tiles[2].freshness, {
      kind: "quiet",
      label: "Updated May 20, 2026",
    });
    assert.equal(tiles[3].freshness, null);
  });

  it("flags subjects holding an open conflict", () => {
    const tiles = buildProgressTiles(
      view(
        [
          subjectView({ subjectId: "math", state: "conflict" }),
          subjectView({ subjectId: "literacy" }),
        ],
        scores([], []),
      ),
      undefined,
      NOW,
    );

    assert.equal(tiles[0].needsConfirm, true);
    assert.equal(tiles[1].needsConfirm, false);
  });
});

describe("progressUpdatedLine", () => {
  it("says today when anything landed today", () => {
    const line = progressUpdatedLine(
      view(
        [
          subjectView({
            subjectId: "math",
            state: "updated_recently",
            latestObservedAt: "2026-07-12T15:00:00.000000Z",
          }),
          subjectView({
            subjectId: "literacy",
            latestObservedAt: "2026-07-05T12:00:00.000000Z",
          }),
        ],
        scores([], []),
      ),
    );
    assert.deepEqual(line, {
      label: "Updated today",
      today: true,
    });
  });

  it("dates the newest observation otherwise", () => {
    const line = progressUpdatedLine(
      view(
        [
          subjectView({
            subjectId: "math",
            latestObservedAt: "2026-07-05T12:00:00.000000Z",
          }),
          subjectView({
            subjectId: "literacy",
            latestObservedAt: "2026-07-08T12:00:00.000000Z",
          }),
        ],
        scores([], []),
      ),
    );
    assert.deepEqual(line, {
      label: "Updated Jul 8, 2026",
      today: false,
    });
  });

  it("stays silent before any evidence exists", () => {
    const line = progressUpdatedLine(
      view(
        [subjectView({ subjectId: "math", latestObservedAt: null })],
        scores([], []),
      ),
    );
    assert.equal(line, null);
  });
});
