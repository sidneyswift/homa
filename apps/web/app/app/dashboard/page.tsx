import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ageInMonths, isInScoredRange } from "@homa/core";

import { getAppData } from "../../../lib/app-data";
import { getRecentWins } from "../../../lib/dashboard";
import { getCurriculaForChildren } from "../../../lib/curriculum";
import { getMyMemories } from "../../../lib/memories";
import { getWeekHours } from "../../../lib/hours";
import { parentFirstName } from "../../../lib/family";
import { FamilyNote } from "../../../components/dashboard/family-note";
import { Greeting } from "../../../components/dashboard/greeting";
import { HoursCard } from "../../../components/dashboard/hours-card";
import { KidCard } from "../../../components/dashboard/kid-card";
import { MemoriesCard } from "../../../components/dashboard/memories-card";
import { MonthCard } from "../../../components/dashboard/month-card";
import { PageColumn } from "../../../components/dashboard/page-column";
import { StatTiles } from "../../../components/dashboard/stat-tiles";
import { TimeZoneSync } from "../../../components/dashboard/time-zone-sync";
import { WinsCard } from "../../../components/dashboard/wins-card";

/**
 * /app/dashboard: the family dashboard, moved off the /app root (founder
 * ask 2026-07-09: chat is the app's default landing now, the dashboard
 * is a tab like planner and kids; named /app/dashboard per founder ask
 * 2026-07-10). Frame and hierarchy follow the design
 * system's web-app template (docs/homa-design/templates/web-app, the
 * Progress screen); the frame itself renders in the /app layout, this
 * page is the main column only. Every number on it is counted from real
 * rows (reports, plans, answers), never invented, per the display law.
 * Setup itself lives in ONE place, /onboarding (founder call 2026-07-08:
 * one onboarding for every door), so a signed-in visit with unfinished
 * setup, no family, family card not done, no kids, or no results yet
 * while an in-range kid waits, redirects there instead of duplicating
 * those forms here. Account settings (add a child, texting, time zone)
 * live on their own page, /app/settings (founder ask 2026-07-09).
 * Auth is enforced by proxy.ts; data access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false },
};

export default async function DashboardPage() {
  const data = await getAppData();
  // Unfinished setup lives in /onboarding, the one flow (see module doc).
  if (!data) redirect("/onboarding");
  const { family, children, reports, plans, pendingCurriculumChildIds } = data;

  const childIds = children.map((child) => child.id);
  const [wins, curricula, memories, weekHours] = await Promise.all([
    getRecentWins(childIds),
    getCurriculaForChildren(childIds),
    getMyMemories(family.id),
    getWeekHours(family.id),
  ]);

  const inRangeUnmapped = children.some(
    (child) => isInScoredRange(ageInMonths(child.birth_month)) && !reports.has(child.id),
  );
  // No results yet while an in-range kid waits: finish the questionnaire
  // first (the dashboard comes after results). A family whose kids are
  // all outside the scored range stays here; there is no report to wait
  // for.
  if (reports.size === 0 && inRangeUnmapped) redirect("/onboarding");

  const childNames = new Map(children.map((child) => [child.id, child.name]));

  return (
    <PageColumn>
      {/* Captures the device zone once, while the family row has none. */}
      {family.time_zone ? null : <TimeZoneSync />}
      <Greeting parentFirstName={parentFirstName(family)} timeZone={family.time_zone} />

      <StatTiles reports={[...reports.values()]} plans={plans} kidCount={children.length} />

      <FamilyNote kids={children} reports={reports} />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {children.map((child, index) => (
          <KidCard
            key={child.id}
            child={child}
            index={index}
            report={reports.get(child.id) ?? null}
            plans={plans.filter((plan) => plan.childId === child.id)}
            curriculum={curricula.get(child.id) ?? null}
            curriculumPending={pendingCurriculumChildIds.has(child.id)}
          />
        ))}
      </div>

      {plans.length > 0 || reports.size > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MonthCard plans={plans} reports={reports} childNames={childNames} />
          <WinsCard wins={wins} childNames={childNames} />
        </div>
      ) : null}

      {/* Visible only once something is saved: an empty memory list or
          hours card on day one reads as a gap, not a promise. */}
      {memories.length > 0 || weekHours.totalMinutes > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {weekHours.totalMinutes > 0 ? <HoursCard hours={weekHours} /> : null}
          {memories.length > 0 ? (
            <MemoriesCard memories={memories} childNames={childNames} />
          ) : null}
        </div>
      ) : null}
    </PageColumn>
  );
}
