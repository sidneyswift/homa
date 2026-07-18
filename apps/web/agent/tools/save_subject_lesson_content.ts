import { defineTool } from "eve/tools";
import { z } from "zod";

import { readSubjectLessonTrustedContext } from "../../lib/subject-lessons/dispatch-input";
import { saveSubjectLessonContentPinned } from "../../lib/subject-lessons/store";

/**
 * Model-owned teaching content only. Lesson, family, and attempt identity are
 * deliberately absent because the trusted session supplies them.
 */
export const saveSubjectLessonContentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    materials: z.array(z.string().trim().min(1).max(160)).max(8),
    steps: z.array(z.string().trim().min(1).max(500)).min(3).max(5),
    practice: z.string().trim().min(1).max(800),
  })
  .strict();

export type SaveSubjectLessonContentInput = z.infer<
  typeof saveSubjectLessonContentInputSchema
>;

type SaveSubjectLessonContentOperation = typeof saveSubjectLessonContentPinned;

/**
 * Joins model-authored content to the server-stamped lesson identity at the
 * final write boundary. The injected operation keeps this seam testable
 * without a database.
 */
export async function saveSubjectLessonContentForTrustedSession(
  input: SaveSubjectLessonContentInput,
  attributes: unknown,
  saveContent: SaveSubjectLessonContentOperation = saveSubjectLessonContentPinned
): Promise<{ saved: boolean; note: string }> {
  const trusted = readSubjectLessonTrustedContext(attributes);
  if (!trusted) {
    return {
      saved: false,
      note: "This tool is only available inside a trusted subject lesson build.",
    };
  }

  const saved = await saveContent({
    familyId: trusted.familyId,
    lessonId: trusted.lessonId,
    attempt: trusted.attempt,
    content: input,
  });
  return saved
    ? {
        saved: true,
        note: "The lesson content is saved. Continue with its worksheet.",
      }
    : {
        saved: false,
        note: "The lesson content did not save for this build attempt. Stop without claiming the lesson finished.",
      };
}

export default defineTool({
  description:
    "Save the title, optional household materials, three to five teaching steps, and one practice suggestion for the trusted subject lesson build. Lesson and family identity come from the session, not this tool input.",
  inputSchema: saveSubjectLessonContentInputSchema,
  async execute(input, ctx) {
    return saveSubjectLessonContentForTrustedSession(
      input,
      ctx.session.auth.current?.attributes
    );
  },
});
