import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  forgetFamilySkillCaller,
  forgetFamilySkillPinned,
} from "../../lib/agent-skills-store";

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
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { deleted: false, note: error.message };
      }
      throw error;
    }

    const result =
      access.mode === "pinned"
        ? await forgetFamilySkillPinned(access.familyId, input.name)
        : await forgetFamilySkillCaller(access.db, access.familyId, input.name);
    if (!result.deleted) return result;

    return {
      deleted: true,
      name: result.name,
      forgot: result.forgot,
      note: "Deleted. If the parent wants it back, save it again with save_skill.",
    };
  },
});
