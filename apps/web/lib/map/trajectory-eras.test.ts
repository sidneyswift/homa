import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_BANK_VERSION, MAP_SCORER_VERSION, scoreMap } from "@homa/core";

import {
  buildTrajectoryEras,
  currentBasisKey,
  reconstructAnswersAsOf,
  trajectoryHasScaleChange,
  type TrajectoryEvidenceRow,
} from "./trajectory-eras";

/** Real bank items, pinned by anchor so the assertions stay readable:
 * math.counts-to-10 anchors at 42 months, math.counts-past-20 at 54. */
const COUNTS_TO_10 = "math.counts-to-10";
const COUNTS_PAST_20 = "math.counts-past-20";

function evidenceRow(
  overrides: Partial<TrajectoryEvidenceRow> &
    Pick<TrajectoryEvidenceRow, "itemId" | "answer" | "observedAt">,
): TrajectoryEvidenceRow {
  return {
    supersededAt: null,
    createdAt: overrides.observedAt,
    ...overrides,
  };
}

describe("reconstructAnswersAsOf", () => {
  const firstObserved = "2026-07-01T10:00:00.000Z";
  const corrected = "2026-07-05T10:00:00.000Z";
  const ledger: TrajectoryEvidenceRow[] = [
    // A correction supersedes the old row and appends the new one.
    evidenceRow({
      itemId: COUNTS_TO_10,
      answer: "easily",
      observedAt: firstObserved,
      supersededAt: corrected,
    }),
    evidenceRow({
      itemId: COUNTS_TO_10,
      answer: "getting_there",
      observedAt: corrected,
    }),
    // A retraction supersedes with no successor (the checklist undo).
    evidenceRow({
      itemId: COUNTS_PAST_20,
      answer: "not_yet",
      observedAt: "2026-07-02T10:00:00.000Z",
      supersededAt: "2026-07-06T10:00:00.000Z",
    }),
  ];

  it("returns the answers that were active at each moment", () => {
    assert.deepEqual(
      reconstructAnswersAsOf(ledger, Date.parse("2026-07-03T00:00:00Z")),
      [
        { itemId: COUNTS_PAST_20, answer: "not_yet" },
        { itemId: COUNTS_TO_10, answer: "easily" },
      ],
    );
    assert.deepEqual(
      reconstructAnswersAsOf(ledger, Date.parse("2026-07-05T12:00:00Z")),
      [
        { itemId: COUNTS_PAST_20, answer: "not_yet" },
        { itemId: COUNTS_TO_10, answer: "getting_there" },
      ],
    );
  });

  it("drops retracted answers after their supersession, and ignores later evidence entirely", () => {
    assert.deepEqual(
      reconstructAnswersAsOf(ledger, Date.parse("2026-07-07T00:00:00Z")),
      [{ itemId: COUNTS_TO_10, answer: "getting_there" }],
    );
    assert.deepEqual(
      reconstructAnswersAsOf(ledger, Date.parse("2026-06-30T00:00:00Z")),
      [],
    );
  });

  it("breaks same-instant ties by creation order, so a same-timestamp replacement wins", () => {
    const instant = "2026-07-04T10:00:00.000Z";
    const rows: TrajectoryEvidenceRow[] = [
      evidenceRow({
        itemId: COUNTS_TO_10,
        answer: "not_yet",
        observedAt: instant,
        createdAt: "2026-07-04T10:00:00.100000Z",
        supersededAt: instant,
      }),
      evidenceRow({
        itemId: COUNTS_TO_10,
        answer: "easily",
        observedAt: instant,
        createdAt: "2026-07-04T10:00:00.200000Z",
      }),
    ];
    assert.deepEqual(
      reconstructAnswersAsOf(rows, Date.parse(instant)),
      [{ itemId: COUNTS_TO_10, answer: "easily" }],
    );
  });
});

