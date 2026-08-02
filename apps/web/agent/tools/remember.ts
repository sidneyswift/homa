import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  MEMORY_ENTRY_MAX_CHARS,
  MEMORY_KINDS,
  scanMemoryContent,
} from "../../lib/agent-memory";
import { saveFamilyMemory } from "../../lib/learning/save-memory";
import { embedText } from "../../lib/learning/embeddings";

/**
 * Writes one durable memory row for this family (M2-02). The family scope
 * comes from session auth; a model-supplied child id only works when that
 * child exists inside the caller's own RLS view. Content is scanned before
 * it can re-enter future system prompts (M2-14 floor), and the family
 * character budget forces consolidation instead of hoarding.
 */
export default defineBoundedTool({
  description:
    "Save one durable fact about this family so future conversations remember it. Use for stable facts (routines, preferences, family rhythm) or per-child what-works teaching signal. Save facts the moment you learn them. Not for task progress, one-off logistics, secrets, or anything sensitive shared in distress.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({
    content: z
      .string()
      .min(4)
      .max(MEMORY_ENTRY_MAX_CHARS)
      .describe("The fact, as one compact self-contained sentence."),
    kind: z
      .enum(MEMORY_KINDS)
      .default("fact")
      .describe("'fact' for family/child facts, 'what_works' for teaching signal."),
    childId: z
      .uuid()
      .optional()
      .describe("Attach to one child (id from the family context block). Omit for family-wide facts."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { saved: false, note: error.message };
      }
      throw error;
    }

    // SMS sessions write through the guarded server path on the
    // phone-mapping trust basis (lib/agent-db.ts resolveAgentAccess).
    if (access.mode === "pinned") {
      const result = await saveFamilyMemory({
        familyId: access.familyId,
        content: input.content,
        kind: input.kind,
        source: "homa",
        childId: input.childId ?? null,
        sessionId: ctx.session.id,
      });
      if (!result.saved) {
        const notes: Record<string, string> = {
          "too-short": "That was too short to save. Say the fact in one full sentence.",
          "blocked-by-scan":
            "That reads like an instruction, not a fact about the family. Rephrase it as a plain fact.",
          duplicate: "Already saved (no duplicate added).",
          "unknown-child":
            "That child id is not in this family. Use an id from the family context block.",
        };
        return {
          saved: result.reason === "duplicate",
          ...(result.reason === "duplicate" ? { done: true } : {}),
          note: notes[result.reason],
        };
      }
      return {
        saved: true,
        done: true,
        content: input.content,
        note: "Saved. This update is complete; do not repeat it. Mention it to the parent in a short natural aside.",
      };
    }

    const { db, familyId } = access;

    const blocked = scanMemoryContent(input.content);
    if (blocked) {
      return { saved: false, note: blocked };
    }

    if (input.childId) {
      const { data: child } = await db
        .from("children")
        .select("id")
        .eq("id", input.childId)
        .eq("family_id", familyId)
        .maybeSingle();
      if (!child) {
        return {
          saved: false,
          note: "That child id is not in this family. Use an id from the family context block.",
        };
      }
    }

    const { data: existing, error: readError } = await db
      .from("family_memories")
      .select("id, child_id, kind, content, source, created_at")
      .eq("family_id", familyId)
      .is("superseded_at", null)
      .in("kind", [...MEMORY_KINDS]);
    if (readError) {
      return { saved: false, note: `Could not read memory: ${readError.message}` };
    }

    const rows = existing ?? [];
    if (rows.some((row) => row.content === input.content)) {
      return { saved: true, done: true, note: "Already saved (no duplicate added)." };
    }

    const memoryId = crypto.randomUUID();
    // Best-effort semantic index; null just means FTS-only for this row.
    const embedding = await embedText(input.content, {
      familyId,
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      resourceKind: "family_memory",
      resourceId: memoryId,
    });

    const { error: insertError } = await db.from("family_memories").insert({
      id: memoryId,
      family_id: familyId,
      child_id: input.childId ?? null,
      kind: input.kind,
      content: input.content,
      source: "homa",
      session_id: ctx.session.id,
      ...(embedding ? { embedding } : {}),
    });
    if (insertError) {
      return { saved: false, note: `Could not save: ${insertError.message}` };
    }

    return {
      saved: true,
      done: true,
      content: input.content,
      note: "Saved. This update is complete; do not repeat it. Mention it to the parent in a short natural aside.",
    };
  },
});
