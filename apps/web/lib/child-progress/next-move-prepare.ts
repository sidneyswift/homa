import type { ProgressNextMove } from "@homa/core";

import {
  loadProgressNextMoveSnapshot,
  type ProgressNextMoveSnapshot,
} from "./next-move-snapshot";
import { startProgressNextMoveSession } from "./next-move-session-starter";
import {
  claimProgressNextMove,
  completeProgressNextMove,
  failProgressNextMove,
  reserveProgressNextMoveStart,
  waitForSettledProgressNextMove,
  type StoredProgressNextMove,
} from "./next-move-store";

export interface PreparedProgressNextMove {
  snapshot: ProgressNextMoveSnapshot;
  stored: StoredProgressNextMove;
}

export interface PrepareProgressNextMoveDependencies {
  loadSnapshot: typeof loadProgressNextMoveSnapshot;
  claim: typeof claimProgressNextMove;
  complete: typeof completeProgressNextMove;
  fail: typeof failProgressNextMove;
  reserveStart: typeof reserveProgressNextMoveStart;
  startSession: typeof startProgressNextMoveSession;
  waitForSettled: typeof waitForSettledProgressNextMove;
}

const DEFAULT_DEPENDENCIES: PrepareProgressNextMoveDependencies = {
  loadSnapshot: loadProgressNextMoveSnapshot,
  claim: claimProgressNextMove,
  complete: completeProgressNextMove,
  fail: failProgressNextMove,
  reserveStart: reserveProgressNextMoveStart,
  startSession: startProgressNextMoveSession,
  waitForSettled: waitForSettledProgressNextMove,
};

const STALE_RUNNING_SESSION_MS = 4 * 60 * 1_000;

function noMove(snapshot: ProgressNextMoveSnapshot): ProgressNextMove {
  return {
    kind: "none",
    childId: snapshot.childId,
    sourceRevision: snapshot.sourceRevision.toString(),
    reason: "producer_stopped",
  };
}

/** Claims one revision result, starting at most one internal Eve task. */
export async function prepareProgressNextMove(
  input: { familyId: string; childId: string; retryFailed?: boolean },
  dependencies: PrepareProgressNextMoveDependencies = DEFAULT_DEPENDENCIES,
): Promise<PreparedProgressNextMove | null> {
  const snapshot = await dependencies.loadSnapshot(input);
  if (!snapshot) return null;
  let stored = await dependencies.claim({
    familyId: snapshot.familyId,
    childId: snapshot.childId,
    contextFingerprint: snapshot.contextFingerprint,
    sourceRevision: snapshot.sourceRevision,
    retryFailed: input.retryFailed,
  });

  if (stored.status !== "pending") return { snapshot, stored };

  const runningSessionIsStale =
    stored.runtimeSessionId !== null &&
    stored.runtimeSessionId !== "starting" &&
    Date.now() - Date.parse(stored.updatedAt) >= STALE_RUNNING_SESSION_MS;
  if (runningSessionIsStale) {
    stored =
      (await dependencies.fail({
        familyId: snapshot.familyId,
        childId: snapshot.childId,
        contextFingerprint: snapshot.contextFingerprint,
        sourceRevision: snapshot.sourceRevision,
      })) ?? stored;
    return { snapshot, stored };
  }

  const deterministicResult =
    snapshot.clarification ??
    (snapshot.context.allowedTargets.length === 0
      ? noMove(snapshot)
      : null);
  if (deterministicResult) {
    stored =
      (await dependencies.complete({
        familyId: snapshot.familyId,
        childId: snapshot.childId,
        contextFingerprint: snapshot.contextFingerprint,
        sourceRevision: snapshot.sourceRevision,
        nextMove: deterministicResult,
      })) ?? stored;
    return { snapshot, stored };
  }

  const reserved = await dependencies.reserveStart({
    familyId: snapshot.familyId,
    childId: snapshot.childId,
    contextFingerprint: snapshot.contextFingerprint,
  });
  if (reserved) {
    const started = await dependencies.startSession({
      familyId: snapshot.familyId,
      childId: snapshot.childId,
      contextFingerprint: snapshot.contextFingerprint,
    });
    if (!started) {
      stored =
        (await dependencies.fail({
          familyId: snapshot.familyId,
          childId: snapshot.childId,
          contextFingerprint: snapshot.contextFingerprint,
          sourceRevision: snapshot.sourceRevision,
        })) ?? stored;
      return { snapshot, stored };
    }
  }

  stored =
    (await dependencies.waitForSettled({
      familyId: snapshot.familyId,
      childId: snapshot.childId,
      contextFingerprint: snapshot.contextFingerprint,
    })) ?? stored;
  return { snapshot, stored };
}
