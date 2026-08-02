import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  progressNextMoveCandidateSchema,
  type ProgressNextMoveCandidate,
  verifyProgressNextMoveCandidate,
} from "../../lib/child-progress/next-move";
import {
  readProgressNextMoveTrustedContext,
  type ProgressNextMoveTrustedContext,
} from "../../lib/child-progress/next-move-dispatch";
import { loadProgressNextMoveSnapshot } from "../../lib/child-progress/next-move-snapshot";
import {
  completeProgressNextMove,
  failProgressNextMove,
} from "../../lib/child-progress/next-move-store";

const candidateFields = progressNextMoveCandidateSchema.shape;
const moveProposalSchema = z
  .object({
    targetItemId: candidateFields.targetItemId.describe(
        "One allowed current target item id from the task context.",
    ),
    evidenceItemIds: candidateFields.evidenceItemIds.describe(
        "One to three eligible evidence itemId values, including the target itemId.",
    ),
    minutes: candidateFields.minutes.describe(
        "The five, ten, or fifteen minute activity length.",
    ),
    activity: candidateFields.activity.describe(
        "One concrete, safe activity for today.",
    ),
    why: candidateFields.why.describe(
        "One parent-language reason grounded in the listed evidence.",
    ),
  })
  .strict();

export const progressNextMovePersistInputSchema = z
  .object({
    kind: z
      .enum(["move", "stop"])
      .describe("Choose move to persist one proposal, or stop when none fits."),
    childId: candidateFields.childId.describe(
      "The child id in the trusted Progress task context.",
    ),
    proposal: moveProposalSchema
      .optional()
      .describe("Required when kind is move. Omit when kind is stop."),
    reason: z
      .enum(["insufficient_fit", "needs_parent_choice", "unsafe_activity"])
      .optional()
      .describe("Required when kind is stop. Omit when kind is move."),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === "move" && !input.proposal) {
      context.addIssue({
        code: "custom",
        path: ["proposal"],
        message: "proposal is required when kind is move",
      });
    }
    if (input.kind === "move" && input.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "reason must be omitted when kind is move",
      });
    }
    if (input.kind === "stop" && !input.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "reason is required when kind is stop",
      });
    }
    if (input.kind === "stop" && input.proposal) {
      context.addIssue({
        code: "custom",
        path: ["proposal"],
        message: "proposal must be omitted when kind is stop",
      });
    }
  });

export function progressNextMoveCandidateFromPersistInput(
  input: z.infer<typeof progressNextMovePersistInputSchema>,
): ProgressNextMoveCandidate | null {
  if (input.kind !== "move" || !input.proposal) return null;
  return {
    childId: input.childId,
    ...input.proposal,
  };
}

export interface ProgressNextMovePersistDependencies {
  loadSnapshot: typeof loadProgressNextMoveSnapshot;
  complete: typeof completeProgressNextMove;
  fail: typeof failProgressNextMove;
}

const DEFAULT_PERSIST_DEPENDENCIES: ProgressNextMovePersistDependencies = {
  loadSnapshot: loadProgressNextMoveSnapshot,
  complete: completeProgressNextMove,
  fail: failProgressNextMove,
};

export async function executeTrustedProgressNextMovePersistence(
  input: z.infer<typeof progressNextMovePersistInputSchema>,
  trusted: ProgressNextMoveTrustedContext,
  dependencies: ProgressNextMovePersistDependencies =
    DEFAULT_PERSIST_DEPENDENCIES,
) {
  if (input.childId !== trusted.childId) {
    return {
      persisted: false,
      reason: "wrong_child",
      note: "The proposed child did not match the trusted task child.",
    };
  }

  const snapshot = await dependencies.loadSnapshot({
    familyId: trusted.familyId,
    childId: trusted.childId,
  });
  if (
    !snapshot ||
    snapshot.contextFingerprint !== trusted.contextFingerprint ||
    snapshot.sourceRevision !== trusted.sourceRevision
  ) {
    return {
      persisted: false,
      reason: "superseded",
      note: "Progress changed during generation. Stop without repairing or retrying ids.",
    };
  }

  let nextMove;
  if (input.kind === "stop") {
    nextMove = {
      kind: "none" as const,
      childId: snapshot.childId,
      sourceRevision: snapshot.sourceRevision.toString(),
      reason: "producer_stopped" as const,
    };
  } else {
    const candidate = progressNextMoveCandidateFromPersistInput(input);
    if (!candidate) {
      return {
        persisted: false,
        reason: "invalid_move_shape",
        note: "A move proposal was required. Stop without retrying guessed fields.",
      };
    }
    const verified = verifyProgressNextMoveCandidate({
      familyId: snapshot.familyId,
      view: snapshot.view,
      ledger: snapshot.ledger,
      candidate,
      now: new Date(snapshot.view.projectedAt),
    });
    if (verified.accepted) {
      nextMove = verified.nextMove;
    } else if (verified.clarification) {
      nextMove = verified.clarification;
    } else {
      const failed = await dependencies.fail({
        familyId: snapshot.familyId,
        childId: snapshot.childId,
        contextFingerprint: snapshot.contextFingerprint,
        sourceRevision: snapshot.sourceRevision,
      });
      return failed
        ? {
            persisted: true,
            status: "failed",
            nextMove: null,
            reason: verified.reason,
            note: "The proposal failed deterministic verification. The parent can retry; no recommendation was saved.",
          }
        : {
            persisted: false,
            reason: "already_settled_or_superseded",
            note: "This task no longer owns a pending result. Do not retry.",
          };
    }
  }

  const persisted = await dependencies.complete({
    familyId: snapshot.familyId,
    childId: snapshot.childId,
    contextFingerprint: snapshot.contextFingerprint,
    sourceRevision: snapshot.sourceRevision,
    nextMove,
  });
  return persisted
    ? {
        persisted: true,
        status: persisted.status,
        nextMove: persisted.nextMove,
        note: "The stable derived result was verified and saved. No parent action was taken.",
      }
    : {
        persisted: false,
        reason: "already_settled_or_superseded",
        note: "This task no longer owns a pending result. Do not retry.",
      };
}

export default defineBoundedTool({
  description:
    "Persist the one verified result for an authenticated internal progress_next_move task. Not for parent chat or any other channel. This tool re-loads one repeatable-read Progress snapshot, rejects stale task fingerprints and wrong children, verifies every candidate id and evidence relationship, and conditionally settles the pending derived-result row. It never changes child evidence, sends a message, schedules work, creates material, or makes a purchase.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  allowProgressNextMove: true,
  inputSchema: progressNextMovePersistInputSchema,
  async execute(input, ctx) {
    const trusted = readProgressNextMoveTrustedContext(
      ctx.session.auth.current?.attributes,
    );
    if (!trusted) {
      return {
        persisted: false,
        reason: "untrusted_channel",
        note: "This effect is available only inside a trusted Progress next move task.",
      };
    }
    return await executeTrustedProgressNextMovePersistence(input, trusted);
  },
});
