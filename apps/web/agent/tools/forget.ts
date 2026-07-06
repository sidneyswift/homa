import { defineTool } from "eve/tools";
import { z } from "zod";

import { createCallerDbClient, MissingFamilyContextError } from "../../lib/agent-db";
import { MEMORY_KINDS } from "../../lib/agent-memory";

/**
 * Deletes exactly one memory row by content match (M2-02). Substring
 * matching instead of ids keeps the model from hallucinating identifiers
 * (the Hermes pattern); ambiguity returns the candidates instead of
 * guessing. The deleted content comes back in the result so "actually,
 * keep that" can be honored with a fresh remember call.
 */
export default defineTool({
  description:
    "Delete one saved memory that is wrong or stale, matched by a distinctive phrase from its content. If the parent corrects a fact, forget the old entry and remember the corrected one in the same turn.",
  inputSchema: z.object({
    match: z
      .string()
      .min(3)
      .max(300)
      .describe("A distinctive phrase from the memory to delete (case-insensitive)."),
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

    const { data, error } = await db
      .from("family_memories")
      .select("id, content")
      .eq("family_id", familyId)
      .in("kind", [...MEMORY_KINDS]);
    if (error) {
      return { deleted: false, note: `Could not read memory: ${error.message}` };
    }

    const needle = input.match.toLowerCase();
    const matches = (data ?? []).filter((row) =>
      row.content.toLowerCase().includes(needle),
    );

    if (matches.length === 0) {
      return {
        deleted: false,
        note: "No saved memory matches that phrase.",
        current_memories: (data ?? []).map((row) => row.content),
      };
    }
    if (matches.length > 1) {
      return {
        deleted: false,
        note: "That phrase matches more than one memory. Retry with a longer, unique phrase.",
        matches: matches.map((row) => row.content),
      };
    }

    const target = matches[0];
    const { error: deleteError } = await db
      .from("family_memories")
      .delete()
      .eq("id", target.id)
      .eq("family_id", familyId);
    if (deleteError) {
      return { deleted: false, note: `Could not delete: ${deleteError.message}` };
    }

    return {
      deleted: true,
      forgot: target.content,
      note: "Deleted. If the parent wants it back, save it again with remember.",
    };
  },
});
