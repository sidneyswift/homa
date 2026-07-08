import { buildFourWeekPlan, type Curriculum, type MapAnswer, type MapScores } from "@homa/core";

import { mapDb, type DbJson } from "./db";
import type { ReportFacts, SubjectFacts } from "./narrative-facts";
import { buildReportFacts } from "./narrative-facts";

/**
 * Server-only (mapDb) reads/writes for the "Call Homa" curriculum
 * feature. Used by both API routes: the trigger route (after an
 * RLS-scoped ownership check has already proven the caller owns this
 * child) and the Telnyx insights webhook (which has no caller session at
 * all, the same posture as the rest of the map lead pipeline). familyId
 * and childId always come from a prior RLS check or from a matching
 * 'initiated' call row, never trusted blindly from webhook input.
 */

/** Builds this child's report facts from the product-side tables, the
 * same shape narrative-generate.ts already writes reports from. */
export async function buildReportFactsForChild(childId: string): Promise<ReportFacts | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      child_name: string;
      birth_month: string;
      profile: Record<string, unknown>;
      first_name: string | null;
      scores: MapScores;
      history: unknown[];
      narrative: { note?: string; synthesis?: string } | null;
      generated_at: string;
    }[]
  >`
    select c.name as child_name, to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           c.profile, f.first_name,
           r.scores, r.history, r.narrative, r.generated_at::text as generated_at
    from public.children c
    join public.families f on f.id = c.family_id
    join public.child_reports r on r.child_id = c.id
    where c.id = ${childId}
  `;
  const row = rows[0];
  if (!row) return null;

  const answerRows = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${childId}
  `;

  const profile = row.profile ?? {};
  const interests = Array.isArray(profile.interests)
    ? profile.interests.filter((item): item is string => typeof item === "string")
    : [];
  const focus = typeof profile.focus === "string" ? [profile.focus] : [];

  const planRows = await sql<{ domain_id: string; progress: Record<string, boolean> }[]>`
    select domain_id, progress from public.child_plans where child_id = ${childId}
  `;

  return buildReportFacts({
    childName: row.child_name,
    birthMonth: row.birth_month,
    parentFirstName: row.first_name,
    interests,
    helpWith: focus,
    whatsWorkingByDomain: {},
    scores: row.scores,
    answers: answerRows.map((entry) => ({ itemId: entry.question_id, answer: entry.answer })),
    history: row.history as { scores: MapScores; generated_at: string }[],
    priorLetter: row.narrative
      ? {
          generatedAt: row.generated_at,
          note: row.narrative.note ?? "",
          synthesis: row.narrative.synthesis ?? "",
        }
      : null,
    practice: planRows.map((plan) => ({
      subjectName: plan.domain_id,
      done: Object.values(plan.progress ?? {}).filter(Boolean).length,
      total: 0,
    })),
  });
}

/** Lower = needs more help / less confirmed; the call should spend its
 * questions here first, never on subjects already ahead or on track. */
const SUBJECT_PRIORITY: Record<SubjectFacts["position"], number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

/**
 * The curriculum call's targeting brief (founder note 2026-07-07: "guide
 * the user to extract MISSING CONTEXT... focus on getting info she needs
 * to improve the child's scores in the subjects that need the most
 * help"). Ranks subjects worst-first and, for each, names exactly what
 * is already confirmed versus what is still an unconfirmed guess, so the
 * assistant asks targeted questions instead of wandering.
 */
export function buildCallFocusSummary(facts: ReportFacts, max = 2): string {
  // Only subjects that genuinely need help (not_mapped or growing).
  // Never pad with an on_track/ahead subject just to fill a slot; a
  // child with one real gap gets one focus, not a manufactured second
  // question with nothing left to ask.
  const needsHelp = facts.subjects.filter((subject) => SUBJECT_PRIORITY[subject.position] <= 1);
  const focus = [...needsHelp]
    .sort((a, b) => SUBJECT_PRIORITY[a.position] - SUBJECT_PRIORITY[b.position])
    .slice(0, max);
  if (focus.length === 0) {
    return "Every mapped subject is on track or ahead. Ask what a typical learning day looks like and confirm the family's own sense of where to grow next.";
  }

  return focus
    .map((subject, index) => {
      const confirmed = subject.confirmedSkill
        ? `Confirmed so far: ${subject.confirmedSkill}.`
        : "Nothing confirmed yet in this subject.";
      const gap = subject.nextStep
        ? `Unconfirmed guess to check with the parent: ${subject.nextStep}.`
        : "No specific next step on file, ask what this actually looks like day to day.";
      const count = `${subject.observations} observation${subject.observations === 1 ? "" : "s"} so far`;
      return `${index + 1}. ${subject.subjectName} (${subject.badge}, ${count}). ${confirmed} ${gap}`;
    })
    .join("\n");
}

export interface PendingCall {
  id: string;
  childId: string;
  familyId: string;
}

/** The most recent 'initiated' call for this child, within a generous
 * window; correlates a Telnyx-echoed child_id back to a real call this
 * server placed, so the webhook never trusts a bare id from the model. */
export async function getPendingCallForChild(childId: string): Promise<PendingCall | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string; family_id: string }[]>`
    select id, family_id from public.child_curriculum_calls
    where child_id = ${childId} and status = 'initiated'
      and created_at > now() - interval '2 hours'
    order by created_at desc
    limit 1
  `;
  const row = rows[0];
  return row ? { id: row.id, childId, familyId: row.family_id } : null;
}

export async function markCallCompleted(
  callId: string,
  transcriptFacts: unknown,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.child_curriculum_calls
    set status = 'completed', transcript_facts = ${sql.json(transcriptFacts as DbJson)},
        completed_at = now()
    where id = ${callId}
  `;
}

export async function markCallFailed(callId: string, error: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.child_curriculum_calls
    set status = 'failed', error = ${error}, completed_at = now()
    where id = ${callId}
  `;
}

export async function upsertCurriculum(
  childId: string,
  callId: string,
  curriculum: Curriculum,
  model: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    insert into public.child_curricula (child_id, call_id, curriculum, model)
    values (${childId}, ${callId}, ${sql.json(curriculum as unknown as DbJson)}, ${model})
    on conflict (child_id) do update
      set call_id = excluded.call_id,
          curriculum = excluded.curriculum,
          model = excluded.model,
          generated_at = now(),
          updated_at = now()
  `;
}

/** Re-exported so the fallback path (curriculum-generate.ts) and the
 * webhook route share one deterministic-plan entry point. */
export { buildFourWeekPlan };
