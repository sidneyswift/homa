import { cache } from "react";

import {
  getPlansForChildren,
  getReportsForChildren,
  type DashboardPlan,
  type DashboardReport,
} from "./dashboard";
import { getPendingCurriculumChildIds } from "./curriculum";
import { getMyChildren, getMyFamily, type ChildRecord, type FamilyRecord } from "./family";

/**
 * The signed-in app frame's shared reads: family, children, and the rows
 * the sidebar's "up next" rail is derived from. The (app) layout and every
 * page inside it call getAppData(); React's cache() memoizes it per server
 * request, so the layout and the page rendering in the same pass share one
 * set of queries instead of each re-running them. All reads run under the
 * caller's RLS context, so every row is family-scoped by the database.
 */

export interface AppData {
  family: FamilyRecord;
  children: ChildRecord[];
  reports: Map<string, DashboardReport>;
  plans: DashboardPlan[];
  pendingCurriculumChildIds: Set<string>;
}

/**
 * getAppData(): AppData | null
 * Null means setup is unfinished (no family, family card not done, or no
 * kids yet); callers redirect to /onboarding, the one setup flow.
 */
export const getAppData = cache(async (): Promise<AppData | null> => {
  const family = await getMyFamily();
  if (!family || !family.profile_completed_at) return null;
  const children = await getMyChildren(family.id);
  if (children.length === 0) return null;

  const childIds = children.map((child) => child.id);
  const [reports, plans, pendingCurriculumChildIds] = await Promise.all([
    getReportsForChildren(childIds),
    getPlansForChildren(childIds),
    getPendingCurriculumChildIds(childIds),
  ]);

  return { family, children, reports, plans, pendingCurriculumChildIds };
});
