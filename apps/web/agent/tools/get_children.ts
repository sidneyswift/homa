import { defineTool } from "eve/tools";
import { z } from "zod";

import { createCallerDbClient, MissingFamilyContextError } from "../../lib/agent-db";

/**
 * Reads the caller's children and their profiles. Family scope comes from
 * the session auth context, never from model input, and the query runs
 * under the caller's own RLS, so a bad familyId cannot cross a tenant wall.
 */
export default defineTool({
  description:
    "Re-read the children in this family with their ages, interests, and current focus. The same data auto-loads at every turn start, so only call this to double-check mid-conversation, e.g. right after a profile change.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    let clientBundle;
    try {
      clientBundle = createCallerDbClient(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { children: [], note: error.message };
      }
      throw error;
    }
    const { db, familyId } = clientBundle;

    const { data, error } = await db
      .from("children")
      .select("id, name, birth_month, profile")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    if (error) {
      return { children: [], note: `Could not read children: ${error.message}` };
    }

    const now = new Date();
    const children = (data ?? []).map((child) => {
      const birth = new Date(child.birth_month);
      const months =
        (now.getFullYear() - birth.getFullYear()) * 12 +
        (now.getMonth() - birth.getMonth());
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
      };
    });

    return { children };
  },
});
