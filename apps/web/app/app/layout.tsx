import { redirect } from "next/navigation";

import { ageInMonths } from "@homa/core";

import { getAppData } from "../../lib/app-data";
import { buildUpNextItems } from "../../lib/dashboard";
import { parentFirstName } from "../../lib/family";
import { DashboardShell } from "../../components/dashboard/shell";
import { TimeZoneSync } from "../../components/dashboard/time-zone-sync";

/**
 * The signed-in app frame, wrapped around every page under /app (chat,
 * the dashboard, planner, kids, settings) by this segment's layout.
 * The shell (sidebar + phone top bar) renders
 * here ONCE and stays mounted while pages navigate inside it, so the
 * frame never re-mounts or jumps. Unfinished setup redirects to
 * /onboarding, the one setup flow (founder call 2026-07-08); pages keep
 * their own copy of that gate because Next renders layout and page in
 * parallel, so neither may assume the other ran first. Auth itself is
 * enforced by proxy.ts; data access by RLS regardless.
 */

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children: kids, reports, plans, pendingCurriculumChildIds } = data;

  return (
    <DashboardShell
      parentName={parentFirstName(family)}
      familyName={family.name}
      avatarUrl={family.parent_avatar_url}
      kids={kids.map((kid) => ({
        id: kid.id,
        name: kid.name,
        ageMonths: ageInMonths(kid.birth_month),
      }))}
      upNext={buildUpNextItems({ children: kids, reports, plans, pendingCurriculumChildIds })}
    >
      {/* Captures the device time zone once, while the family row has
          none, from ANY first app visit (it used to live on the
          dashboard, which retired 2026-07-10; the planner's dates and
          the evening check-in's timing both read this). */}
      {family.time_zone ? null : <TimeZoneSync />}
      {children}
    </DashboardShell>
  );
}
