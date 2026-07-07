import { defineTool } from "eve/tools";
import { z } from "zod";

import { createCallerDbClient, MissingFamilyContextError } from "../../lib/agent-db";

/**
 * Removes one skill from the family's library by its exact name (names are
 * stable and advertised, unlike memory prose, so exact match is right
 * here). The deleted skill comes back in the result so "actually, keep it"
 * can be honored with a fresh save_skill.
 */
export default defineTool({
  description:
    "Delete one saved family skill by its exact name, when the parent asks to remove it or agrees to retire it to make room.",
  inputSchema: z.object({
    name: z.string().min(2).max(49).describe("The skill's exact name."),
  }),
  async execute(input, ctx) {
    let clientBundle;
    try {
      clientBundle = createCallerDbClient(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { deleted: false, note: error.message };
      }
      throw error;
    }
    const { db, familyId } = clientBundle;

    const { data: target, error: readError } = await db
      .from("family_skills")
      .select("id, name, description, markdown")
      .eq("family_id", familyId)
      .eq("name", input.name)
      .maybeSingle();
    if (readError) {
      return { deleted: false, note: `Could not read the skill library: ${readError.message}` };
    }
    if (!target) {
      const { data: all } = await db
        .from("family_skills")
        .select("name")
        .eq("family_id", familyId);
      return {
        deleted: false,
        note: "No skill by that name.",
        current_skills: (all ?? []).map((row) => row.name),
      };
    }

    const { error: deleteError } = await db
      .from("family_skills")
      .delete()
      .eq("id", target.id)
      .eq("family_id", familyId);
    if (deleteError) {
      return { deleted: false, note: `Could not delete: ${deleteError.message}` };
    }

    return {
      deleted: true,
      name: target.name,
      forgot: { description: target.description, markdown: target.markdown },
      note: "Deleted. If the parent wants it back, save it again with save_skill.",
    };
  },
});
