import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { getChildrenPinned } from "../../lib/agent-pinned";
import { ageInMonths } from "../../lib/child-age";

/**
 * Reads the caller's children and their profiles. Family scope comes from
 * the session auth context, never from model input, and the query runs
 * under the caller's own RLS, so a bad familyId cannot cross a tenant wall.
 */
export default defineBoundedTool({
  description:
    "Re-read the children in this family with their ages, interests, and current focus. The same data auto-loads at every turn start, so only call this to double-check mid-conversation, e.g. right after a profile change.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { children: [], note: error.message };
      }
      throw error;
    }

    if (access.mode === "pinned") {
      return { children: await getChildrenPinned(access.familyId) };
    }

    const { db, familyId } = access;

    const { data, error } = await db
      .from("children")
      .select("id, name, birth_month, profile, avatar_url")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    if (error) {
      return { children: [], note: `Could not read children: ${error.message}` };
    }

    const now = new Date();
    const children = (data ?? []).map((child) => {
      const months = ageInMonths(child.birth_month, now);
      const profile = (child.profile ?? {}) as {
        interests?: string[];
        focus?: string;
      };
      return {
        id: child.id,
        name: child.name,
        ageYears: Math.floor(months / 12),
        ageMonths: months,
        interests: profile.interests ?? [],
        focus: profile.focus ?? null,
        // The D4-consented profile photo: a generate_image reference
        // for materials that show this child; null when unset.
        photoUrl: child.avatar_url ?? null,
      };
    });

    return { children };
  },
});
