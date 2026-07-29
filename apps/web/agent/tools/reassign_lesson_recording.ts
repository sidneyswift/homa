import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { reassignLessonRecording } from "../../lib/lessons/store";

/**
 * Moving a recorded lesson to the child it was actually about (gh#353).
 *
 * On 2026-07-27 a parent recorded 28 minutes with her three-year-old
 * while the recorder was armed for her nine-year-old, and asked three
 * times to move it. There was no way to: the capability did not exist
 * anywhere in the product, so the wrong child kept both the lesson and,
 * worse, the progress evidence it produced. A preschool phonics claim
 * sat on a nine-year-old's record.
 *
 * Deterministic and atomic on purpose. The recording, the review a
 * parent reads, and the progress evidence that SCORES a child all move
 * together or not at all: moving only the recording looks fixed while
 * leaving the wrong child's record quietly wrong.
 */
export default defineBoundedTool({
  description:
    "Move a recorded lesson to a different child, when the parent says it was recorded under the wrong one. Moves the recording, its summary, and the progress it counted, together. Get the lessonId from find_lesson_recordings first.",
  deadlineMs: TOOL_DEADLINE.quick,
  // Idempotent: a replay lands on already_there and changes nothing.
  repeatable: true,
  inputSchema: z.object({
    lessonId: z.uuid().describe("The recording to move, from find_lesson_recordings."),
    childId: z
      .uuid()
      .describe("The child it should be filed under (id from the family context block)."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { moved: false, note: error.message };
      }
      throw error;
    }

    const result = await reassignLessonRecording({
      familyId: access.familyId,
      lessonId: input.lessonId,
      childId: input.childId,
    });

    switch (result.status) {
      case "unknown_lesson":
        return {
          moved: false,
          note: "That recording is not one of this family's. Use a lessonId from find_lesson_recordings.",
        };
      case "unknown_child":
        return {
          moved: false,
          note: "That child is not in this family. Use a childId from the family context block.",
        };
      case "already_there":
        return {
          moved: false,
          done: true,
          note: "That recording is already filed under that child. Tell her it is already where she wants it, warmly, and do not move anything.",
        };
      case "reassigned":
        return {
          moved: true,
          done: true,
          movedReviews: result.movedReviews,
          movedEvidence: result.movedEvidence,
          note:
            result.movedEvidence > 0
              ? "Moved, including what the lesson counted toward her progress. Say plainly that the lesson and its progress now sit with the right child. One thing to be honest about if she asks: wording already written into the summary may still name the other child, because that is the record of what was said and is not rewritten."
              : "Moved. Say plainly that the lesson now sits with the right child.",
        };
    }
  },
});
