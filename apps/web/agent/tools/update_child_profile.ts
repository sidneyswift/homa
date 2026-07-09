import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { updateChildProfilePinned } from "../../lib/agent-pinned";
import { scanMemoryContent } from "../../lib/agent-memory";

/**
 * Schema-bounded profile updates (a first slice of the M2-04 profile
 * engine, constrained per the M2-13 posture: enumerated fields with hard
 * caps, no free-form profile writes). Interests and focus feed worksheet
 * personalization and the per-turn context block, so they are scanned like
 * memory content before they can re-enter future prompts.
 */

const updateInput = z
  .object({
    childId: z
      .uuid()
      .describe("The child to update (id from the family context block)."),
    interests: z
      .array(z.string().min(1).max(40))
      .max(12)
      .optional()
      .describe("Full replacement list of current interests (their obsessions, the worksheet hooks)."),
    focus: z
      .string()
      .min(1)
      .max(160)
      .optional()
      .describe("What this child is working on right now, one short phrase."),
  })
  .refine((value) => value.interests !== undefined || value.focus !== undefined, {
    message: "Provide interests, focus, or both.",
  });

export default defineTool({
  description:
    "Update a child's profile when their interests or current focus genuinely change (a new obsession, a mastered skill, a new goal). Provide the full interests list when updating interests; it replaces the old list.",
  inputSchema: updateInput,
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { updated: false, note: error.message };
      }
      throw error;
    }

    const interests = input.interests
      ?.map((interest) => interest.trim())
      .filter(Boolean);
    for (const text of [...(interests ?? []), input.focus ?? ""]) {
      const blocked = text ? scanMemoryContent(text) : null;
      if (blocked) {
        return { updated: false, note: blocked };
      }
    }

    if (access.mode === "pinned") {
      const result = await updateChildProfilePinned({
        familyId: access.familyId,
        childId: input.childId,
        ...(interests !== undefined ? { interests } : {}),
        ...(input.focus !== undefined ? { focus: input.focus } : {}),
      });
      return result.updated
        ? {
            ...result,
            note: "Profile updated; the fresh values load automatically next turn. Mention the change to the parent in a short natural aside.",
          }
        : result;
    }

    const { db, familyId } = access;

    const { data: child, error: readError } = await db
      .from("children")
      .select("id, name, profile")
      .eq("id", input.childId)
      .eq("family_id", familyId)
      .maybeSingle();
    if (readError) {
      return { updated: false, note: `Could not read the child: ${readError.message}` };
    }
    if (!child) {
      return {
        updated: false,
        note: "That child id is not in this family. Use an id from the family context block.",
      };
    }

    const currentProfile = (child.profile ?? {}) as Record<string, unknown>;
    const nextProfile = {
      ...currentProfile,
      ...(interests !== undefined ? { interests } : {}),
      ...(input.focus !== undefined ? { focus: input.focus } : {}),
    };

    const { error: updateError } = await db
      .from("children")
      .update({ profile: nextProfile, updated_at: new Date().toISOString() })
      .eq("id", child.id)
      .eq("family_id", familyId);
    if (updateError) {
      return { updated: false, note: `Could not update: ${updateError.message}` };
    }

    return {
      updated: true,
      childName: child.name,
      profile: nextProfile,
      note: "Profile updated; the fresh values load automatically next turn. Mention the change to the parent in a short natural aside.",
    };
  },
});
