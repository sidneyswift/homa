import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ageInMonths } from "@homa/core";

import {
  buildUpNextItems,
  getPlansForChildren,
  getReportsForChildren,
} from "../../lib/dashboard";
import { getPendingCurriculumChildIds } from "../../lib/curriculum";
import { getMyChildren, getMyFamily } from "../../lib/family";
import { effectiveTimeZone } from "../../lib/time-zone";
import { DashboardShell } from "../../components/dashboard/shell";
import { PlannerView } from "./planner-view";

/**
 * /planner: the family's week, from the plans that actually exist. Same
 * setup gates as /home (one onboarding for every door); the board itself
 * renders in planner-view.tsx. Auth is enforced by proxy.ts; data access
 * is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Week planner",
  robots: { index: false },
};

export default async function PlannerPage() {
  const family = await getMyFamily();
  if (!family || !family.profile_completed_at) redirect("/onboarding");
  const children = await getMyChildren(family.id);
  if (children.length === 0) redirect("/onboarding");

  const childIds = children.map((child) => child.id);
  const [reports, plans, pendingCurriculumChildIds] = await Promise.all([
    getReportsForChildren(childIds),
    getPlansForChildren(childIds),
    getPendingCurriculumChildIds(childIds),
  ]);

  const parentFirstName =
    (family.parent_display_name ?? family.name).trim().split(/\s+/)[0] || family.name;

  return (
    <DashboardShell
      parentName={parentFirstName}
      familyName={family.name}
      avatarUrl={family.parent_avatar_url}
      kids={children.map((child) => ({
        id: child.id,
        name: child.name,
        ageMonths: ageInMonths(child.birth_month),
      }))}
      upNext={buildUpNextItems({ children, reports, plans, pendingCurriculumChildIds })}
      active="planner"
    >
      <PlannerView
        kids={children}
        reports={reports}
        plans={plans}
        timeZone={effectiveTimeZone(family.time_zone)}
        now={new Date()}
      />
    </DashboardShell>
  );
}
