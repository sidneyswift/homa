import type {
  FourWeekPlan,
  MapAnswer,
  MapScores,
  NarrativeMeta,
  PlanNarrative,
  ReportNarrative,
} from "@homa/core";
import { getMapDomain } from "@homa/core";

import { mapDb, type DbJson } from "./db";

/**
 * Narrative columns on the lead tables (migration: narrative + meta jsonb
 * on lead_reports and lead_plans), server-only via mapDb like everything
 * lead-scoped. Split from store.ts to keep modules small; the tenancy
 * posture is identical (childId always arrives pre-scoped by the caller's
 * cookie-resolved lead or by report token).
 */

export interface ReportNarrativeSource {
  leadId: string;
  childId: string;
  childName: string;
  birthMonth: string;
  interests: string[];
  helpWith: string[];
  whatsWorkingByDomain: Record<string, string>;
  parentFirstName: string | null;
  scores: MapScores;
  history: Array<{ scores: MapScores; generated_at: string }>;
  answers: Array<{ itemId: string; answer: MapAnswer }>;
  siblingNames: string[];
  /** The archived previous letter (history head), the writer's memory. */
  priorLetter: { generatedAt: string; note: string; synthesis: string } | null;
  /** Synced plan check-offs, one row per subject with any progress. */
  practice: Array<{ subjectName: string; done: number; total: number }>;
}

