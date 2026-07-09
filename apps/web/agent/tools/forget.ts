import { defineTool } from "eve/tools";
import { z } from "zod";

import { createCallerDbClient, MissingFamilyContextError } from "../../lib/agent-db";
import { MEMORY_KINDS } from "../../lib/agent-memory";

/**
 * Retires exactly one memory row by content match (M2-02). Substring
 * matching instead of ids keeps the model from hallucinating identifiers
 * (the Hermes pattern); ambiguity returns the candidates instead of
 * guessing. Since migration #36 this SUPERSEDES rather than deletes: the
 * row leaves the pinned context and the /home card but stays in the
 * archive, so point-in-time recall ("what was she into in February?")
 * survives corrections. The parent's Remove button on /home remains a
 * hard delete (privacy decision vs history decision).
 */
export default defineTool({
  description:
    "Retire one saved memory that is wrong or stale, matched by a distinctive phrase from its content. If the parent corrects a fact, forget the old entry and remember the corrected one in the same turn. The old entry stays in searchable history; it just stops being current.",
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
      .is("superseded_at", null)
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
    const { error: updateError } = await db
      .from("family_memories")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", target.id)
      .eq("family_id", familyId);
    if (updateError) {
      return { deleted: false, note: `Could not retire it: ${updateError.message}` };
    }

    return {
      deleted: true,
      forgot: target.content,
      note: "Retired from active memory (still in searchable history). If the parent wants it back, save it again with remember.",
    };
  },
});
