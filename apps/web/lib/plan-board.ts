import {
  planActivityCheckKeySchema,
  planActivityProgressSnapshotSchema,
} from "@homa/core";
import { z } from "zod";

import type { DashboardPlan } from "./plan-week";

/**
 * The wire shape of GET /api/map/plan/board, shared by the route and the
 * chat's planner canvas so the two can never drift. Pure types: this
 * module must stay importable from client components.
 */

export interface PlanBoardKid {
  id: string;
  name: string;
  birthMonth: string;
  avatarUrl: string | null;
  /** The child's report token: the check-off storage key + sync
   * identity, and the full-month link. Session-scoped surface, so only
   * the family's own browser ever receives it (same law as /app). */
  reportToken: string | null;
}

export interface PlanBoardPayload {
  timeZone: string;
  kids: PlanBoardKid[];
  plans: DashboardPlan[];
}

const planBoardKidSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(200),
    birthMonth: z.iso.date(),
    avatarUrl: z.string().max(2_000).nullable(),
    reportToken: z.string().min(1).max(200).nullable(),
  })
  .strict();

const planBoardWeekSchema = z
  .object({
    week: z.number().int().min(1).max(4),
    focus: z.string().min(1).max(4_000),
    activities: z.array(z.string().min(1).max(4_000)).max(1_000),
  })
  .strict();

const planBoardWeeksSchema = z
  .array(planBoardWeekSchema)
  .min(1)
  .max(4)
  .superRefine((weeks, context) => {
    const seen = new Set<number>();
    for (const [index, week] of weeks.entries()) {
      if (seen.has(week.week)) {
        context.addIssue({
          code: "custom",
          path: [index, "week"],
          message: "plan week numbers must be unique",
        });
      }
      seen.add(week.week);
    }
  });

const planBoardTimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });

const planBoardSourceSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(180),
    sourceLocator: z.string().max(160).nullable().optional(),
  })
  .strict();

const planBoardPlanSchema = z
  .object({
    childId: z.uuid(),
    subjectId: z.string().min(1).max(40),
    planRevision: z.number().int().safe().positive().nullable(),
    progressRevision: z.number().int().safe().nonnegative().nullable(),
    done: z.number().int().safe().nonnegative(),
    total: z.number().int().safe().nonnegative(),
    retestAt: z.iso.datetime({ offset: true }),
    weeks: planBoardWeeksSchema,
    progress: planActivityProgressSnapshotSchema,
    activitySources: z.record(
      planActivityCheckKeySchema,
      z.array(planBoardSourceSchema).max(5),
    ),
    provisional: z.boolean().optional(),
  })
  .strict()
  .superRefine((plan, context) => {
    const hasPlanRevision = plan.planRevision !== null;
    const hasProgressRevision = plan.progressRevision !== null;
    if (hasPlanRevision !== hasProgressRevision) {
      context.addIssue({
        code: "custom",
        message: "plan revisions must be present or absent together",
      });
    }
    if (plan.provisional === true && hasPlanRevision) {
      context.addIssue({
        code: "custom",
        message: "provisional plans cannot carry persisted revisions",
      });
    }
    if (plan.provisional !== true && !hasPlanRevision) {
      context.addIssue({
        code: "custom",
        message: "persisted plans require revisions",
      });
    }
  });

const planBoardPayloadSchema = z
  .object({
    timeZone: planBoardTimeZoneSchema,
    kids: z.array(planBoardKidSchema).max(100),
    plans: z.array(planBoardPlanSchema).max(1_000),
  })
  .strict();

const planBoardResponseSchema = z
  .object({
    ok: z.literal(true),
    board: planBoardPayloadSchema,
  })
  .strict();

export function parsePlanBoardResponse(value: unknown): PlanBoardPayload | null {
  const parsed = planBoardResponseSchema.safeParse(value);
  return parsed.success ? (parsed.data.board as PlanBoardPayload) : null;
}
