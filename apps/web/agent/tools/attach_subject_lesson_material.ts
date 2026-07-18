import { defineTool } from "eve/tools";
import { z } from "zod";

import { readSubjectLessonTrustedContext } from "../../lib/subject-lessons/dispatch-input";
import { attachSubjectLessonMaterialPinned } from "../../lib/subject-lessons/store";

/**
 * The model may name only the material returned by create_printable. Lesson,
 * family, and attempt identity remain trusted session data.
 */
export const attachSubjectLessonMaterialInputSchema = z
  .object({
    materialId: z.uuid(),
  })
  .strict();

export type AttachSubjectLessonMaterialInput = z.infer<
  typeof attachSubjectLessonMaterialInputSchema
>;

type AttachSubjectLessonMaterialOperation =
  typeof attachSubjectLessonMaterialPinned;

/**
 * Re-scopes the model-selected material through the trusted lesson attempt.
 * The store performs the final family, child, review, and provenance checks.
 */
export async function attachSubjectLessonMaterialForTrustedSession(
  input: AttachSubjectLessonMaterialInput,
  attributes: unknown,
  attachMaterial: AttachSubjectLessonMaterialOperation = attachSubjectLessonMaterialPinned
): Promise<{ attached: boolean; note: string }> {
  const trusted = readSubjectLessonTrustedContext(attributes);
  if (!trusted) {
    return {
      attached: false,
      note: "This tool is only available inside a trusted subject lesson build.",
    };
  }

  const attached = await attachMaterial({
    familyId: trusted.familyId,
    lessonId: trusted.lessonId,
    attempt: trusted.attempt,
    materialId: input.materialId,
  });
  return attached
    ? {
        attached: true,
        note: "The worksheet is attached to the lesson.",
      }
    : {
        attached: false,
        note: "That material could not be attached to this lesson and build attempt. Stop without claiming the lesson finished.",
      };
}

export default defineTool({
  description:
    "Attach one create_printable material to the trusted subject lesson build after its review passes or review is unavailable. The server re-checks family, child, lesson provenance, and build attempt.",
  inputSchema: attachSubjectLessonMaterialInputSchema,
  async execute(input, ctx) {
    return attachSubjectLessonMaterialForTrustedSession(
      input,
      ctx.session.auth.current?.attributes
    );
  },
});
