import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { listLessonRecordingsForFamily } from "../../lib/lessons/store";
import { getChildrenPinned } from "../../lib/agent-pinned";

/**
 * Seeing the lessons a parent recorded (gh#353).
 *
 * No tool could look at these. On 2026-07-27 a parent asked three times
 * to move a recording filed under the wrong child, and Homa answered "I
 * don't see any recording anywhere" while the row sat in the table, 28
 * minutes of audio, already analysed. She was not refusing; she had no
 * way to look, which reads to a parent as being told her work does not
 * exist.
 */
export default defineBoundedTool({
  description:
    "List the lessons this family has recorded, newest first, with which child each is filed under. Use whenever the parent mentions a recording, asks where one went, or says one is under the wrong child. Never tell her a recording does not exist without calling this first.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("How many recordings to return, newest first."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { found: 0, note: error.message };
      }
      throw error;
    }

    const [recordings, children] = await Promise.all([
      listLessonRecordingsForFamily(access.familyId, input.limit),
      getChildrenPinned(access.familyId),
    ]);
    const childNames = new Map(children.map((child) => [child.id, child.name]));

    return {
      found: recordings.length,
      recordings: recordings.map((recording) => ({
        lessonId: recording.id,
        childId: recording.childId,
        childName: childNames.get(recording.childId) ?? null,
        startedAt: recording.startedAt,
        durationSeconds: recording.durationSeconds,
        status: recording.status,
        source: recording.source,
      })),
      note:
        recordings.length === 0
          ? "This family has recorded no lessons. Say that plainly; do not guess that one exists elsewhere."
          : "If she says one is filed under the wrong child, move it with reassign_lesson_recording rather than asking her to re-record.",
    };
  },
});
