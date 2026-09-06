import type {
  FourWeekPlan,
  MapAnswer,
  MapScores,
  NarrativeMeta,
  PlanNarrative,
  ReportNarrative,
} from "@homa/core";
import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { buildSavedReportComparisons } from "../child-progress/report-comparison";
import { mapDb, type DbJson } from "./db";
import {
  firstFamilyStyle,
  profileFocusList,
  profileHelpList,
  profileInterestList,
  stringList,
  uniqueStrings,
} from "./profile-context";

/**
 * Narrative reads and writes against the ONE-WORLD tables (child_reports,
 * child_plans), server-only via mapDb like everything family-scoped. The
 * childId always arrives pre-scoped by the caller's cookie-resolved
 * family or by report token, exactly as before the unification.
 *
 * The ::uuid cast on the optional family filter is load-bearing: postgres.js
 * sends parameters untyped, and a bare `$n is null` gives Postgres no
 * context to infer a type, so the whole query fails at parse time (the
 * 2026-07-13 stuck writing beat, BUG-P1-1 in the season field study).
 */

export interface ChangedAnswerSinceScoring {
  itemId: string;
  answer: MapAnswer;
  /** The answer this one replaced (superseded chain), null when the
   * item was newly answered. */
  previousAnswer: MapAnswer | null;
  /** The evidence ledger's source for the new answer: deep_dive,
   * report_correction, recheck, check_in, conversation, checklist... */
  source: string;
}

export interface ReportNarrativeClaim extends NarrativeMeta {
  generationId: string;
  reportGeneratedAt: string;
}

export interface ReportNarrativeSource {
  /** The exact report revision this generation may publish onto. */
  reportGeneratedAt: string;
  familyId: string;
  childId: string;
  childName: string;
  birthMonth: string;
  interests: string[];
  helpWith: string[];
  whatsWorkingBySubject: Record<string, string>;
  parentFirstName: string | null;
  scores: MapScores;
  history: Array<{ scores: MapScores; generated_at: string }>;
  answers: Array<{ itemId: string; answer: MapAnswer }>;
  siblingNames: string[];
  /** The archived previous letter (history head), the writer's memory. */
  priorLetter: { generatedAt: string; note: string } | null;
  /** Synced plan check-offs, one row per subject with any progress. */
  practice: Array<{ subjectName: string; done: number; total: number }>;
  /** Every answer that landed or changed between the previous scoring
   * and this one, straight from the evidence ledger with its source, so
   * the writer can say WHY this rewrite exists ("you took a deeper look
   * at language") and what moved. Empty on a first report and on
   * rescores where nothing actually changed. */
  changedSinceLastScoring: ChangedAnswerSinceScoring[];
}

