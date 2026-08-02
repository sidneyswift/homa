import type { FourWeekPlan, PlanWeek } from "@homa/core";

import type { DashboardPlan, DashboardReport } from "../dashboard";
import type { ChildRecord, ChildProfile } from "../family";
import type { ArchivedScoring } from "../map/trajectory-eras";
import { findMaterialsPinned } from "../materials/library";
import { toBinderMaterials, type BinderMaterial } from "../materials/binder";
import { adminDb } from "./db";

/**
 * Her screen's loader (deep view direction 3): the same rows the parent
 * app's pages read, fetched founder-side by familyId so the mirror at
 * /admin/families/[familyId]/screen renders the family's real Progress,
 * Planner, Binder, and Tasks through the app's own presentational
 * components. Read-only by construction: this module exposes no write,
 * and the mirror wires no actions.
 */

export interface FamilyScreenData {
  family: { id: string; name: string; parentName: string | null; timeZone: string };
  children: ChildRecord[];
  reports: Map<string, DashboardReport>;
  plans: DashboardPlan[];
  binder: BinderMaterial[];
}

function validPlanWeek(value: unknown): value is PlanWeek {
  if (!value || typeof value !== "object") return false;
  const week = value as Partial<PlanWeek>;
  return (
    typeof week.week === "number" &&
    typeof week.focus === "string" &&
    Array.isArray(week.activities) &&
    week.activities.every((activity) => typeof activity === "string")
  );
}

export async function getFamilyScreenData(
  familyId: string,
): Promise<FamilyScreenData | null> {
  const sql = adminDb();
  const familyRows = await sql<
    { id: string; name: string; parent_display_name: string | null; time_zone: string | null }[]
  >`
    select id, name, parent_display_name, time_zone
    from public.families
    where id = ${familyId} and coalesce(status, 'open') <> 'deleted'
  `;
  const family = familyRows[0];
  if (!family) return null;

  const childRows = await sql<
    {
      id: string;
      name: string;
      birth_month: string;
      profile: string | null;
      avatar_url: string | null;
    }[]
  >`
    select id, name, birth_month::text as birth_month, profile::text as profile, avatar_url
    from public.children where family_id = ${familyId}
    order by created_at
  `;
  const children: ChildRecord[] = childRows.map((row) => {
    let profile: ChildProfile = {};
    try {
      profile = row.profile ? (JSON.parse(row.profile) as ChildProfile) : {};
    } catch {
      profile = {};
    }
    return {
      id: row.id,
      family_id: familyId,
      name: row.name,
      birth_month: row.birth_month,
      profile,
      avatar_url: row.avatar_url,
    };
  });
  // Comma-joined id list split server-side: adminDb runs with
  // fetch_types off, so sql.array() and json parameters both
  // mis-serialize (db.ts posture); uuids never contain commas.
  const childIds = children.map((child) => child.id).join(",");

  const reports = new Map<string, DashboardReport>();
  const plans: DashboardPlan[] = [];
  if (children.length > 0) {
    const reportRows = await sql<
      {
        child_id: string;
        token: string | null;
        scores: string;
        generated_at: string;
        history: string | null;
      }[]
    >`
      select child_id, token, scores::text as scores,
             generated_at::text as generated_at, history::text as history
      from public.child_reports
      where child_id::text in (select unnest(string_to_array(${childIds}, ',')))
    `;
    for (const row of reportRows) {
      try {
        reports.set(row.child_id, {
          childId: row.child_id,
          token: row.token,
          scores: JSON.parse(row.scores),
          generatedAt: row.generated_at,
          history: (row.history ? JSON.parse(row.history) : []) as ArchivedScoring[],
        });
      } catch (error) {
        console.error(
          "screen data: report parse failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    const planRows = await sql<
      {
        child_id: string;
        subject_id: string;
        plan: string;
        progress: string | null;
        retest_at: string;
      }[]
    >`
      select child_id, subject_id, plan::text as plan,
             progress::text as progress, retest_at::text as retest_at
      from public.child_plans
      where child_id::text in (select unnest(string_to_array(${childIds}, ',')))
    `;
    for (const row of planRows) {
      try {
        const plan = JSON.parse(row.plan) as FourWeekPlan;
        const weeks = Array.isArray(plan.weeks) ? plan.weeks.filter(validPlanWeek) : [];
        if (weeks.length === 0) continue;
        const progress = (row.progress ? JSON.parse(row.progress) : {}) as Record<
          string,
          boolean
        >;
        plans.push({
          childId: row.child_id,
          subjectId: row.subject_id,
          done: Object.values(progress).filter(Boolean).length,
          total: weeks.reduce((sum, week) => sum + week.activities.length, 0),
          retestAt: row.retest_at,
          weeks,
          progress,
          activitySources: {},
        });
      } catch (error) {
        console.error(
          "screen data: plan parse failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
  }

  const materials = await findMaterialsPinned(familyId, { status: "final", limit: 300 });
  const binder = toBinderMaterials(materials, children);

  return {
    family: {
      id: family.id,
      name: family.name,
      parentName: family.parent_display_name,
      timeZone: family.time_zone ?? "America/New_York",
    },
    children,
    reports,
    plans,
    binder,
  };
}
