import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  MissingFamilyContextError,
  resolveAgentAccess,
  type AgentAccess,
} from "../../lib/agent-db";
import { getChildProgressView } from "../../lib/child-progress/runtime";
import { readCanonicalChildMap } from "../../lib/map/canonical-explore";
import type { ExploreChildMapQuery } from "../../lib/map/explore-child-map";

/**
 * Read-only exploration of one child's learning map: the anchored
 * checklist ladder, the taxonomy teaching graph (prerequisites with
 * reasons, readiness, bottlenecks, teaching order), and the child's own
 * evidence joined in. No writes, ever: recording evidence stays with
 * manage_child_progress, so exploring can never change a score.
 *
 * Tenancy: familyId comes from session auth only; the model-supplied
 * childId is re-verified inside THAT family on both access paths
 * (caller RLS child gate, canonical server read pinned to the authenticated family), the same wall as every other tool.
 */

const topicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/u);
const subjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/u);

/** Single flat object schema for provider compatibility (the same
 * pattern as manage_child_progress); the strict per-query union below
 * validates execution. */
const exploreToolInputSchema = z
  .object({
    query: z
      .enum([
        "subject_map",
        "topic",
        "ready_next",
        "bottleneck",
        "teaching_order",
        "search_topics",
      ])
      .describe(
        "subject_map (needs subjectId): the checklist ladder with the child's answers, canonical comparison and credited evidence, and skill-line domains. topic (needs topicId): one skill in depth with prerequisites and what it unlocks. ready_next (optional subjectId, domainId, limit): skills whose prerequisites the child has confirmed, best first. bottleneck (needs topicId): the earliest unconfirmed prerequisite before a target skill. teaching_order (needs topicIds): sort chosen topics prerequisites-first. search_topics (needs searchText, optional subjectId, limit): find real topic and checklist ids by words. Set fields unused by the selected query to null; never invent stand-in values.",
      ),
    childId: z
      .string()
      .uuid()
      .describe("A child id from the family context block."),
    subjectId: subjectIdSchema.nullable().optional(),
    domainId: subjectIdSchema.nullable().optional(),
    topicId: topicIdSchema
      .nullable().optional()
      .describe("A real topic id from a prior result or search_topics; never guessed."),
    topicIds: z.array(topicIdSchema).min(1).max(12).nullable().optional(),
    searchText: z.string().trim().min(2).max(120).nullable().optional(),
    limit: z.number().int().min(1).max(10).nullable().optional(),
  })
  .strict();

const exploreQuerySchema = z.discriminatedUnion("query", [
  z.object({ query: z.literal("subject_map"), subjectId: subjectIdSchema }).strict(),
  z.object({ query: z.literal("topic"), topicId: topicIdSchema }).strict(),
  z
    .object({
      query: z.literal("ready_next"),
      subjectId: subjectIdSchema.optional(),
      domainId: subjectIdSchema.optional(),
      limit: z.number().int().min(1).max(10).optional(),
    })
    .strict(),
  z.object({ query: z.literal("bottleneck"), topicId: topicIdSchema }).strict(),
  z
    .object({
      query: z.literal("teaching_order"),
      topicIds: z.array(topicIdSchema).min(1).max(12),
    })
    .strict(),
  z
    .object({
      query: z.literal("search_topics"),
      searchText: z.string().trim().min(2).max(120),
      subjectId: subjectIdSchema.optional(),
      limit: z.number().int().min(1).max(10).optional(),
    })
    .strict(),
]);

/** Normalize only declared absent fields; strict query validation still rejects
 * supplied unrelated fields and unknown keys (#1169). */
export function parseExploreChildMapQuery(input: Record<string, unknown>) {
  return exploreQuerySchema.safeParse(Object.fromEntries(Object.entries(input).filter(
    ([key, value]) => key !== "childId" &&
      ((value !== undefined && value !== null) || !Object.hasOwn(exploreToolInputSchema.shape, key)),
  )));
}

export default defineBoundedTool({
  description:
    "Explore one child's learning map, read-only. For interpreting its comparison or evidence, load progress-reading. Use it to answer where a child is, what is missing, what comes next and why; the query values describe themselves. It never records anything; save evidence with manage_child_progress.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: exploreToolInputSchema,
  async execute(input, ctx) {
    let access: AgentAccess;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { error: "no_family", note: error.message };
      }
      throw error;
    }

    const parsedQuery = parseExploreChildMapQuery(input);
    if (!parsedQuery.success) {
      return {
        error: "invalid_query",
        note: "That query is missing its required fields. subject_map needs subjectId; topic and bottleneck need topicId; teaching_order needs topicIds; search_topics needs searchText.",
      };
    }

    // Preserve the caller-JWT child authorization check before the shared
    // canonical reader, which uses an explicitly family-pinned server read.
    if (access.mode === "caller") {
      const child = await access.db.from("children").select("id")
        .eq("id", input.childId).eq("family_id", access.familyId).maybeSingle();
      if (child.error) return { error: "progress_unavailable", note: "The current Progress reading could not be checked. Try again." };
      if (!child.data) return { error: "unknown_child", note: "That child is not available in this family. Use an authenticated child ID." };
    }
    return readCanonicalChildMap(
      { familyId: access.familyId, childId: input.childId, query: parsedQuery.data as ExploreChildMapQuery },
      { getView: getChildProgressView },
    );
  },
});
