import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  ageInMonths,
  ageLabel,
  MAP_BANK_VERSION,
  MONTH_PLAN_SUBJECT,
  type FourWeekPlan,
} from "@homa/core";
import { z } from "zod";

import { mapDb, type DbJson } from "./map/db";

/**
 * A month-plan preview is session-bound working state. It is carried in a
 * signed token, not a database row, so a family can revise, restore, or walk
 * away without changing the Planner. Only approveMonthPlanDraft writes.
 *
 * The model proposes the educational shape. This module verifies the closed
 * structure, dates, family-owned children and materials, stale bases,
 * idempotency, and the exact write.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_ACTIVITY_LENGTH = 500;
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export const monthPlanActivitySchema = z
  .object({
    text: z.string().trim().min(1).max(MAX_ACTIVITY_LENGTH),
    scheduledDate: z.string().regex(DATE_ONLY).nullable(),
    reusedMaterialId: z.uuid().nullable(),
  })
  .strict();

export const monthPlanWeekSchema = z
  .object({
    week: z.number().int().min(1).max(4),
    focus: z.string().trim().min(1).max(240),
    activities: z.array(monthPlanActivitySchema).min(1).max(8),
  })
  .strict();

export const proposedChildMonthPlanSchema = z
  .object({
    childId: z.uuid(),
    childName: z.string().trim().min(1).max(80),
    targets: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
    weeks: z.array(monthPlanWeekSchema).length(4),
    unresolvedChoices: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const weeks = plan.weeks.map((week) => week.week);
    if (new Set(weeks).size !== 4 || ![1, 2, 3, 4].every((week) => weeks.includes(week))) {
      ctx.addIssue({
        code: "custom",
        message: "weeks must contain each of 1, 2, 3, and 4 exactly once",
        path: ["weeks"],
      });
    }
  });

export const proposedMonthPlanSchema = z
  .object({
    monthStart: z.string().regex(/^\d{4}-\d{2}-01$/u),
    title: z.string().trim().min(1).max(120),
    children: z.array(proposedChildMonthPlanSchema).min(1).max(8),
    unscheduledItems: z.array(z.string().trim().min(1).max(240)).max(16),
  })
  .strict();

export type ProposedChildMonthPlan = z.infer<typeof proposedChildMonthPlanSchema>;
export type ProposedMonthPlan = z.infer<typeof proposedMonthPlanSchema>;

interface PlanBaseVersion {
  childId: string;
  updatedAt: string | null;
}

export interface MonthPlanConflict {
  childId: string;
  childName: string;
  scheduledDate: string;
  activity: string;
  commitment: string;
}

export interface MonthPlanRevisionSnapshot {
  revision: number;
  plan: ProposedMonthPlan;
  conflicts: MonthPlanConflict[];
  action: "created" | "revised" | "restored";
  restoredFrom: number | null;
}

interface MonthPlanDraftPayload {
  v: 1;
  draftId: string;
  familyId: string;
  createdAt: string;
  baseVersions: PlanBaseVersion[];
  history: MonthPlanRevisionSnapshot[];
}

export interface MonthPlanDraftPreview {
  draftId: string;
  revision: number;
  monthStart: string;
  title: string;
  children: ProposedChildMonthPlan[];
  conflicts: MonthPlanConflict[];
  unscheduledItems: string[];
  unresolvedChoices: string[];
  restoredFrom: number | null;
}

interface FamilyChildRow {
  id: string;
  name: string;
  birth_month: string;
}

interface FamilyEventRow {
  child_id: string | null;
  title: string;
  starts_on: string;
  ends_on: string;
}

interface ExistingMonthPlanRow {
  child_id: string;
  updated_at: string;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function draftSecret(explicit?: string): string {
  const secret = explicit ?? process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required for month-plan previews");
  return secret;
}

function draftKey(sessionId: string, secret?: string): Buffer {
  return createHmac("sha256", draftSecret(secret))
    .update(`homa-month-plan-draft-v1:${sessionId}`)
    .digest();
}

export function signMonthPlanDraft(
  payload: MonthPlanDraftPayload,
  sessionId: string,
  secret?: string,
): string {
  const body = Buffer.from(canonicalJson(payload)).toString("base64url");
  const signature = createHmac("sha256", draftKey(sessionId, secret))
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifyMonthPlanDraft(
  token: string,
  sessionId: string,
  familyId: string,
  options: { secret?: string; now?: Date } = {},
): MonthPlanDraftPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", draftKey(sessionId, options.secret))
      .update(body)
      .digest();
  } catch {
    return null;
  }
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    const parsed = monthPlanDraftPayloadSchema.safeParse(payload);
    if (!parsed.success || parsed.data.familyId !== familyId) return null;
    const createdAt = Date.parse(parsed.data.createdAt);
    const now = (options.now ?? new Date()).getTime();
    if (
      !Number.isFinite(createdAt)
      || createdAt > now + MAX_CLOCK_SKEW_MS
      || now - createdAt > MAX_DRAFT_AGE_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

const planBaseVersionSchema = z.object({
  childId: z.uuid(),
  updatedAt: z.string().nullable(),
});

const monthPlanConflictSchema = z.object({
  childId: z.uuid(),
  childName: z.string(),
  scheduledDate: z.string().regex(DATE_ONLY),
  activity: z.string(),
  commitment: z.string(),
});

const monthPlanRevisionSnapshotSchema = z.object({
  revision: z.number().int().min(1).max(100),
  plan: proposedMonthPlanSchema,
  conflicts: z.array(monthPlanConflictSchema),
  action: z.enum(["created", "revised", "restored"]),
  restoredFrom: z.number().int().min(1).max(100).nullable(),
});

const monthPlanDraftPayloadSchema = z.object({
  v: z.literal(1),
  draftId: z.uuid(),
  familyId: z.uuid(),
  createdAt: z.iso.datetime(),
  baseVersions: z.array(planBaseVersionSchema).min(1).max(8),
  history: z.array(monthPlanRevisionSnapshotSchema).min(1).max(100),
});

function monthEnd(monthStart: string): string {
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function retestAt(monthStart: string): string {
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 28);
  return date.toISOString();
}

function dateWithinMonth(date: string, monthStart: string): boolean {
  return date >= monthStart && date <= monthEnd(monthStart);
}

function currentSnapshot(payload: MonthPlanDraftPayload): MonthPlanRevisionSnapshot {
  return payload.history[payload.history.length - 1];
}

export function previewFromDraft(payload: MonthPlanDraftPayload): MonthPlanDraftPreview {
  const current = currentSnapshot(payload);
  return {
    draftId: payload.draftId,
    revision: current.revision,
    monthStart: current.plan.monthStart,
    title: current.plan.title,
    children: current.plan.children,
    conflicts: current.conflicts,
    unscheduledItems: current.plan.unscheduledItems,
    unresolvedChoices: current.plan.children.flatMap((child) =>
      child.unresolvedChoices.map((choice) => `${child.childName}: ${choice}`),
    ),
    restoredFrom: current.restoredFrom,
  };
}

function asStoredPlan(input: ProposedChildMonthPlan, birthMonth: string): FourWeekPlan {
  return {
    subjectId: MONTH_PLAN_SUBJECT,
    subjectName: "the whole month",
    childAgeLabel: ageLabel(ageInMonths(birthMonth)),
    startingLine: null,
    targets: input.targets,
    weeks: input.weeks.map((week) => ({
      week: week.week,
      focus: week.focus,
      activities: week.activities.map((activity) => activity.text),
    })),
    styleNote: null,
    bankVersion: MAP_BANK_VERSION,
  };
}

async function loadVerifiedPlanInputs(
  familyId: string,
  plan: ProposedMonthPlan,
): Promise<{
  children: FamilyChildRow[];
  baseVersions: PlanBaseVersion[];
  conflicts: MonthPlanConflict[];
}> {
  const sql = mapDb();
  const children = await sql<FamilyChildRow[]>`
    select id, name, birth_month::text as birth_month from public.children
    where family_id = ${familyId}
    order by created_at
  `;
  const expectedChildren = new Map(children.map((child) => [child.id, child.name]));
  const proposedIds = plan.children.map((child) => child.childId);
  if (
    proposedIds.length !== expectedChildren.size
    || new Set(proposedIds).size !== proposedIds.length
    || proposedIds.some((childId) => !expectedChildren.has(childId))
  ) {
    throw new Error("The draft must include each child in this family exactly once.");
  }
  for (const child of plan.children) {
    if (expectedChildren.get(child.childId) !== child.childName) {
      throw new Error("A child name in the draft no longer matches this family.");
    }
    for (const week of child.weeks) {
      for (const activity of week.activities) {
        if (activity.scheduledDate && !dateWithinMonth(activity.scheduledDate, plan.monthStart)) {
          throw new Error("Every scheduled activity must fall inside the previewed month.");
        }
      }
    }
  }

  const materialIds = [
    ...new Set(
      plan.children.flatMap((child) =>
        child.weeks.flatMap((week) =>
          week.activities.flatMap((activity) =>
            activity.reusedMaterialId ? [activity.reusedMaterialId] : [],
          ),
        ),
      ),
    ),
  ];
  if (materialIds.length > 0) {
    const materials = await sql<{ id: string }[]>`
      select id from public.materials
      where family_id = ${familyId}
        and status = 'final'
        and id in ${sql(materialIds)}
    `;
    if (materials.length !== materialIds.length) {
      throw new Error("A reused material is not available in this family.");
    }
  }

  const existing = await sql<ExistingMonthPlanRow[]>`
    select p.child_id, p.updated_at::text as updated_at
    from public.child_plans p
    join public.children c on c.id = p.child_id
    where c.family_id = ${familyId} and p.subject_id = ${MONTH_PLAN_SUBJECT}
  `;
  const versions = new Map(existing.map((row) => [row.child_id, row.updated_at]));
  const baseVersions = children.map((child) => ({
    childId: child.id,
    updatedAt: versions.get(child.id) ?? null,
  }));

  const events = await sql<FamilyEventRow[]>`
    select child_id, title, starts_on::text as starts_on, ends_on::text as ends_on
    from public.family_events
    where family_id = ${familyId}
      and starts_on <= ${monthEnd(plan.monthStart)}::date
      and ends_on >= ${plan.monthStart}::date
    order by starts_on, created_at
  `;
  const conflicts: MonthPlanConflict[] = [];
  for (const child of plan.children) {
    for (const week of child.weeks) {
      for (const activity of week.activities) {
        if (!activity.scheduledDate) continue;
        for (const event of events) {
          if (event.child_id !== null && event.child_id !== child.childId) continue;
          if (
            activity.scheduledDate >= event.starts_on
            && activity.scheduledDate <= event.ends_on
          ) {
            conflicts.push({
              childId: child.childId,
              childName: child.childName,
              scheduledDate: activity.scheduledDate,
              activity: activity.text,
              commitment: event.title,
            });
          }
        }
      }
    }
  }
  return { children, baseVersions, conflicts };
}

export async function createMonthPlanDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  plan: ProposedMonthPlan;
}): Promise<{ draftToken: string; preview: MonthPlanDraftPreview }> {
  const plan = proposedMonthPlanSchema.parse(input.plan);
  const verified = await loadVerifiedPlanInputs(input.familyId, plan);
  const payload: MonthPlanDraftPayload = {
    v: 1,
    draftId: randomUUID(),
    familyId: input.familyId,
    createdAt: new Date().toISOString(),
    baseVersions: verified.baseVersions,
    history: [{
      revision: 1,
      plan,
      conflicts: verified.conflicts,
      action: "created",
      restoredFrom: null,
    }],
  };
  return {
    draftToken: signMonthPlanDraft(payload, input.sessionId, input.secret),
    preview: previewFromDraft(payload),
  };
}

export async function reviseMonthPlanDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  draftToken: string;
  plan: ProposedMonthPlan;
}): Promise<{ draftToken: string; preview: MonthPlanDraftPreview } | null> {
  const previous = verifyMonthPlanDraft(input.draftToken, input.sessionId, input.familyId, {
    secret: input.secret,
  });
  if (!previous) return null;
  const plan = proposedMonthPlanSchema.parse(input.plan);
  const verified = await loadVerifiedPlanInputs(input.familyId, plan);
  if (canonicalJson(verified.baseVersions) !== canonicalJson(previous.baseVersions)) {
    throw new Error("The saved month changed while this preview was open. Start a fresh preview.");
  }
  const revision = previous.history.length + 1;
  const payload: MonthPlanDraftPayload = {
    ...previous,
    history: [...previous.history, {
      revision,
      plan,
      conflicts: verified.conflicts,
      action: "revised",
      restoredFrom: null,
    }],
  };
  return {
    draftToken: signMonthPlanDraft(payload, input.sessionId, input.secret),
    preview: previewFromDraft(payload),
  };
}

export function restoreMonthPlanDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  draftToken: string;
  restoreRevision: number;
}): { draftToken: string; preview: MonthPlanDraftPreview } | null {
  const previous = verifyMonthPlanDraft(input.draftToken, input.sessionId, input.familyId, {
    secret: input.secret,
  });
  const target = previous?.history.find((entry) => entry.revision === input.restoreRevision);
  if (!previous || !target) return null;
  const payload: MonthPlanDraftPayload = {
    ...previous,
    history: [...previous.history, {
      ...target,
      revision: previous.history.length + 1,
      action: "restored",
      restoredFrom: target.revision,
    }],
  };
  return {
    draftToken: signMonthPlanDraft(payload, input.sessionId, input.secret),
    preview: previewFromDraft(payload),
  };
}

export async function approveMonthPlanDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  draftToken: string;
  db?: ReturnType<typeof mapDb>;
}): Promise<
  | { status: "approved" | "already_approved"; draftId: string; childCount: number; revision: number }
  | { status: "invalid" }
  | { status: "stale" }
  | { status: "unresolved" }
> {
  const payload = verifyMonthPlanDraft(input.draftToken, input.sessionId, input.familyId, {
    secret: input.secret,
  });
  if (!payload) return { status: "invalid" };
  const snapshot = currentSnapshot(payload);
  if (snapshot.plan.children.some((child) => child.unresolvedChoices.length > 0)) {
    return { status: "unresolved" };
  }
  const sql = input.db ?? mapDb();
  return await sql.begin(async (tx) => {
    await tx`
      select pg_advisory_xact_lock(
        hashtextextended(${`month-plan-approval:${input.familyId}`}, 0)
      )
    `;
    const prior = await tx<{ draft_id: string }[]>`
      select draft_id from public.month_plan_approvals
      where draft_id = ${payload.draftId} and family_id = ${input.familyId}
      limit 1
    `;
    if (prior.length > 0) {
      return {
        status: "already_approved" as const,
        draftId: payload.draftId,
        childCount: snapshot.plan.children.length,
        revision: snapshot.revision,
      };
    }

    const familyChildren = await tx<{ id: string; birth_month: string }[]>`
      select id, birth_month::text as birth_month
      from public.children
      where family_id = ${input.familyId}
      order by id
      for update
    `;
    const childSet = new Set(familyChildren.map((child) => child.id));
    const birthMonths = new Map(
      familyChildren.map((child) => [child.id, child.birth_month]),
    );
    if (
      childSet.size !== snapshot.plan.children.length
      || snapshot.plan.children.some((child) => !childSet.has(child.childId))
    ) {
      return { status: "stale" as const };
    }

    const currentRows = await tx<ExistingMonthPlanRow[]>`
      select p.child_id, p.updated_at::text as updated_at
      from public.child_plans p
      join public.children c on c.id = p.child_id
      where c.family_id = ${input.familyId} and p.subject_id = ${MONTH_PLAN_SUBJECT}
      for update
    `;
    const current = new Map(currentRows.map((row) => [row.child_id, row.updated_at]));
    const stale = payload.baseVersions.some(
      (base) => (current.get(base.childId) ?? null) !== base.updatedAt,
    );
    if (stale) return { status: "stale" as const };

    for (const child of snapshot.plan.children) {
      const birthMonth = birthMonths.get(child.childId);
      if (!birthMonth) return { status: "stale" as const };
      const stored = asStoredPlan(child, birthMonth);
      await tx`
        insert into public.child_plans
          (child_id, subject_id, plan, bank_version, progress, retest_at,
           retest_emailed_at, narrative, narrative_meta)
        values
          (${child.childId}, ${MONTH_PLAN_SUBJECT},
           ${tx.json(stored as unknown as DbJson)}, ${MAP_BANK_VERSION}, '{}'::jsonb,
           ${retestAt(snapshot.plan.monthStart)}::timestamptz, null, null, null)
        on conflict (child_id, subject_id) do update
          set plan = excluded.plan,
              bank_version = excluded.bank_version,
              progress = '{}'::jsonb,
              retest_at = excluded.retest_at,
              retest_emailed_at = null,
              narrative = null,
              narrative_meta = null,
              updated_at = now()
      `;
      await tx`
        delete from public.plan_activity_schedule
        where family_id = ${input.familyId}
          and child_id = ${child.childId}
          and subject_id = ${MONTH_PLAN_SUBJECT}
      `;
      for (const week of child.weeks) {
        for (const [activityIndex, activity] of week.activities.entries()) {
          if (!activity.scheduledDate) continue;
          await tx`
            insert into public.plan_activity_schedule
              (family_id, child_id, subject_id, week, activity_index, scheduled_date)
            values
              (${input.familyId}, ${child.childId}, ${MONTH_PLAN_SUBJECT},
               ${week.week}, ${activityIndex}, ${activity.scheduledDate}::date)
          `;
        }
      }
    }

    await tx`
      insert into public.month_plan_approvals
        (draft_id, family_id, month_start, final_revision, revision_history)
      values
        (${payload.draftId}, ${input.familyId}, ${snapshot.plan.monthStart}::date,
         ${snapshot.revision}, ${tx.json(payload.history as unknown as DbJson)})
    `;

    return {
      status: "approved" as const,
      draftId: payload.draftId,
      childCount: snapshot.plan.children.length,
      revision: snapshot.revision,
    };
  });
}
