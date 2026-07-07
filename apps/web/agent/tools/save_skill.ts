import { defineTool } from "eve/tools";
import { z } from "zod";

import { createCallerDbClient, MissingFamilyContextError } from "../../lib/agent-db";
import { scanMemoryContent } from "../../lib/agent-memory";
import {
  FAMILY_SKILLS_MAX_COUNT,
  SKILL_DESCRIPTION_MAX_CHARS,
  SKILL_MARKDOWN_MAX_CHARS,
  SKILL_NAME_PATTERN,
} from "../../lib/agent-skills";

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
    let clientBundle;
    try {
      clientBundle = createCallerDbClient(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { saved: false, note: error.message };
      }
      throw error;
    }
    const { db, familyId } = clientBundle;

    for (const text of [input.description, input.markdown]) {
      const blocked = scanMemoryContent(text);
      if (blocked) return { saved: false, note: blocked };
    }

    const { data: existing, error: readError } = await db
      .from("family_skills")
      .select("name")
      .eq("family_id", familyId);
    if (readError) {
      return { saved: false, note: `Could not read the skill library: ${readError.message}` };
    }

    const names = (existing ?? []).map((row) => row.name);
    const isUpdate = names.includes(input.name);
    if (!isUpdate && names.length >= FAMILY_SKILLS_MAX_COUNT) {
      return {
        saved: false,
        note: `The skill library is at its limit of ${FAMILY_SKILLS_MAX_COUNT}. Ask the parent which one to retire (forget_skill), then retry.`,
        current_skills: names,
      };
    }

    const { error: writeError } = await db.from("family_skills").upsert(
      {
        family_id: familyId,
        name: input.name,
        description: input.description,
        markdown: input.markdown,
        source: "homa",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "family_id,name" },
    );
    if (writeError) {
      return { saved: false, note: `Could not save: ${writeError.message}` };
    }

    return {
      saved: true,
      done: true,
      name: input.name,
      updated: isUpdate,
      note: `Skill ${isUpdate ? "updated" : "saved"}. It becomes loadable from the next turn on. Tell the parent in one short natural aside.`,
    };
  },
});
