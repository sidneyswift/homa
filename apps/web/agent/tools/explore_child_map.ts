import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  MissingFamilyContextError,
  resolveAgentAccess,
  type AgentAccess,
} from "../../lib/agent-db";
import { ageInMonths } from "../../lib/child-age";
import {
  exploreChildMap,
  type ExploreAnswerRow,
  type ExploreChildMapQuery,
} from "../../lib/map/explore-child-map";
import { mapDb } from "../../lib/map/db";

/**
 * Read-only exploration of one child's learning map: the anchored
 * checklist ladder, the taxonomy teaching graph (prerequisites with
 * reasons, readiness, bottlenecks, teaching order), and the child's own
 * evidence joined in. No writes, ever: recording evidence stays with
 * manage_child_progress, so exploring can never change a score.
 *
 * Tenancy: familyId comes from session auth only; the model-supplied
 * childId is re-verified inside THAT family on both access paths
 * (caller RLS, pinned server reads), the same wall as every other tool.
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
    query: z.enum([
      "subject_map",
      "topic",
      "ready_next",
      "bottleneck",
      "teaching_order",
      "search_topics",
    ]),
    childId: z.string().uuid(),
    subjectId: subjectIdSchema.optional(),
    domainId: subjectIdSchema.optional(),
    topicId: topicIdSchema.optional(),
    topicIds: z.array(topicIdSchema).min(1).max(12).optional(),
    searchText: z.string().trim().min(2).max(120).optional(),
    limit: z.number().int().min(1).max(10).optional(),
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

interface LoadedChild {
  name: string;
  birthMonth: string;
  answers: ExploreAnswerRow[];
}

/** Loads the child + answers under the caller's own RLS. */
async function loadChildViaCaller(
  access: Extract<AgentAccess, { mode: "caller" }>,
  childId: string,
): Promise<LoadedChild | null> {
  const child = await access.db
    .from("children")
    .select("id, name, birth_month")
    .eq("id", childId)
    .eq("family_id", access.familyId)
    .maybeSingle();
  if (child.error || !child.data) return null;
  // RLS walls these rows to the caller's own children; the inner-join
  // family filter is the usual belt (same shape as lib family context).
  const answers = await access.db
    .from("child_answers")
    .select("question_id, answer, children!inner()")
    .eq("child_id", childId)
    .eq("children.family_id", access.familyId);
  if (answers.error) return null;
  return {
    name: child.data.name as string,
    birthMonth: child.data.birth_month as string,
    answers: (answers.data ?? []).map((row) => ({
      itemId: row.question_id as string,
      answer: row.answer as ExploreAnswerRow["answer"],
    })),
  };
}

/** Loads the child + answers on the server connection pinned to the
 * session's family (SMS, email, dispatch); the explicit family predicate
 * is the wall, as in lib/agent-pinned. */
async function loadChildPinned(
  familyId: string,
  childId: string,
): Promise<LoadedChild | null> {
  const sql = mapDb();
  const children = await sql<{ name: string; birth_month: string }[]>`
    select name, to_char(birth_month, 'YYYY-MM-DD') as birth_month
    from public.children
    where id = ${childId} and family_id = ${familyId}
  `;
  const child = children[0];
  if (!child) return null;
  const answers = await sql<{ question_id: string; answer: string }[]>`
    select a.question_id, a.answer
    from public.child_answers a
    join public.children c on c.id = a.child_id
    where a.child_id = ${childId} and c.family_id = ${familyId}
  `;
  return {
    name: child.name,
    birthMonth: child.birth_month,
    answers: answers.map((row) => ({
      itemId: row.question_id,
      answer: row.answer as ExploreAnswerRow["answer"],
    })),
  };
}

const WRONG_CHILD_NOTE =
  "That child id is not in this family. Use a child id from the family context block.";

export default defineTool({
  description:
    "Explore one child's learning map, read-only. subject_map: the checklist ladder with the child's answers, the chart figure, and the subject's skill-line domains. topic: one skill in depth (what it is, prerequisites with reasons, what it unlocks, a try-at-home check). ready_next: skills whose prerequisites this child has already confirmed, best first. bottleneck: the earliest unconfirmed prerequisite standing before a target skill. teaching_order: sort chosen topics prerequisites-first. search_topics: find real topic and checklist ids by words. Use it to answer where a child is, what is missing, what comes next and why. It never records anything; save evidence with manage_child_progress.",
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

    const parsedQuery = exploreQuerySchema.safeParse(
      Object.fromEntries(
        Object.entries(input).filter(
          ([key, value]) => key !== "childId" && value !== undefined,
        ),
      ),
    );
    if (!parsedQuery.success) {
      return {
        error: "invalid_query",
        note: "That query is missing its required fields. subject_map needs subjectId; topic and bottleneck need topicId; teaching_order needs topicIds; search_topics needs searchText.",
      };
    }

    const child =
      access.mode === "caller"
        ? await loadChildViaCaller(access, input.childId)
        : await loadChildPinned(access.familyId, input.childId);
    if (!child) {
      return { error: "unknown_child", note: WRONG_CHILD_NOTE };
    }

    return exploreChildMap(
      {
        childName: child.name,
        ageMonths: ageInMonths(child.birthMonth, new Date()),
        answers: child.answers,
      },
      parsedQuery.data as ExploreChildMapQuery,
    );
  },
});
