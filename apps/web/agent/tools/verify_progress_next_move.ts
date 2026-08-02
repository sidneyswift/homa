import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
} from "../../lib/agent-db";
import { loadProgressNextMoveSnapshot } from "../../lib/child-progress/next-move-snapshot";
import {
  progressNextMoveCandidateSchema,
  verifyProgressNextMoveCandidate,
} from "../../lib/child-progress/next-move";

const inputSchema = z
  .object({
    childId: z
      .string()
      .uuid()
      .describe("A child id from the authenticated family Progress context."),
    targetItemId: z
      .string()
      .min(1)
      .max(160)
      .describe("One fresh current evidence item id from Progress context."),
    evidenceItemIds: z
      .array(z.string().min(1).max(160))
      .min(1)
      .max(3)
      .describe("One to three current evidence itemId values from that same child's Progress context, including the target itemId."),
    minutes: z
      .union([z.literal(5), z.literal(10), z.literal(15)])
      .describe("The small amount of time the activity should take."),
    activity: z
      .string()
      .min(1)
      .max(320)
      .describe("One concrete activity the parent can try today."),
    why: z
      .string()
      .min(1)
      .max(240)
      .describe("One parent-language sentence connecting the activity to saved evidence."),
  })
  .strict();

export default defineBoundedTool({
  description:
    "Verify one proposed next activity against a child's fresh canonical Progress state before showing it. Use only after loading the progress-next-move skill. This read-only tool re-scopes the child to the authenticated family, verifies every evidence item, accepts only a fresh current catalog target cited in the evidence, and refuses conflicts, stale evidence, unknown provenance, or cross-subject grounding. An ask_next topic is an assessment question, never an instructional target. The tool never saves, schedules, purchases, creates, or sends anything. If it returns a clarification, ask that one question and stop.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema,
  async execute(input, ctx) {
    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(
        ctx.session.auth.current?.attributes,
      )).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { verified: false, note: error.message };
      }
      throw error;
    }

    const snapshot = await loadProgressNextMoveSnapshot({
      familyId,
      childId: input.childId,
    });
    if (!snapshot) {
      return {
        verified: false,
        reason: "unknown_child",
        note: "That child is not in this authenticated family. Do not guess another id.",
      };
    }
    const candidate = progressNextMoveCandidateSchema.parse(input);
    const result = verifyProgressNextMoveCandidate({
      familyId,
      view: snapshot.view,
      ledger: snapshot.ledger,
      candidate,
      now: new Date(),
    });
    if (!result.accepted) {
      return {
        verified: false,
        reason: result.reason,
        clarification: result.clarification,
        note: result.clarification
          ? "The current state needs this one clarification before advice. Ask it and stop."
          : "The proposal did not match verified current evidence. Do not repair ids from memory or retry with guesses.",
      };
    }
    return {
      verified: true,
      nextMove: result.nextMove,
      note: "Verified and read-only. Share this one move and its reason. Nothing was saved, scheduled, created, purchased, or sent.",
    };
  },
});
