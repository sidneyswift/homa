import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { getChildrenPinned } from "../../lib/agent-pinned";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";

/**
 * Prepares, but never starts, a native lesson recording. The model judges
 * which child and lesson purpose the parent named. Code verifies that the
 * child belongs to the authenticated family. The native screen owns the
 * explicit privacy explanation, consent, and start action.
 */
export default defineBoundedTool({
  description:
    "Prepare the native lesson recorder after the parent explicitly asks to record a lesson and clearly names both the child and the lesson purpose. This only verifies the family child and opens a confirmation screen. It never starts audio capture. If either detail is missing, ask one short question before calling this tool.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    childId: z
      .uuid()
      .describe("The exact child id from the authenticated family context."),
    purpose: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .describe(
        "The parent's concrete purpose in plain words, such as reading lesson or math practice.",
      ),
  }),
  async execute(input, ctx) {
    if (process.env.HOMA_NATIVE_LESSON_RECORDING_ENABLED !== "true") {
      return {
        prepared: false,
        reason: "not-available",
        note: "Native lesson recording is not available yet. No recorder opened and no microphone started.",
      };
    }
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { prepared: false, reason: "no-family", note: error.message };
      }
      throw error;
    }

    const children = await getChildrenPinned(access.familyId);
    const child = children.find((candidate) => candidate.id === input.childId);
    if (!child) {
      return {
        prepared: false,
        reason: "unknown-child",
        note: "That child is not in this family. Ask which child this lesson is for.",
      };
    }

    return {
      prepared: true,
      nativeAction: "lesson_recording" as const,
      childId: child.id,
      childName: child.name,
      purpose: input.purpose,
      note: `The lesson recorder is ready for ${child.name}'s ${input.purpose}. The app will explain private storage and ask the adult to agree before the microphone starts.`,
    };
  },
});
