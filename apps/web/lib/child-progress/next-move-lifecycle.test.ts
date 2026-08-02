import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProgressNextMove } from "@homa/core";

import type {
  ChildProgressProjectionInput,
  StoredProgressEvidence,
} from "./repository";
import {
  prepareProgressNextMove,
  type PrepareProgressNextMoveDependencies,
} from "./next-move-prepare";
import {
  buildProgressNextMoveSnapshot,
  type ProgressNextMoveSnapshot,
} from "./next-move-snapshot";
import type {
  ProgressNextMoveStatus,
  StoredProgressNextMove,
} from "./next-move-store";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-08-02T16:00:00.000Z");

function evidence(
  overrides: Partial<StoredProgressEvidence> = {},
): StoredProgressEvidence {
  return {
    id: "evidence-counts",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    answer: "getting_there",
    derivation: "direct",
    source: "check_in",
    memberUserId: "33333333-3333-4333-8333-333333333333",
    adultDisplayName: "Elena",
    quote: null,
    channel: "web",
    messageId: "message-1",
    checkInId: "check-in-1",
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-08-01T16:00:00.000Z",
    createdAt: "2026-08-01T16:00:01.000Z",
    idempotencyKey: "key-counts",
    ...overrides,
  };
}

function ledger(
  evidenceRows: StoredProgressEvidence[] = [evidence()],
  overrides: Partial<ChildProgressProjectionInput> = {},
): ChildProgressProjectionInput {
  return {
    child: {
      id: CHILD_ID,
      name: "Maya",
      birthDate: "2020-01-02",
    },
    familyId: FAMILY_ID,
    timeZone: "America/New_York",
    sourceRevision: BigInt(7),
    evidence: evidenceRows,
    conflicts: [],
    selectionAnswers: [],
    ...overrides,
  };
}

function snapshot(
  projection = ledger(),
  now = NOW,
): ProgressNextMoveSnapshot {
  return buildProgressNextMoveSnapshot({
    familyId: FAMILY_ID,
    ledger: projection,
    now,
  });
}

