import { ageInMonths, MAP_ANSWERS, type MapAnswer } from "@homa/core";
import { getTaxonomyDomain, getTopic, type WalkAnswers } from "@homa/taxonomy";

import { mapDb } from "./db";
import { childBelongsToFamily } from "./store";

/**
 * Database access for graph-walk sittings
 * (plans/2026-07-11-onboarding-depth-fork.md § The seam). Walk answers
 * live in child_answers under taxonomy topic ids with provenance
 * 'onboarding_walk': the months-ahead scorer skips ids it does not know,
 * so these rows are invisible to scoring by construction and start
 * counting only when a topic graduates into the anchored bank.
 *
 * Tenancy law: familyId comes from the session, never the client; every
 * function re-scopes the child inside the family before touching a row.
 */

export async function childAgeMonths(
  familyId: string,
  childId: string,
): Promise<number | null> {
  const sql = mapDb();
  const rows = await sql<{ birth_month: string }[]>`
    select to_char(birth_month, 'YYYY-MM-DD') as birth_month
    from public.children
    where id = ${childId} and family_id = ${familyId}
  `;
  if (rows.length === 0) return null;
  return ageInMonths(rows[0].birth_month);
}

/**
 * Saves one walk chip. Rejects ids that are not assessment-spine
 * taxonomy topics of the claimed subject, so a forged payload can never
 * write outside the walk's lane (bank items keep their own route).
 */
export async function saveWalkAnswer(
  familyId: string,
  childId: string,
  subjectId: string,
  topicId: string,
  answer: MapAnswer,
): Promise<{ ok: boolean; domainId?: string }> {
  const topic = getTopic(topicId);
  if (!topic || topic.subject !== subjectId) return { ok: false };
  const domain = getTaxonomyDomain(topic.domain);
  if (!domain || domain.kind !== "assessment") return { ok: false };
  if (!(await childBelongsToFamily(childId, familyId))) return { ok: false };

  const sql = mapDb();
  await sql`
    insert into public.child_answers (child_id, question_id, answer, source)
    values (${childId}, ${topicId}, ${answer}, 'onboarding_walk')
    on conflict (child_id, question_id)
    do update set answer = excluded.answer, answered_at = now()
  `;
  return { ok: true, domainId: topic.domain };
}

/**
 * Every stored answer of this child that resolves to a taxonomy topic,
 * whatever wrote it (a walk sitting, the agent's record_observation):
 * the walk engine folds all topic signal, never just its own rows.
 * Bank-item answers are filtered out here; they live on the anchored
 * ladder, which the graph does not model.
 */
export async function loadWalkAnswers(
  familyId: string,
  childId: string,
): Promise<WalkAnswers | null> {
  if (!(await childBelongsToFamily(childId, familyId))) return null;
  const sql = mapDb();
  const rows = await sql<{ question_id: string; answer: string }[]>`
    select question_id, answer from public.child_answers where child_id = ${childId}
  `;
  const answers: Record<string, MapAnswer> = {};
  for (const row of rows) {
    if (!getTopic(row.question_id)) continue;
    if (!(MAP_ANSWERS as readonly string[]).includes(row.answer)) continue;
    answers[row.question_id] = row.answer as MapAnswer;
  }
  return answers;
}
