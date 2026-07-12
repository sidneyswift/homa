import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEffectiveProgressEvidence } from "./effective-evidence";
import type {
  OpenProgressConflict,
  ProgressEvidence,
  ResolvedProgressConflict,
} from "./types";

const CHILD_ID = "child-1";
const FAMILY_ID = "family-1";

function evidence(
  overrides: Partial<ProgressEvidence> = {},
): ProgressEvidence {
  return {
    id: "evidence-default",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    answer: "easily",
    source: "check_in",
    memberUserId: "member-1",
    adultDisplayName: "Elena",
    quote: null,
    channel: "web",
    messageId: "message-1",
    checkInId: "check-in-1",
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-07-10T10:00:00.000Z",
    createdAt: "2026-07-10T10:00:01.000Z",
    ...overrides,
  };
}

function openConflict(
  overrides: Partial<OpenProgressConflict> = {},
): OpenProgressConflict {
  return {
    id: "conflict-open",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    evidenceIdA: "evidence-a",
    evidenceIdB: "evidence-b",
    state: "open",
    resolvedAnswer: null,
    resolvedEvidenceId: null,
    observedAt: "2026-07-10T10:05:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function resolvedConflict(
  overrides: Partial<ResolvedProgressConflict> = {},
): ResolvedProgressConflict {
  return {
    id: "conflict-resolved",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    evidenceIdA: "evidence-a",
    evidenceIdB: "evidence-b",
    state: "resolved",
    resolvedAnswer: "easily",
    resolvedEvidenceId: "evidence-a",
    observedAt: "2026-07-10T10:05:00.000Z",
    resolvedAt: "2026-07-10T10:10:00.000Z",
    ...overrides,
  };
}

function resolve(
  progressEvidence: readonly ProgressEvidence[],
  conflicts: readonly (OpenProgressConflict | ResolvedProgressConflict)[] = [],
) {
  return resolveEffectiveProgressEvidence({
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    evidence: progressEvidence,
    conflicts,
  });
}

describe("effective progress evidence", () => {
  it("excludes rows marked as superseded", () => {
    const active = evidence({
      id: "evidence-active",
      observedAt: "2026-07-09T10:00:00.000Z",
    });
    const superseded = evidence({
      id: "evidence-superseded",
      answer: "not_yet",
      supersededAt: "2026-07-11T10:00:00.000Z",
      observedAt: "2026-07-11T09:00:00.000Z",
    });

    const result = resolve([superseded, active]);

    assert.deepEqual(result.effectiveEvidence, [active]);
  });

  it("orders candidates by observed instant, created instant, then stable evidence ID", () => {
    const rows = [
      evidence({
        id: "observed-older",
        itemId: "math.counts-to-5",
        observedAt: "2026-07-10T10:00:00+02:00",
      }),
      evidence({
        id: "observed-newer",
        itemId: "math.counts-to-5",
        observedAt: "2026-07-10T09:00:00Z",
      }),
      evidence({
        id: "created-older",
        itemId: "math.small-groups",
        observedAt: "2026-07-10T10:00:00Z",
        createdAt: "2026-07-10T10:00:01Z",
      }),
      evidence({
        id: "created-newer",
        itemId: "math.small-groups",
        observedAt: "2026-07-10T12:00:00+02:00",
        createdAt: "2026-07-10T10:00:02Z",
      }),
      evidence({
        id: "id-a",
        itemId: "math.counts-to-10",
        observedAt: "2026-07-10T10:00:00Z",
        createdAt: "2026-07-10T10:00:01Z",
      }),
      evidence({
        id: "id-z",
        itemId: "math.counts-to-10",
        observedAt: "2026-07-10T12:00:00+02:00",
        createdAt: "2026-07-10T10:00:01.000Z",
      }),
    ];

    const result = resolve(rows);
    const selectedByItem = new Map(
      result.effectiveEvidence.map((row) => [row.itemId, row.id]),
    );

    assert.equal(selectedByItem.get("math.counts-to-5"), "observed-newer");
    assert.equal(selectedByItem.get("math.small-groups"), "created-newer");
    assert.equal(selectedByItem.get("math.counts-to-10"), "id-z");
  });

  it("excludes an open-conflict item while preserving the conflict", () => {
    const evidenceA = evidence({
      id: "evidence-a",
      answer: "easily",
      memberUserId: "member-a",
    });
    const evidenceB = evidence({
      id: "evidence-b",
      answer: "not_yet",
      memberUserId: "member-b",
    });
    const conflict = openConflict();

    const result = resolve([evidenceA, evidenceB], [conflict]);

    assert.deepEqual(result.effectiveEvidence, []);
    assert.deepEqual(result.openConflicts, [conflict]);
  });

  it("rejects an open conflict linked to superseded evidence", () => {
    for (const staleEvidenceId of ["evidence-a", "evidence-b"]) {
      const evidenceA = evidence({
        id: "evidence-a",
        answer: "easily",
        memberUserId: "member-a",
        supersededAt:
          staleEvidenceId === "evidence-a"
            ? "2026-07-10T11:00:00.000Z"
            : null,
      });
      const evidenceB = evidence({
        id: "evidence-b",
        answer: "not_yet",
        memberUserId: "member-b",
        supersededAt:
          staleEvidenceId === "evidence-b"
            ? "2026-07-10T11:00:00.000Z"
            : null,
      });

      assert.throws(
        () => resolve([evidenceA, evidenceB], [openConflict()]),
        {
          name: "TypeError",
          message: `Open progress conflict "conflict-open" references superseded evidence "${staleEvidenceId}"`,
        },
      );
    }
  });

  it("keeps the resolution over pre-resolution evidence with a newer observation", () => {
    const evidenceA = evidence({
      id: "evidence-a",
      answer: "easily",
      observedAt: "2026-07-08T10:00:00.000Z",
      createdAt: "2026-07-10T10:00:01.000Z",
    });
    const evidenceB = evidence({
      id: "evidence-b",
      answer: "not_yet",
      observedAt: "2026-07-09T10:00:00.000Z",
      createdAt: "2026-07-10T10:00:02.000Z",
    });
    const newerEvidence = evidence({
      id: "evidence-newer",
      answer: "getting_there",
      observedAt: "2026-07-11T10:00:00.000Z",
      createdAt: "2026-07-10T10:09:59.000Z",
    });

    const result = resolve(
      [evidenceA, evidenceB, newerEvidence],
      [resolvedConflict()],
    );

    assert.deepEqual(result.effectiveEvidence, [evidenceA]);
    assert.deepEqual(result.openConflicts, []);
  });

  it("allows post-resolution evidence to win by normal ordering", () => {
    const evidenceA = evidence({
      id: "evidence-a",
      answer: "easily",
      observedAt: "2026-07-08T10:00:00.000Z",
      createdAt: "2026-07-10T10:00:01.000Z",
    });
    const evidenceB = evidence({
      id: "evidence-b",
      answer: "not_yet",
      observedAt: "2026-07-09T10:00:00.000Z",
      createdAt: "2026-07-10T10:00:02.000Z",
    });
    const postResolutionEvidence = evidence({
      id: "evidence-after-resolution",
      answer: "getting_there",
      observedAt: "2026-07-11T10:00:00.000Z",
      createdAt: "2026-07-10T10:10:01.000Z",
    });

    const result = resolve(
      [evidenceA, evidenceB, postResolutionEvidence],
      [resolvedConflict()],
    );

    assert.deepEqual(
      result.effectiveEvidence,
      [postResolutionEvidence],
    );
  });

  it("ignores a resolution that points to superseded evidence", () => {
    const resolvedEvidence = evidence({
      id: "evidence-a",
      answer: "easily",
      supersededAt: "2026-07-10T11:00:00.000Z",
      observedAt: "2026-07-08T10:00:00.000Z",
    });
    const otherConflictEvidence = evidence({
      id: "evidence-b",
      answer: "not_yet",
      observedAt: "2026-07-09T10:00:00.000Z",
    });
    const latestActiveEvidence = evidence({
      id: "evidence-active",
      answer: "getting_there",
      observedAt: "2026-07-11T10:00:00.000Z",
    });

    const result = resolve(
      [
        resolvedEvidence,
        otherConflictEvidence,
        latestActiveEvidence,
      ],
      [resolvedConflict()],
    );

    assert.deepEqual(result.effectiveEvidence, [latestActiveEvidence]);
  });

  it("returns no effective row when resolved evidence and every fallback are superseded", () => {
    const evidenceA = evidence({
      id: "evidence-a",
      answer: "easily",
      supersededAt: "2026-07-10T11:00:00.000Z",
    });
    const evidenceB = evidence({
      id: "evidence-b",
      answer: "not_yet",
      supersededAt: "2026-07-10T11:00:01.000Z",
    });

    const result = resolve(
      [evidenceA, evidenceB],
      [resolvedConflict()],
    );

    assert.deepEqual(result.effectiveEvidence, []);
  });

  it("accepts real Z and numeric-offset timestamps for epoch ordering", () => {
    const earlier = evidence({
      id: "evidence-earlier",
      observedAt: "2026-07-10T10:00:00Z",
      createdAt: "2024-02-29T23:59:59.123456+02:30",
    });
    const later = evidence({
      id: "evidence-later",
      observedAt: "2026-07-10T05:00:01-05:00",
      createdAt: "2026-07-10T10:00:02.5Z",
    });

    const result = resolve([later, earlier]);

    assert.deepEqual(result.effectiveEvidence, [later]);
  });

  it("preserves Postgres fractional precision when ordering observed instants", () => {
    const earlierWithLargerId = evidence({
      id: "evidence-z",
      observedAt: "2026-07-10T10:00:00.123456Z",
    });
    const laterWithSmallerId = evidence({
      id: "evidence-a",
      observedAt: "2026-07-10T10:00:00.123457Z",
    });

    const result = resolve([
      earlierWithLargerId,
      laterWithSmallerId,
    ]);

    assert.deepEqual(
      result.effectiveEvidence,
      [laterWithSmallerId],
    );
  });

  it("preserves Postgres fractional precision when ordering created instants", () => {
    const earlierWithLargerId = evidence({
      id: "evidence-z",
      observedAt: "2026-07-10T10:00:00Z",
      createdAt: "2026-07-10T10:00:01.123456Z",
    });
    const laterWithSmallerId = evidence({
      id: "evidence-a",
      observedAt: "2026-07-10T12:00:00+02:00",
      createdAt: "2026-07-10T10:00:01.123457Z",
    });

    const result = resolve([
      earlierWithLargerId,
      laterWithSmallerId,
    ]);

    assert.deepEqual(
      result.effectiveEvidence,
      [laterWithSmallerId],
    );
  });

  it("treats equivalent offset timestamps as the same instant", () => {
    const smallerId = evidence({
      id: "evidence-a",
      observedAt: "2026-07-10T10:00:00.123456Z",
      createdAt: "2026-07-10T10:00:01.654321Z",
    });
    const largerId = evidence({
      id: "evidence-z",
      observedAt: "2026-07-10T12:30:00.123456+02:30",
      createdAt: "2026-07-10T05:00:01.654321-05:00",
    });

    const result = resolve([largerId, smallerId]);

    assert.deepEqual(result.effectiveEvidence, [largerId]);
  });

  it("rejects impossible or offset-free ISO-like timestamps", () => {
    const invalidTimestamps = [
      "2026-02-30T10:00:00Z",
      "2026-07-10T24:00:00Z",
      "2026-07-10T10:60:00Z",
      "2026-07-10T10:00:60Z",
      "2026-07-10T10:00:00+24:00",
      "2026-07-10T10:00:00+05:60",
      "2026-07-10T10:00:00-00:00",
      "2026-07-10T10:00:00",
      "2026-07-10 10:00:00Z",
    ];

    for (const observedAt of invalidTimestamps) {
      assert.throws(
        () =>
          resolve([
            evidence({
              id: "strict-timestamp",
              observedAt,
            }),
          ]),
        {
          name: "TypeError",
          message: `Invalid observedAt "${observedAt}" for progress evidence "strict-timestamp"`,
        },
      );
    }
  });

  it("rejects invalid ordering timestamps with the field and evidence ID", () => {
    assert.throws(
      () =>
        resolve([
          evidence({
            id: "bad-observed",
            observedAt: "not-a-time",
          }),
        ]),
      {
        name: "TypeError",
        message:
          'Invalid observedAt "not-a-time" for progress evidence "bad-observed"',
      },
    );
    assert.throws(
      () =>
        resolve([
          evidence({
            id: "bad-created",
            createdAt: "still-not-a-time",
          }),
        ]),
      {
        name: "TypeError",
        message:
          'Invalid createdAt "still-not-a-time" for progress evidence "bad-created"',
      },
    );
  });

  it("rejects evidence or conflicts from another child or family", () => {
    assert.throws(
      () => resolve([evidence({ childId: "child-2" })]),
      {
        name: "TypeError",
        message:
          'Progress evidence "evidence-default" belongs to child "child-2" in family "family-1"; expected child "child-1" in family "family-1"',
      },
    );
    assert.throws(
      () =>
        resolve(
          [
            evidence({ id: "evidence-a" }),
            evidence({ id: "evidence-b", answer: "not_yet" }),
          ],
          [openConflict({ familyId: "family-2" })],
        ),
      {
        name: "TypeError",
        message:
          'Progress conflict "conflict-open" belongs to child "child-1" in family "family-2"; expected child "child-1" in family "family-1"',
      },
    );
  });
});
