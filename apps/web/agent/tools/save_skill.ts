import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  SKILL_DESCRIPTION_MAX_CHARS,
  SKILL_MARKDOWN_MAX_CHARS,
  SKILL_NAME_PATTERN,
} from "../../lib/agent-skills";
import {
  saveFamilySkillCaller,
  saveFamilySkillPinned,
} from "../../lib/agent-skills-store";

/**
 * "Save this as a skill": writes one reusable procedure to the family's
 * skill library (the skillify loop, cloud edition). Saving under an
 * existing name updates it, which is how "tweak that skill" works. The
 * dynamic resolver advertises the new skill from the next turn on. Content
 * is scanned before it can re-enter future prompts, and the count cap
 * keeps the advertised list bounded.
 */
export default defineTool({
  description:
    "Save a reusable how-to as a named skill for this family, so future conversations can load and follow it. Use when the parent asks to save a way of doing something (a style, a format, a routine) or agrees when you offer. Saving with an existing name updates that skill.",
  inputSchema: z.object({
    name: z
      .string()
      .regex(
        SKILL_NAME_PATTERN,
        "kebab-case, 2 to 49 chars, letters/numbers/hyphens",
      )
      .describe("Short stable kebab-case name, e.g. 'paw-patrol-worksheet'."),
    description: z
      .string()
      .min(8)
      .max(SKILL_DESCRIPTION_MAX_CHARS)
      .describe(
        "The routing hint, written as when to use it: 'Use when the parent asks for Paw Patrol styled materials.'",
      ),
    markdown: z
      .string()
      .min(20)
      .max(SKILL_MARKDOWN_MAX_CHARS)
      .describe(
        "The full procedure as markdown: what makes it work, concrete steps, things to avoid. Written for future-you with no memory of today.",
      ),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { saved: false, note: error.message };
      }
      throw error;
    }

    const result =
      access.mode === "pinned"
        ? await saveFamilySkillPinned(access.familyId, input)
        : await saveFamilySkillCaller(access.db, access.familyId, input);
    if (!result.saved) return result;

    return {
      saved: true,
      done: true,
      name: input.name,
      updated: result.updated,
      note: `Skill ${result.updated ? "updated" : "saved"}. It becomes loadable from the next turn on. Tell the parent in one short natural aside.`,
    };
  },
});