export async function getReportNarrativeSource(
  childId: string,
): Promise<ReportNarrativeSource | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      lead_id: string;
      child_name: string;
      birth_month: string;
      interests: string[];
      help_with: string | null;
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
    select f.id as lead_id, c.name as child_name,
           to_char(c.birth_month, 'YYYY-MM-DD') as birth_month,
           c.interests, c.help_with, c.context, f.first_name,
           r.scores, r.history
    from public.lead_reports r
    join public.lead_children c on c.id = r.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    where r.lead_child_id = ${childId} and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;

  const answers = await sql<{ question_id: string; answer: MapAnswer }[]>`
    select question_id, answer from public.lead_answers where lead_child_id = ${childId}
  `;
  const siblings = await sql<{ name: string }[]>`
    select name from public.lead_children
    where lead_family_id = ${row.lead_id} and id <> ${childId}
  `;
  const planRows = await sql<{ domain_id: string; plan: FourWeekPlan; progress: Record<string, boolean> }[]>`
    select domain_id, plan, progress from public.lead_plans
    where lead_child_id = ${childId}
  `;

  // The writer's memory: the most recent archived letter that actually
  // shipped words (a failed generation archives null and is skipped).
  const archived = (row.history ?? []).find((entry) => entry.narrative?.note);
  const priorLetter = archived?.narrative
    ? {
        generatedAt: archived.generated_at,
        note: archived.narrative.note,
        synthesis: archived.narrative.synthesis,
      }
    : null;

  const practice = planRows
    .map((plan) => ({
      subjectName: getMapDomain(plan.domain_id)?.displayName ?? plan.domain_id,
      done: Object.values(plan.progress ?? {}).filter(Boolean).length,
      total: plan.plan.weeks.reduce((sum, week) => sum + week.activities.length, 0),
    }))
    .filter((entry) => entry.done > 0);

  const bag = row.context ?? {};
  const bagInterests = Array.isArray(bag.interests)
    ? bag.interests.filter((item): item is string => typeof item === "string")
    : [];
  const bagHelp = Array.isArray(bag.helpWith)
    ? bag.helpWith.filter((item): item is string => typeof item === "string")
    : [];
  const whatsWorkingByDomain =
    bag.whatsWorking && typeof bag.whatsWorking === "object"
      ? Object.fromEntries(
          Object.entries(bag.whatsWorking as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    leadId: row.lead_id,
    childId,
    childName: row.child_name,
    birthMonth: row.birth_month,
    interests: [...new Set([...row.interests, ...bagInterests])],
    helpWith: [...(row.help_with ? [row.help_with] : []), ...bagHelp],
    whatsWorkingByDomain,
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
  childId: string,
  meta: NarrativeMeta,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.lead_reports
    set narrative_meta = ${sql.json(meta as unknown as DbJson)}
    where lead_child_id = ${childId}
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

export async function storeReportNarrative(
  childId: string,
  narrative: ReportNarrative | null,
  meta: NarrativeMeta,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lead_reports
    set narrative = ${narrative ? sql.json(narrative as unknown as DbJson) : null},
        narrative_meta = ${sql.json(meta as unknown as DbJson)}
    where lead_child_id = ${childId}
  `;
}

/** Status for the report page's writing beat, scoped by the report token
 * exactly like the page itself. */
export async function getReportNarrativeStatusByToken(
  token: string,
): Promise<{ childId: string; meta: NarrativeMeta | null } | null> {
  const sql = mapDb();
  const rows = await sql<{ child_id: string; narrative_meta: NarrativeMeta | null }[]>`
    select r.lead_child_id as child_id, r.narrative_meta
    from public.lead_reports r
    join public.lead_children c on c.id = r.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;
  return { childId: row.child_id, meta: row.narrative_meta };
}

export interface PlanNarrativeSource {
  leadId: string;
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
  domainId: string,
): Promise<PlanNarrativeSource | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      lead_id: string;
      child_name: string;
      interests: string[];
      help_with: string | null;
      child_context: Record<string, unknown>;
      family_context: Record<string, unknown>;
      plan: FourWeekPlan;
    }[]
  >`
    select f.id as lead_id, c.name as child_name, c.interests, c.help_with,
           c.context as child_context, f.context as family_context, p.plan
    from public.lead_plans p
    join public.lead_children c on c.id = p.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    where p.lead_child_id = ${childId} and p.domain_id = ${domainId}
      and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;

  const siblings = await sql<{ name: string }[]>`
    select name from public.lead_children
    where lead_family_id = ${row.lead_id} and id <> ${childId}
  `;
  const bagInterests = Array.isArray(row.child_context?.interests)
    ? row.child_context.interests.filter((item): item is string => typeof item === "string")
    : [];
  const bagHelp = Array.isArray(row.child_context?.helpWith)
    ? row.child_context.helpWith.filter((item): item is string => typeof item === "string")
    : [];

  // Styles went multi-select on 2026-07-06 (`styles`, first is primary);
  // older bags hold a single `style` string. Same fallback as store.ts.
  const familyStyles = Array.isArray(row.family_context?.styles)
    ? row.family_context.styles.filter((item): item is string => typeof item === "string")
    : [];
  const homeschoolStyle =
    familyStyles[0] ??
    (typeof row.family_context?.style === "string" ? row.family_context.style : null);

  const curriculums = Array.isArray(row.family_context?.curriculums)
    ? row.family_context.curriculums.filter((item): item is string => typeof item === "string")
    : [];

  const whatsWorking: Record<string, string> = {};
  const bagWorking = row.child_context?.whatsWorking;
  if (bagWorking && typeof bagWorking === "object") {
    for (const [byDomainId, note] of Object.entries(bagWorking as Record<string, unknown>)) {
      if (typeof note !== "string" || note.trim().length === 0) continue;
      whatsWorking[getMapDomain(byDomainId)?.displayName ?? byDomainId] = note.trim();
    }
  }

  return {
    leadId: row.lead_id,
    childId,
    childName: row.child_name,
    interests: [...new Set([...row.interests, ...bagInterests])],
    homeschoolStyle,
    whatsWorking,
    curriculums,
    helpWith: [...(row.help_with ? [row.help_with] : []), ...bagHelp],
    plan: row.plan,
    siblingNames: siblings.map((sibling) => sibling.name),
  };
}

export async function claimPlanNarrative(
  childId: string,
  domainId: string,
  meta: NarrativeMeta,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.lead_plans
    set narrative_meta = ${sql.json(meta as unknown as DbJson)}
    where lead_child_id = ${childId} and domain_id = ${domainId}
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
  childId: string,
  domainId: string,
  narrative: PlanNarrative | null,
  meta: NarrativeMeta,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lead_plans
    set narrative = ${narrative ? sql.json(narrative as unknown as DbJson) : null},
        narrative_meta = ${sql.json(meta as unknown as DbJson)}
    where lead_child_id = ${childId} and domain_id = ${domainId}
  `;
}

/** Status for the plan page's beat, scoped by the report token that owns
 * the child, same trust chain as the plan page itself. */
export async function getPlanNarrativeStatusByToken(
  token: string,
  domainId: string,
): Promise<{ childId: string; meta: NarrativeMeta | null } | null> {
  const sql = mapDb();
  const rows = await sql<{ child_id: string; narrative_meta: NarrativeMeta | null }[]>`
    select c.id as child_id, p.narrative_meta
    from public.lead_reports r
    join public.lead_children c on c.id = r.lead_child_id
    join public.lead_families f on f.id = c.lead_family_id
    left join public.lead_plans p on p.lead_child_id = c.id and p.domain_id = ${domainId}
    where r.token = ${token} and r.revoked_at is null and f.status <> 'deleted'
  `;
  const row = rows[0];
  if (!row) return null;
  return { childId: row.child_id, meta: row.narrative_meta };
}
