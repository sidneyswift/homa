import { cache } from "react";

import { familyAccountCheckout } from "./billing/wall";
import {
  getPlansForChildren,
  getReportsForChildren,
  type DashboardPlan,
  type DashboardReport,
} from "./dashboard";
import { getPendingCurriculumChildIds } from "./curriculum";
import { withAgeTemplates } from "./plan-week";
import {
  getMyChildren,
  getMyFamily,
  getMyMemberProfile,
  type ChildRecord,
  type FamilyRecord,
} from "./family";

/**
 * The signed-in app frame's shared reads: family, children, reports,
 * plans, and pending curricula. The /app layout and every page inside it
 * call getAppData(); React's cache() memoizes it per server request, so
 * the layout and the page rendering in the same pass share one set of
 * queries instead of each re-running them. All reads run under the
 * caller's RLS context, so every row is family-scoped by the database.
 */

export interface AppData {
  family: FamilyRecord;
  children: ChildRecord[];
  reports: Map<string, DashboardReport>;
  plans: DashboardPlan[];
  pendingCurriculumChildIds: Set<string>;
  /** The signed-in adult's own name (multi-parent v0): greetings prefer
   * it over the family-level parent_display_name. Null when unset. */
  memberDisplayName: string | null;
  /** The signed-in adult's own photo (migration #74): the account row
   * prefers it over the family-level parent_avatar_url. */
  memberAvatarUrl: string | null;
}

/**
 * getAppData(): AppData | null
 * Null means this session doesn't belong in /app yet: setup is
 * unfinished (no family, family card not done, or no kids yet), or the
 * signup paywall holds the account (founder directive 2026-07-26).
 * Callers redirect to /onboarding, the one setup flow, whose own router
 * forwards walled accounts to /onboarding/trial. Because the layout AND
 * every page under /app call this one cached function, the account gate
 * covers every /app surface with a single decision instead of a
 * per-route check that can drift (the Progress-bypass scar, dc4ab64b).
 */
export const getAppData = cache(async (): Promise<AppData | null> => {
  const family = await getMyFamily();
  if (!family || !family.profile_completed_at) return null;
  if ((await familyAccountCheckout(family.id)) !== null) return null;
  const children = await getMyChildren(family.id);
  if (children.length === 0) return null;

  const childIds = children.map((child) => child.id);
  const [reports, plans, pendingCurriculumChildIds, memberProfile] = await Promise.all([
    getReportsForChildren(childIds),
    getPlansForChildren(childIds),
    getPendingCurriculumChildIds(childIds),
    getMyMemberProfile(),
  ]);

  return {
    family,
    children,
    reports,
    // A child with a birthday and no stored month still gets a week to
    // look at, marked provisional (founder ruling
    // onboarding-lesson-per-subject). Applied here rather than inside
    // getPlansForChildren because this is where the children rows, with
    // their ages and interests, are already in hand.
    plans: withAgeTemplates(children, plans),
    pendingCurriculumChildIds,
    memberDisplayName: memberProfile?.display_name ?? null,
    memberAvatarUrl: memberProfile?.avatar_url ?? null,
  };
});