describe("buildTrajectoryEras", () => {
  // Born 2022-07-01: 47 months on 2026-06-15, 48 on 2026-07-15.
  const birthDate = "2022-07-01";
  const liveScores = scoreMap(48, [
    { itemId: COUNTS_PAST_20, answer: "easily" },
  ]);
  const live = {
    generated_at: "2026-07-15T12:00:00.000Z",
    scores: liveScores,
  };

  it("rescores ledger-covered eras under the current basis, from the answers of that day", () => {
    const evidence: TrajectoryEvidenceRow[] = [
      evidenceRow({
        itemId: COUNTS_TO_10,
        answer: "easily",
        observedAt: "2026-06-10T09:00:00.000Z",
      }),
      evidenceRow({
        itemId: COUNTS_PAST_20,
        answer: "easily",
        observedAt: "2026-07-10T09:00:00.000Z",
      }),
    ];
    // The archived numbers are deliberately nonsense: the rescore must
    // replace them, not echo them.
    const archived = [
      {
        generated_at: "2026-06-15T12:00:00.000Z",
        scores: scoreMap(30, []),
        bank_version: "2026.07.2",
      },
    ];

    const eras = buildTrajectoryEras({ archived, live, evidence, birthDate });

    assert.equal(eras.length, 2);
    assert.equal(eras[0].renormalized, true);
    assert.equal(eras[0].basisKey, currentBasisKey(birthDate));
    // At 47 months, an easily on the 42-month item reads on_track: the
    // era was scored from the one answer that existed on June 15, at
    // the child's current-birthday age on June 15, under today's rules.
    const math = eras[0].scores.subjects.find(
      (subject) => subject.subjectId === "math",
    );
    assert.deepEqual(
      { position: math?.position, monthsAhead: math?.monthsAhead },
      scoreMap(47, [{ itemId: COUNTS_TO_10, answer: "easily" }]).subjects
        .filter((subject) => subject.subjectId === "math")
        .map((subject) => ({
          position: subject.position,
          monthsAhead: subject.monthsAhead,
        }))[0],
    );
    // One measuring stick across the whole line: no boundary.
    assert.equal(trajectoryHasScaleChange(eras), false);
  });

  it("keeps stored numbers and stored basis for eras the ledger cannot reach", () => {
    const archivedScores = scoreMap(43, [
      { itemId: COUNTS_TO_10, answer: "easily" },
    ]);
    const eras = buildTrajectoryEras({
      archived: [
        {
          generated_at: "2026-06-15T12:00:00.000Z",
          scores: archivedScores,
          bank_version: "2026.07.2",
        },
      ],
      live,
      evidence: [],
      birthDate,
    });

    assert.equal(eras[0].renormalized, false);
    assert.deepEqual(eras[0].scores, archivedScores);
    assert.equal(eras[0].basisKey, "2026.07.2|unknown|unknown");
    assert.equal(eras[1].basisKey, currentBasisKey(birthDate));
    assert.equal(trajectoryHasScaleChange(eras), true);
  });

  it("treats a fully stamped archive matching today's basis as the same measuring stick", () => {
    const eras = buildTrajectoryEras({
      archived: [
        {
          generated_at: "2026-06-15T12:00:00.000Z",
          scores: scoreMap(47, []),
          bank_version: MAP_BANK_VERSION,
          scorer_version: MAP_SCORER_VERSION,
          birth_date: birthDate,
        },
      ],
      live,
      evidence: [],
      birthDate,
    });

    assert.equal(trajectoryHasScaleChange(eras), false);
  });

  it("never rescores the live era", () => {
    const eras = buildTrajectoryEras({
      archived: [],
      live,
      evidence: [
        evidenceRow({
          itemId: COUNTS_TO_10,
          answer: "not_yet",
          observedAt: "2026-07-01T09:00:00.000Z",
        }),
      ],
      birthDate,
    });

    assert.equal(eras.length, 1);
    assert.equal(eras[0].renormalized, false);
    assert.deepEqual(eras[0].scores, liveScores);
  });
});
