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
  verifyProgressNextMoveChatCandidate,
  verifyProgressNextMoveChatStop,
} from "../../lib/child-progress/next-move";

const activityInputSchema = z
  .object({
    kind: z.literal("activity").describe("Verify one supported practice activity."),
    childId: z
      .string()
      .uuid()
      .describe("A child id from the authenticated family Progress context."),
    targetItemId: z
      .string()
      .min(1)
      .max(160)
      .describe("One fresh current non-easy evidence item id from a canonical explore_child_map saved_answers read."),
    evidenceItemIds: z
      .array(z.string().min(1).max(160))
      .min(1)
      .max(3)
      .describe("One to three fresh savedAnswers itemId values from the same child's canonical saved_answers read, including the target itemId. Preserve each answer's date and derivation."),
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

export const progressNextMoveVerifyInputSchema = z.object({
  childId: activityInputSchema.shape.childId,
  decision: z.discriminatedUnion("kind", [
    activityInputSchema.omit({childId: true}),
    z.object({
      kind: z.literal("all_easy_stop").describe("Verify that the complete current subject evidence supports ending without practice."),
      subjectId: z.string().min(1).max(80).describe("The canonical subject id from the selected child's saved_answers read."),
    }).strict(),
  ]).describe("The exact activity or supported stop to verify."),
}).strict();

export default defineBoundedTool({
  description:
    "Verify one proposed next activity or a supported all-easy stop against a child's fresh canonical Progress state. Use after loading progress-next-move and reading the selected child and subject with explore_child_map saved_answers. This read-only tool re-scopes the child to the authenticated family and checks complete current evidence. An all-easy stop certifies only the saved abilities and ends advice; it grants no extension or maintenance activity. An activity needs a fresh current non-easy target and cited evidence. An ask_next topic is an assessment question, never an instructional target. The tool never saves, schedules, purchases, creates, or sends anything. If it returns a clarification, ask that one question and stop.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: progressNextMoveVerifyInputSchema,
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
    if (input.decision.kind === "all_easy_stop") return verifyProgressNextMoveChatStop({
      familyId, childId: input.childId, subjectId: input.decision.subjectId,
      view: snapshot.view, ledger: snapshot.ledger, now: new Date(),
    });
    const { kind: _kind, ...proposal } = input.decision;
    const candidate = progressNextMoveCandidateSchema.parse({childId: input.childId, ...proposal});
    const result = verifyProgressNextMoveChatCandidate({
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
