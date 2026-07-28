import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { emitMapEvent } from "../../../lib/map/events";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { PageColumn } from "../../../components/dashboard/page-column";
import { PlannerView } from "./planner-view";

/**
 * /app/planner: the family's week, from the plans that actually exist.
 * The context switcher narrows the board to one kid's column when a kid
 * is selected; the whole family stays the default. Same setup gates as
 * the dashboard (one onboarding for every door); the board renders in
 * planner-view.tsx, the frame in the /app layout. Auth is enforced by
 * proxy.ts; data access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Week planner",
  robots: { index: false },
};

export default async function PlannerPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children, reports, plans } = data;

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    children.map((child) => child.id),
  );

  // One planner arc instrumentation (issue #257 PR B0): both old week
  // surfaces count views, so the B1 flip has a baseline. Server-side
  // and best-effort, the same posture as map.plan_built's page emit.
  await emitMapEvent("planner.viewed", {
    family_id: family.id,
    surface: "planner_page",
    client: "web",
  });

  return (
    <PageColumn>
      <PlannerView
        kids={children}
        reports={reports}
        plans={plans}
        timeZone={effectiveTimeZone(family.time_zone)}
        now={new Date()}
        focusChildId={viewContext.kind === "child" ? viewContext.childId : null}
      />
    </PageColumn>
  );
}
