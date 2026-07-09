import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ageInMonths, formatUsPhone, isInScoredRange } from "@homa/core";

import {
  buildUpNextItems,
  getPlansForChildren,
  getRecentWins,
  getReportsForChildren,
} from "../../lib/dashboard";
import { getCurriculaForChildren, getPendingCurriculumChildIds } from "../../lib/curriculum";
import { getFamilyPhone } from "../../lib/family-phone";
import { getMyChildren, getMyFamily } from "../../lib/family";
import { DashboardShell } from "../../components/dashboard/shell";
import { FamilyNote } from "../../components/dashboard/family-note";
import { Greeting } from "../../components/dashboard/greeting";
import { KidCard } from "../../components/dashboard/kid-card";
import { MonthCard } from "../../components/dashboard/month-card";
import { StatTiles } from "../../components/dashboard/stat-tiles";
import { TimeZoneSync } from "../../components/dashboard/time-zone-sync";
import { WinsCard } from "../../components/dashboard/wins-card";
import { AddChildForm } from "./setup-forms";
import { TextingCard } from "./texting-card";
import { TimeZoneCard } from "./time-zone-card";

/**
 * /home: the signed-in family dashboard, the family's homebase. Frame and
 * hierarchy follow the design system's web-app template (docs/homa-design/
 * templates/web-app, the Progress screen); every number on it is counted
 * from real rows (reports, plans, answers), never invented, per the
 * display law. Setup itself lives in ONE place, /onboarding (founder call
 * 2026-07-08: one onboarding for every door), so a signed-in visit with
 * unfinished setup, no family, family card not done, no kids, or no
 * results yet while an in-range kid waits, redirects there instead of
 * duplicating those forms here. Auth is enforced by proxy.ts; data access
 * is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false },
};

export default async function HomePage() {
  const family = await getMyFamily();

  // Unfinished setup lives in /onboarding, the one flow (see module doc).
  if (!family || !family.profile_completed_at) redirect("/onboarding");
  const children = await getMyChildren(family.id);
  if (children.length === 0) redirect("/onboarding");

  const childIds = children.map((child) => child.id);
  const [reports, plans, wins, curricula, pendingCurriculumChildIds, familyPhone] =
    await Promise.all([
      getReportsForChildren(childIds),
      getPlansForChildren(childIds),
      getRecentWins(childIds),
      getCurriculaForChildren(childIds),
      getPendingCurriculumChildIds(childIds),
      getFamilyPhone(family.id),
    ]);

  const inRangeUnmapped = children.some(
    (child) => isInScoredRange(ageInMonths(child.birth_month)) && !reports.has(child.id),
  );
  // No results yet while an in-range kid waits: finish the questionnaire
  // first (the dashboard comes after results). A family whose kids are
  // all outside the scored range stays here; there is no report to wait
  // for.
  if (reports.size === 0 && inRangeUnmapped) redirect("/onboarding");

  // Homa's own number, shown on the settings card only once this
  // deployment has a live texting line configured.
  const homaNumber =
    process.env.TELNYX_SMS_ENABLED === "true"
      ? (process.env.TELNYX_FROM_NUMBER ?? null)
      : null;

  const parentFirstName =
    (family.parent_display_name ?? family.name).trim().split(/\s+/)[0] || family.name;
  const childNames = new Map(children.map((child) => [child.id, child.name]));

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
    >
      {/* Captures the device zone once, while the family row has none. */}
      {family.time_zone ? null : <TimeZoneSync />}
      <Greeting parentFirstName={parentFirstName} timeZone={family.time_zone} />

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

      {/* Settings: the phone number card is always available (it's
          account contact info, not gated behind the texting feature),
          Homa's own number and the texting-specific copy render only
          once this deployment has a live line configured. */}
      <section id="settings" className="mt-10 scroll-mt-20">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
          Settings
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div id="add-child" className="scroll-mt-20">
            <AddChildForm familyId={family.id} />
          </div>
          <TextingCard
            linkedPhoneDisplay={familyPhone ? formatUsPhone(familyPhone.phone_e164) : null}
            homaNumberDisplay={homaNumber ? formatUsPhone(homaNumber) : null}
          />
          <TimeZoneCard currentTimeZone={family.time_zone} />
        </div>
      </section>
    </DashboardShell>
  );
}
