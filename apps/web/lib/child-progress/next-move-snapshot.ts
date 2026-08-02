import { createHash } from "node:crypto";

import type { ProgressNextMove } from "@homa/core";

import { buildChildProgressView } from "./projection";
import type { ChildProgressProjectionInput } from "./repository";
import { getChildProgressLedger } from "./runtime";
import {
  buildProgressNextMoveModelContext,
  progressNextMoveClarification,
  type ProgressNextMoveModelContext,
} from "./next-move";

export const PROGRESS_NEXT_MOVE_PROMPT_VERSION = "progress-next-move-v1";

export interface ProgressNextMoveSnapshot {
  familyId: string;
  childId: string;
  sourceRevision: bigint;
  view: ReturnType<typeof buildChildProgressView>;
  ledger: ChildProgressProjectionInput;
  context: ProgressNextMoveModelContext;
  clarification: Extract<ProgressNextMove, { kind: "clarify" }> | null;
  contextFingerprint: string;
}

export function buildProgressNextMoveSnapshot(input: {
  familyId: string;
  ledger: ChildProgressProjectionInput;
  now: Date;
}): ProgressNextMoveSnapshot {
  const view = buildChildProgressView({ ...input.ledger, now: input.now });
  const state = {
    familyId: input.familyId,
    view,
    ledger: input.ledger,
    now: input.now,
  };
  const context = buildProgressNextMoveModelContext(state);
  const contextFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        promptVersion: PROGRESS_NEXT_MOVE_PROMPT_VERSION,
        sourceRevision: input.ledger.sourceRevision.toString(),
        context,
      }),
    )
    .digest("hex");
  return {
    familyId: input.familyId,
    childId: view.childId,
    sourceRevision: input.ledger.sourceRevision,
    view,
    ledger: input.ledger,
    context,
    clarification: progressNextMoveClarification(state),
    contextFingerprint,
  };
}

export async function loadProgressNextMoveSnapshot(input: {
  familyId: string;
  childId: string;
  now?: Date;
}): Promise<ProgressNextMoveSnapshot | null> {
  const ledger = await getChildProgressLedger(input.familyId, input.childId);
  if (!ledger) return null;
  return buildProgressNextMoveSnapshot({
    familyId: input.familyId,
    ledger,
    now: input.now ?? new Date(),
  });
}