export async function getReportNarrativeSource(
  childId: string,
  familyId?: string,
): Promise<ReportNarrativeSource | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      family_id: string;
      child_name: string;
      birth_month: string;
      profile: Record<string, unknown>;
      context: Record<string, unknown>;
      first_name: string | null;
      scores: MapScores;
      generated_at: string;
      bank_version: string;
      scorer_version: string | null;
      scored_birth_date: string | null;
      scored_age_months: number | null;
      saved_projection: unknown;
      projection_bank_version: string | null;
      projection_version: string | null;
      projection_date: string | null;
      projected_at: string | null;
      compatibility_answers: Array<{ itemId: string; answer: MapAnswer }>;
      history: Array<{
        scores: MapScores;
        generated_at: string;
        narrative?: ReportNarrative | null;
      }>;
    }[]
  >`
    select f.id as family_id, c.name as child_name,
           to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           c.profile, c.context, f.first_name,
           r.scores, r.history,
           to_char(r.generated_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as generated_at,
           r.bank_version, r.scorer_version,
           to_char(r.scored_birth_date, 'YYYY-MM-DD') as scored_birth_date,
           r.scored_age_months, live.projection as saved_projection,
           live.bank_version as projection_bank_version, live.projection_version,
           live.projection_date::text as projection_date,
           to_char(live.projected_at at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as projected_at,
           coalesce((select jsonb_agg(jsonb_build_object('itemId', a.question_id, 'answer', a.answer)
                                     order by a.question_id)
                     from public.child_answers a where a.child_id = r.child_id), '[]'::jsonb)
             as compatibility_answers
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    left join public.child_progress_live live
      on live.child_id = r.child_id and live.family_id = f.id
     and live.projected_at = r.generated_at
    where r.child_id = ${childId} and f.status <> 'deleted'
      and (${familyId ?? null}::uuid is null or f.id = ${familyId ?? null})
  `;
  const row = rows[0];
  if (!row) return null;

  const saved = buildSavedReportComparisons({
    childId, scores: row.scores, generatedAt: row.generated_at,
    bankVersion: row.bank_version, scorerVersion: row.scorer_version,
    scoredBirthDate: row.scored_birth_date, scoredAgeMonths: row.scored_age_months,
    projection: row.saved_projection, projectionBankVersion: row.projection_bank_version,
    projectionVersion: row.projection_version, projectionDate: row.projection_date,
    projectedAt: row.projected_at,
  });
  // Legacy rows keep their compatibility data from the same statement.
  // A canonical report uses every answer in its exact saved projection.
  const answers = saved.status === "available" ? saved.answers : row.compatibility_answers;
  const siblings = await sql<{ name: string }[]>`
    select c2.name from public.children c2
    where c2.family_id = ${row.family_id} and c2.id <> ${childId}
  `;

  // What changed between the previous scoring and this one, from the
  // evidence ledger: the active reading per item that landed after the
  // archived scoring (history head), joined to the answer it superseded.
  // First reports (no history) have no "since" and skip the read.
  const previousScoredAt = row.history?.[0]?.generated_at ?? null;
  const changedRows = previousScoredAt
    ? await sql<
        {
          item_id: string;
          answer: MapAnswer;
          previous_answer: MapAnswer | null;
          source: string;
        }[]
      >`
        select e.item_id, e.answer, prev.answer as previous_answer, e.source
        from public.child_progress_evidence e
        left join public.child_progress_evidence prev on prev.id = e.supersedes_id
        where e.child_id = ${childId} and e.family_id = ${row.family_id}
          and (e.superseded_at is null or e.superseded_at > ${row.generated_at}::text::timestamptz)
          and e.created_at > ${previousScoredAt}::text::timestamptz
          and e.created_at <= ${row.generated_at}::text::timestamptz
        order by e.observed_at asc, e.created_at asc
        limit 80
      `
    : [];
  const planRows = await sql<{ subject_id: string; plan: FourWeekPlan; progress: Record<string, boolean> }[]>`
    select subject_id, plan, progress from public.child_plans
    where child_id = ${childId}
  `;

  // The writer's memory: the most recent archived letter that actually
  // shipped words (a failed generation archives null and is skipped).
  const archived = (row.history ?? []).find((entry) => entry.narrative?.note);
  const priorLetter = archived?.narrative
    ? {
        generatedAt: archived.generated_at,
        note: archived.narrative.note,
      }
    : null;

  const practice = planRows
    .map((plan) => ({
      subjectName:
        plan.subject_id === MONTH_PLAN_SUBJECT
          ? "the month plan"
          : (getMapSubject(plan.subject_id)?.displayName ?? plan.subject_id),
      done: Object.values(plan.progress ?? {}).filter(Boolean).length,
      total: plan.plan.weeks.reduce((sum, week) => sum + week.activities.length, 0),
    }))
    .filter((entry) => entry.done > 0);

  const profile = row.profile ?? {};
  const bag = row.context ?? {};
  const profileInterests = profileInterestList(profile.interests);
  const bagInterests = profileInterestList(bag.interests);
  const profileFocus = profileFocusList(profile);
  const bagHelp = profileHelpList(bag.helpWith);
  const whatsWorkingBySubject =
    bag.whatsWorking && typeof bag.whatsWorking === "object"
      ? Object.fromEntries(
          Object.entries(bag.whatsWorking as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    reportGeneratedAt: row.generated_at,
    familyId: row.family_id,
    childId,
    childName: row.child_name,
    birthMonth: row.birth_month,
    interests: uniqueStrings(profileInterests, bagInterests),
    helpWith: uniqueStrings(profileFocus, bagHelp),
    whatsWorkingBySubject,
    parentFirstName: row.first_name,
    scores: row.scores,
    history: row.history ?? [],
    answers,
    siblingNames: siblings.map((sibling) => sibling.name),
    priorLetter,
    practice,
    changedSinceLastScoring: changedRows
      .filter((entry) => entry.answer !== entry.previous_answer)
      .map((entry) => ({
        itemId: entry.item_id,
        answer: entry.answer,
        previousAnswer: entry.previous_answer,
        source: entry.source,
      })),
  };
}

