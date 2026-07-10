import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { PageColumn } from "../../../components/dashboard/page-column";
import { PlannerView } from "./planner-view";

/**
 * /planner: the family's week, from the plans that actually exist. Same
 * setup gates as /home (one onboarding for every door); the board itself
 * renders in planner-view.tsx, the frame in the (app) layout. Auth is
 * enforced by proxy.ts; data access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Week planner",
  robots: { index: false },
};

export default async function PlannerPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children, reports, plans } = data;

  return (
    <PageColumn>
      <PlannerView
        kids={children}
        reports={reports}
        plans={plans}
        timeZone={effectiveTimeZone(family.time_zone)}
        now={new Date()}
      />
    </PageColumn>
  );
}
