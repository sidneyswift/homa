import type {
  FourWeekPlan,
  MapAnswer,
  MapScores,
  NarrativeMeta,
  PlanNarrative,
  ReportNarrative,
} from "@homa/core";
import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

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

export interface ReportNarrativeSource {
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
           r.scores, r.history
    from public.child_reports r
    join public.children c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.child_id = ${childId} and f.status <> 'deleted'
      and (${familyId ?? null}::uuid is null or f.id = ${familyId ?? null})
  `;
  const row = rows[0];
  if (!row) return null;

  const answers = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.child_answers where child_id = ${childId}
  `;
  const siblings = await sql<{ name: string }[]>`
    select c2.name from public.children c2
    where c2.family_id = ${row.family_id} and c2.id <> ${childId}
  `;
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
    answers: answers.map((entry) => ({ itemId: entry.question_id, answer: entry.answer })),
    siblingNames: siblings.map((sibling) => sibling.name),
    priorLetter,
    practice,
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
  meta: NarrativeMeta,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ child_id: string }[]>`
    update public.child_reports
    set narrative_meta = ${sql.json(meta as unknown as DbJson)}
    where child_id = ${childId}
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
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.child_reports
    set narrative = ${narrative ? sql.json(narrative as unknown as DbJson) : null},
        narrative_meta = ${sql.json(meta as unknown as DbJson)},
        updated_at = now()
    where child_id = ${childId}
      and exists (
        select 1 from public.children c
        where c.id = ${childId} and c.family_id = ${familyId}
      )
  `;
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