/**
 * Claims one generation run. Wins when no attempt exists yet or when a
 * previous attempt is stuck "writing" past the stale window (a crashed
 * function costs one wait, never a stuck report). Loses when a fresh
 * attempt is already writing or a verdict (ready/failed) exists, so only
 * one generation runs at a time and hard failures are not retried until
 * the next rescore resets the row.
 */
export async function claimReportNarrative(
  familyId: string,
  childId: string,
  claim: ReportNarrativeClaim,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ child_id: string }[]>`
    update public.child_reports
    set narrative_meta = ${sql.json(claim as unknown as DbJson)}
    where child_id = ${childId}
      and generated_at = ${claim.reportGeneratedAt}::text::timestamptz
      and exists (
        select 1 from public.children c
        where c.id = ${childId} and c.family_id = ${familyId}
      )
      and (
        narrative_meta is null
        or (
          narrative_meta->>'status' = 'writing'
          and (narrative_meta->>'startedAt')::timestamptz < now() - interval '10 minutes'
        )
      )
    returning child_id
  `;
  return rows.length > 0;
}

export async function storeReportNarrative(
  familyId: string,
  childId: string,
  narrative: ReportNarrative | null,
  meta: NarrativeMeta,
  claim: ReportNarrativeClaim,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ child_id: string }[]>`
    update public.child_reports
    set narrative = ${narrative ? sql.json(narrative as unknown as DbJson) : null},
        narrative_meta = ${sql.json(meta as unknown as DbJson)},
        updated_at = now()
    where child_id = ${childId}
      and generated_at = ${claim.reportGeneratedAt}::text::timestamptz
      and narrative_meta->>'status' = 'writing'
      and narrative_meta->>'generationId' = ${claim.generationId}
      and narrative_meta->>'reportGeneratedAt' = ${claim.reportGeneratedAt}
      and exists (
        select 1 from public.children c
        where c.id = ${childId} and c.family_id = ${familyId}
      )
    returning child_id
  `;
  return rows.length > 0;
}

/** Status for the report page's writing beat, scoped by the report token
 * exactly like the page itself. */
