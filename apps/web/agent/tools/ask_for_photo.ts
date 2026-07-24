import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";

/**
 * The snap card (approved chat redesign 2026-07-13, frame B): when
 * seeing the actual work would change the help, the agent asks with a
 * camera card instead of a paragraph. Web chat renders the output as a
 * one-question card whose primary button opens the camera, so snapping
 * the page IS the answer; the parent can also pick from her photos or
 * type instead. Nothing sends until she sends.
 *
 * No family data is read or written here: the tool is a structured ask,
 * pure UI contract, same pattern as manage_child_progress's cards.
 */
export default defineBoundedTool({
  description:
    "Ask the parent to show you something (a worksheet page, a finished project, a book page) when seeing it would genuinely change your help: checking handwriting, reviewing completed work, or settling what a page looks like. In web chat this renders a card with a camera button. Ask for ONE thing, name exactly which page or thing you mean, and never ask when words already told you enough. Over SMS ask in plain words instead; the parent can text a photo back.",
  deadlineMs: TOOL_DEADLINE.quick,
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .max(200)
      .describe(
        'The one question, in plain warm words, e.g. "Can you show me the page Maya finished yesterday?"',
      ),
    hint: z
      .string()
      .max(120)
      .optional()
      .describe(
        'One short line naming exactly which page or thing you mean, e.g. "The copywork page with the g and y rows." Include it whenever the parent might have to guess.',
      ),
  }),
  async execute(input) {
    return {
      requested: true,
      question: input.question,
      hint: input.hint ?? null,
    };
  },
});
