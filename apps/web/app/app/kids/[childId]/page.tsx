import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppData } from "../../../../lib/app-data";
import { getRecentWins } from "../../../../lib/dashboard";
import { getCurriculaForChildren } from "../../../../lib/curriculum";
import { parentFirstName } from "../../../../lib/family";
import { lessonListenEnabled } from "../../../../lib/lessons/flag";
import { listLessonsForChild } from "../../../../lib/lessons/store";
import { PageColumn } from "../../../../components/dashboard/page-column";
import { KidView } from "./kid-view";

/**
 * /app/kids/[childId]: one kid's corner of the dashboard, the UI kit's
 * DashboardView made honest (render lives in kid-view.tsx, the frame in
 * the /app layout). The child is looked up inside the caller's own
 * family (getMyChildren under RLS), so a foreign id is a 404, never a
 * data leak. Same setup gates as /home; auth is enforced by proxy.ts,
 * data access by RLS regardless.
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
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children, reports, plans, pendingCurriculumChildIds, memberDisplayName } =
    data;

  const kidIndex = children.findIndex((entry) => entry.id === childId);
  if (kidIndex === -1) notFound();
  const child = children[kidIndex];

  const [wins, curricula, lessons] = await Promise.all([
    getRecentWins([child.id]),
    getCurriculaForChildren([child.id]),
    lessonListenEnabled()
      ? listLessonsForChild(family.id, child.id, 5)
      : Promise.resolve([]),
  ]);

  return (
    <PageColumn>
      <KidView
        kids={children}
        kidIndex={kidIndex}
        parentFirstName={memberDisplayName ?? parentFirstName(family)}
        report={reports.get(child.id) ?? null}
        reports={reports}
        plans={plans.filter((plan) => plan.childId === child.id)}
        wins={wins}
        curriculum={curricula.get(child.id) ?? null}
        curriculumPending={pendingCurriculumChildIds.has(child.id)}
        lessonListen={
          lessonListenEnabled()
            ? {
                recordHref: `/app/kids/${child.id}/lessons/record`,
                lessons: lessons.map((lesson) => ({
                  id: lesson.id,
                  status: lesson.status,
                  startedAt: lesson.startedAt,
                })),
              }
            : null
        }
      />
    </PageColumn>
  );
}