export async function getReportNarrativeStatusByToken(
  token: string,
): Promise<{ childId: string; familyId: string; meta: NarrativeMeta | null } | null> {
  const sql = mapDb();
  const rows = await sql<
    { child_id: string; family_id: string; narrative_meta: NarrativeMeta | null }[]
  >`
    select r.child_id, f.id as family_id, r.narrative_meta
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;
  return { childId: row.child_id, familyId: row.family_id, meta: row.narrative_meta };
}

export interface PlanNarrativeSource {
  familyId: string;
  childId: string;
  childName: string;
  interests: string[];
  homeschoolStyle: string | null;
  /** Whats-working notes across ALL subjects, keyed by subject name (the
   * fold-it-into-the-plans promise: strength strategies transfer). */
  whatsWorking: Record<string, string>;
  curriculums: string[];
  helpWith: string[];
  plan: FourWeekPlan;
  siblingNames: string[];
}

export async function getPlanNarrativeSource(
  childId: string,
  subjectId: string,
  familyId?: string,
): Promise<PlanNarrativeSource | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      family_id: string;
      child_name: string;
      profile: Record<string, unknown>;
      child_context: Record<string, unknown>;
      family_context: Record<string, unknown>;
      plan: FourWeekPlan;
    }[]
  >`
    select f.id as family_id, c.name as child_name, c.profile,
           c.context as child_context, f.context as family_context, p.plan
    from public.child_plans p
    join public.children c on c.id = p.child_id
    join public.families f on f.id = c.family_id
    where p.child_id = ${childId} and p.subject_id = ${subjectId}
      and f.status <> 'deleted'
      and (${familyId ?? null}::uuid is null or f.id = ${familyId ?? null})
  `;
  const row = rows[0];
  if (!row) return null;

  const siblings = await sql<{ name: string }[]>`
    select c2.name from public.children c2
    where c2.family_id = ${row.family_id} and c2.id <> ${childId}
  `;
  const profile = row.profile ?? {};
  const profileInterests = profileInterestList(profile.interests);
  const bagInterests = profileInterestList(row.child_context?.interests);
  const profileFocus = profileFocusList(profile);
  const bagHelp = profileHelpList(row.child_context?.helpWith);
  const homeschoolStyle = firstFamilyStyle(row.family_context) ?? null;

  const curriculums = Array.isArray(row.family_context?.curriculums)
    ? stringList(row.family_context.curriculums)
    : [];

  const whatsWorking: Record<string, string> = {};
  const bagWorking = row.child_context?.whatsWorking;
  if (bagWorking && typeof bagWorking === "object") {
    for (const [bySubjectId, note] of Object.entries(bagWorking as Record<string, unknown>)) {
      if (typeof note !== "string" || note.trim().length === 0) continue;
      whatsWorking[getMapSubject(bySubjectId)?.displayName ?? bySubjectId] = note.trim();
    }
  }

  return {
    familyId: row.family_id,
    childId,
    childName: row.child_name,
    interests: uniqueStrings(profileInterests, bagInterests),
    homeschoolStyle,
    whatsWorking,
    curriculums,
    helpWith: uniqueStrings(profileFocus, bagHelp),
    plan: row.plan,
    siblingNames: siblings.map((sibling) => sibling.name),
  };
}

export async function claimPlanNarrative(
  familyId: string,
  childId: string,
  subjectId: string,
  meta: NarrativeMeta,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.child_plans
    set narrative_meta = ${sql.json(meta as unknown as DbJson)}
    where child_id = ${childId} and subject_id = ${subjectId}
      and exists (
        select 1 from public.children c
        where c.id = ${childId} and c.family_id = ${familyId}
      )
      and (
        narrative_meta is null
        or (
          narrative_meta->>'status' = 'writing'
          and (narrative_meta->>'startedAt')::timestamptz < now() - interval '10 minutes'
        )
      )
    returning id
  `;
  return rows.length > 0;
}

export async function storePlanNarrative(
  familyId: string,
  childId: string,
  subjectId: string,
  narrative: PlanNarrative | null,
  meta: NarrativeMeta,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.child_plans
    set narrative = ${narrative ? sql.json(narrative as unknown as DbJson) : null},
        narrative_meta = ${sql.json(meta as unknown as DbJson)},
        updated_at = now()
    where child_id = ${childId} and subject_id = ${subjectId}
      and exists (
        select 1 from public.children c
        where c.id = ${childId} and c.family_id = ${familyId}
      )
  `;
}

/** Status for the plan page's beat, scoped by the report token that owns
 * the child, same trust chain as the plan page itself. */
export async function getPlanNarrativeStatusByToken(
  token: string,
  subjectId: string,
): Promise<{ childId: string; familyId: string; meta: NarrativeMeta | null } | null> {
  const sql = mapDb();
  const rows = await sql<
    { child_id: string; family_id: string; narrative_meta: NarrativeMeta | null }[]
  >`
    select c.id as child_id, f.id as family_id, p.narrative_meta
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    left join public.child_plans p on p.child_id = c.id and p.subject_id = ${subjectId}
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;
  return { childId: row.child_id, familyId: row.family_id, meta: row.narrative_meta };
}