function stored(
  source: ProgressNextMoveSnapshot,
  overrides: Partial<StoredProgressNextMove> = {},
): StoredProgressNextMove {
  return {
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    contextFingerprint: source.contextFingerprint,
    sourceRevision: source.sourceRevision,
    status: "pending",
    nextMove: null,
    runtimeSessionId: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function settled(
  source: ProgressNextMoveSnapshot,
  nextMove: ProgressNextMove,
): StoredProgressNextMove {
  const status: ProgressNextMoveStatus =
    nextMove.kind === "move"
      ? "ready"
      : nextMove.kind === "clarify"
        ? "clarify"
        : "none";
  return stored(source, { status, nextMove });
}

function dependencies(input: {
  source: ProgressNextMoveSnapshot;
  current?: StoredProgressNextMove;
  startResult?: boolean;
  onStart?: () => void;
  onReserve?: () => void;
  onComplete?: (nextMove: ProgressNextMove) => void;
  onFail?: () => void;
}): PrepareProgressNextMoveDependencies {
  let current = input.current ?? stored(input.source);
  return {
    loadSnapshot: async () => input.source,
    claim: async (claim) => {
      if (claim.retryFailed && current.status === "failed") {
        current = stored(input.source);
      }
      return current;
    },
    complete: async (completion) => {
      input.onComplete?.(completion.nextMove);
      if (current.status !== "pending") return null;
      current = settled(input.source, completion.nextMove);
      return current;
    },
    fail: async () => {
      input.onFail?.();
      if (current.status !== "pending") return null;
      current = stored(input.source, {
        status: "failed",
        nextMove: null,
        runtimeSessionId: null,
      });
      return current;
    },
    reserveStart: async () => {
      input.onReserve?.();
      if (current.runtimeSessionId !== null) return false;
      current = stored(input.source, {
        ...current,
        runtimeSessionId: "starting",
      });
      return true;
    },
    startSession: async () => {
      input.onStart?.();
      if (input.startResult === false) return false;
      current = stored(input.source, {
        ...current,
        runtimeSessionId: "session-1",
      });
      return true;
    },
    waitForSettled: async () => current,
  };
}

describe("Progress next-move fingerprint", () => {
  it("is stable for the same bounded state and changes with revision or evidence", () => {
    const first = snapshot();
    const repeated = snapshot(ledger(), new Date(NOW.getTime() + 1));
    const revised = snapshot(
      ledger(undefined, { sourceRevision: BigInt(8) }),
    );
    const changedAnswer = snapshot(
      ledger([evidence({ answer: "not_yet" })]),
    );

    assert.equal(first.contextFingerprint, repeated.contextFingerprint);
    assert.notEqual(first.contextFingerprint, revised.contextFingerprint);
    assert.notEqual(first.contextFingerprint, changedAnswer.contextFingerprint);
  });

  it("never includes a raw private quote in the model context", () => {
    const current = snapshot(
      ledger([
        evidence({
          derivation: "inferred",
          source: "journal",
          checkInId: null,
          quote: "raw words that should stay private",
        }),
      ]),
    );

    assert.doesNotMatch(
      JSON.stringify(current.context),
      /raw words that should stay private/u,
    );
  });
});

describe("Progress next-move persisted lifecycle", () => {
  it("settles all-easy evidence without starting a model task", async () => {
    const source = snapshot(ledger([evidence({ answer: "easily" })]));
    let starts = 0;
    let completed: ProgressNextMove | null = null;
    const result = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID },
      dependencies({
        source,
        onStart: () => {
          starts += 1;
        },
        onComplete: (nextMove) => {
          completed = nextMove;
        },
      }),
    );

    assert.equal(starts, 0);
    assert.deepEqual(completed, {
      kind: "none",
      childId: CHILD_ID,
      sourceRevision: source.sourceRevision.toString(),
      reason: "producer_stopped",
    });
    assert.equal(result?.stored.status, "none");
  });

  it("starts at most one task across repeated requests for one fingerprint", async () => {
    const source = snapshot();
    let starts = 0;
    const deps = dependencies({
      source,
      onStart: () => {
        starts += 1;
      },
    });

    const first = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID },
      deps,
    );
    const second = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID },
      deps,
    );

    assert.equal(starts, 1);
    assert.equal(first?.stored.runtimeSessionId, "session-1");
    assert.equal(second?.stored.runtimeSessionId, "session-1");
  });

  it("stores a result-free failure when the internal task cannot start", async () => {
    const source = snapshot();
    const result = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID },
      dependencies({ source, startResult: false }),
    );

    assert.equal(result?.stored.status, "failed");
    assert.equal(result?.stored.nextMove, null);
  });

  it("fails a lost running session instead of remaining pending forever", async () => {
    const source = snapshot();
    let reserves = 0;
    const result = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID },
      dependencies({
        source,
        current: stored(source, {
          runtimeSessionId: "lost-session",
          updatedAt: new Date(Date.now() - 5 * 60 * 1_000).toISOString(),
        }),
        onReserve: () => {
          reserves += 1;
        },
      }),
    );

    assert.equal(reserves, 0);
    assert.equal(result?.stored.status, "failed");
    assert.equal(result?.stored.nextMove, null);
  });

  it("retries one failed fingerprint only after an explicit retry", async () => {
    const source = snapshot();
    let starts = 0;
    const deps = dependencies({
      source,
      current: stored(source, { status: "failed" }),
      onStart: () => {
        starts += 1;
      },
    });

    const cachedFailure = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID },
      deps,
    );
    const retried = await prepareProgressNextMove(
      { familyId: FAMILY_ID, childId: CHILD_ID, retryFailed: true },
      deps,
    );

    assert.equal(cachedFailure?.stored.status, "failed");
    assert.equal(starts, 1);
    assert.equal(retried?.stored.status, "pending");
    assert.equal(retried?.stored.runtimeSessionId, "session-1");
  });
});
