import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ageInMonths } from "@homa/core";

import {
  buildUpNextItems,
  getPlansForChildren,
  getRecentWins,
  getReportsForChildren,
} from "../../../lib/dashboard";
import { getCurriculaForChildren, getPendingCurriculumChildIds } from "../../../lib/curriculum";
import { getMyChildren, getMyFamily } from "../../../lib/family";
import { DashboardShell } from "../../../components/dashboard/shell";
import { KidView } from "./kid-view";

/**
 * /kids/[childId]: one kid's corner of the dashboard, the UI kit's
 * DashboardView made honest (render lives in kid-view.tsx). The child is
 * looked up inside the caller's own family (getMyChildren under RLS), so
 * a foreign id is a 404, never a data leak. Same setup gates as /home;
 * auth is enforced by proxy.ts, data access by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Kid",
  robots: { index: false },
};

export default async function KidPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const family = await getMyFamily();
  if (!family || !family.profile_completed_at) redirect("/onboarding");
  const children = await getMyChildren(family.id);
  if (children.length === 0) redirect("/onboarding");

  const kidIndex = children.findIndex((entry) => entry.id === childId);
  if (kidIndex === -1) notFound();
  const child = children[kidIndex];

  const childIds = children.map((entry) => entry.id);
  const [reports, allPlans, wins, curricula, pendingCurriculumChildIds] = await Promise.all([
    getReportsForChildren(childIds),
    getPlansForChildren(childIds),
    getRecentWins([child.id]),
    getCurriculaForChildren([child.id]),
    getPendingCurriculumChildIds([child.id]),
  ]);

  const parentFirstName =
    (family.parent_display_name ?? family.name).trim().split(/\s+/)[0] || family.name;

  return (
    <DashboardShell
      parentName={parentFirstName}
      familyName={family.name}
      avatarUrl={family.parent_avatar_url}
      kids={children.map((entry) => ({
        id: entry.id,
        name: entry.name,
        ageMonths: ageInMonths(entry.birth_month),
      }))}
      upNext={buildUpNextItems({
        children,
        reports,
        plans: allPlans,
        pendingCurriculumChildIds,
      })}
      active={null}
    >
      <KidView
        kids={children}
        kidIndex={kidIndex}
        parentFirstName={parentFirstName}
        report={reports.get(child.id) ?? null}
        reports={reports}
        plans={allPlans.filter((plan) => plan.childId === child.id)}
        wins={wins}
        curriculum={curricula.get(child.id) ?? null}
        curriculumPending={pendingCurriculumChildIds.has(child.id)}
      />
    </DashboardShell>
  );
}
