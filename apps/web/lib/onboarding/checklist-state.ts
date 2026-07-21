import {
  ageInMonths,
  buildMapQuestionQueue,
  planQuestions,
  type MapAnswer,
} from "@homa/core";

import { mapDb } from "../map/db";

/**
 * Where one child stands in their questions, read server-side.
 *
 * The checklist UI computes this in the browser from the question bank
 * plus the answers it holds. The agent needs the same numbers without a
 * browser, so this recomputes them from the same pure bank functions
 * against the stored answers. One source of truth for the plan, two
 * places that ask it.
 *
 * Everything here is derived. Nothing about a child's position is stored
 * in the onboarding record, because a stored copy would go stale the
 * moment she answered one more question on another device, and then Homa
 * would tell her something the screen contradicts.
 */

export interface ChecklistState {
  childId: string;
  childName: string;
  ageMonths: number;
  /** False when the child's age is outside what the question bank covers. */
  scoredAgeRange: boolean;
  answered: number;
  skipped: number;
  /** Open questions left. Zero means ready to score. */
  remaining: number;
  /** A plain-language estimate, matching what the checklist screen says. */
  minutesLeft: number;
  complete: boolean;
  /** True once this child has a scored report. */
  reported: boolean;
}

/** The checklist screen's own constant, so the two never disagree. */
const SECONDS_PER_SUBJECT = 18;

export function minutesLeftForRemaining(remaining: number): number {
  return Math.max(1, Math.ceil((remaining * SECONDS_PER_SUBJECT) / 60));
}

interface ChildRow {
  id: string;
  name: string;
  birth_month: string;
  pending_band: boolean;
}

function stateFromRows(
  child: ChildRow,
  answers: { question_id: string; answer: MapAnswer }[],
  reported: boolean,
): ChecklistState {
  const ageMonths = ageInMonths(child.birth_month);
  const answerMap: Record<string, MapAnswer> = {};
  for (const row of answers) answerMap[row.question_id] = row.answer;
  const remaining = buildMapQuestionQueue(planQuestions(ageMonths), answerMap).length;
  const answered = answers.length;
  return {
    childId: child.id,
    childName: child.name,
    ageMonths,
    scoredAgeRange: !child.pending_band,
    answered,
    skipped: answers.filter((row) => row.answer === "skip").length,
    remaining,
    minutesLeft: minutesLeftForRemaining(remaining),
    // A child with zero answers is never complete, even though an empty
    // queue would say so: the same rule the flow's own
    // isMapChecklistComplete applies.
    complete: answered > 0 && remaining === 0,
    reported,
  };
}

/**
 * loadChecklistState(familyId, childId): one child's position, or null
 * when that child is not in this family. The family predicate is the
 * tenancy wall on this path: there is no JWT on a pinned session, so a
 * model-supplied child id is re-scoped here or nowhere.
 */
export async function loadChecklistState(
  familyId: string,
  childId: string,
): Promise<ChecklistState | null> {
  const sql = mapDb();
  const children = await sql<ChildRow[]>`
    select id, name, to_char(birth_month, 'YYYY-MM-DD') as birth_month, pending_band
    from public.children
    where id = ${childId} and family_id = ${familyId}
  `;
  const child = children[0];
  if (!child) return null;

  const [answers, reports] = await Promise.all([
    sql<{ question_id: string; answer: MapAnswer }[]>`
      select a.question_id, a.answer
      from public.child_answers a
      join public.children c on c.id = a.child_id
      where a.child_id = ${childId} and c.family_id = ${familyId}
    `,
    sql<{ id: string }[]>`
      select r.id
      from public.child_reports r
      join public.children c on c.id = r.child_id
      where r.child_id = ${childId} and c.family_id = ${familyId}
      limit 1
    `,
  ]);

  return stateFromRows(child, answers, reports.length > 0);
}

/**
 * loadFamilyChecklistStates(familyId): every child's position, oldest
 * child record first, for the onboarding context line and the re-entry
 * greeting. One query per table rather than one per child.
 */
export async function loadFamilyChecklistStates(
  familyId: string,
): Promise<ChecklistState[]> {
  const sql = mapDb();
  const children = await sql<ChildRow[]>`
    select id, name, to_char(birth_month, 'YYYY-MM-DD') as birth_month, pending_band
    from public.children
    where family_id = ${familyId}
    order by created_at asc
  `;
  if (children.length === 0) return [];

  const [answers, reports] = await Promise.all([
    sql<{ child_id: string; question_id: string; answer: MapAnswer }[]>`
      select a.child_id, a.question_id, a.answer
      from public.child_answers a
      join public.children c on c.id = a.child_id
      where c.family_id = ${familyId}
    `,
    sql<{ child_id: string }[]>`
      select r.child_id
      from public.child_reports r
      join public.children c on c.id = r.child_id
      where c.family_id = ${familyId}
    `,
  ]);

  const answersByChild = new Map<string, { question_id: string; answer: MapAnswer }[]>();
  for (const row of answers) {
    const list = answersByChild.get(row.child_id) ?? [];
    list.push({ question_id: row.question_id, answer: row.answer });
    answersByChild.set(row.child_id, list);
  }
  const reported = new Set(reports.map((row) => row.child_id));

  return children.map((child) =>
    stateFromRows(child, answersByChild.get(child.id) ?? [], reported.has(child.id)),
  );
}
