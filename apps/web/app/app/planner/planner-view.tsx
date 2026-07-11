import Link from "next/link";

import { ageInMonths, getMapSubject, isInScoredRange, MONTH_PLAN_SUBJECT } from "@homa/core";

import type { ChildRecord } from "../../../lib/family";
import {
  currentWeekIndex,
  type DashboardPlan,
  type DashboardReport,
} from "../../../lib/dashboard";
import { weekSpanLabel } from "../../../lib/time-zone";
import { avatarTone } from "../../../components/dashboard/sidebar";
import { WeekBlock, type WeekBlockTone } from "./week-block";

/**
 * The week board itself (pure render; page.tsx owns auth + data). Each
 * kid's column shows the CURRENT week of their real four-week plans,
 * derived from the retest clock, checkable in place through the same
 * store as the plan pages. When the context switcher has one kid
 * selected (focusChildId), the board narrows to that kid's column and
 * the heading names them; the whole family is the default. Day-by-day
 * scheduling is a later milestone (M2-10); until then this board never
 * pretends activities have days.
 */

/** Block tones cycle the template's subject palette per column position. */
const BLOCK_TONES: readonly WeekBlockTone[] = [
  { bg: "var(--clay-50)", ink: "var(--clay-700)" },
  { bg: "var(--sage-50)", ink: "var(--sage-700)" },
  { bg: "var(--gold-100)", ink: "var(--gold-ink)" },
  { bg: "var(--sky-100)", ink: "var(--sky-600)" },
];

function subjectLabel(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

export function PlannerView({
  kids,
  reports,
  plans,
  timeZone,
  now,
  focusChildId,
}: {
  kids: ChildRecord[];
  reports: Map<string, DashboardReport>;
  plans: DashboardPlan[];
  timeZone: string;
  now: Date;
  /** One kid selected in the context switcher, or null for everyone. */
  focusChildId: string | null;
}) {
  const nowMs = now.getTime();
  const plansByKid = new Map<string, DashboardPlan[]>();
  for (const plan of plans) {
    const list = plansByKid.get(plan.childId) ?? [];
    list.push(plan);
    plansByKid.set(plan.childId, list);
  }

  // The switcher narrows the board; avatar tones still come from each
  // kid's position in the FULL family list so colors never shift.
  const focusKid = focusChildId ? kids.find((kid) => kid.id === focusChildId) ?? null : null;
  const visibleKids = focusKid ? [focusKid] : kids;
  const visiblePlans = focusKid ? plans.filter((plan) => plan.childId === focusKid.id) : plans;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            This week {"\u00b7"} {weekSpanLabel(now, timeZone)}
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            {focusKid ? `${focusKid.name}'s week` : "Your week"}
          </h1>
        </div>
        <Link
          href="/app"
          className="rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          Ask Homa to adjust the week
        </Link>
      </header>

      {visiblePlans.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border-subtle bg-card p-8 text-center shadow-sm">
          <p className="font-display text-xl font-semibold text-strong">
            {focusKid
              ? `There's no month set up for ${focusKid.name} yet.`
              : "There's no month set up yet."}
          </p>
          {/* Copy-kit empty-state shape, reworded through both copy gates
              (2026-07-10): define a month first, then the mechanic; the
              buttons below are the door. */}
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            A month is four weeks of small activities. One tap in the progress
            report builds it, and this page fills in.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {visibleKids.map((child) => {
              const token = reports.get(child.id)?.token;
              if (token) {
                return (
                  <Link
                    key={child.id}
                    href={`/onboarding/r/${token}`}
                    className="inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
                  >
                    Open {child.name}&apos;s report
                  </Link>
                );
              }
              if (isInScoredRange(ageInMonths(child.birth_month))) {
                return (
                  <Link
                    key={child.id}
                    href="/onboarding"
                    className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong transition-colors hover:border-brand"
                  >
                    Start {child.name}&apos;s checklist
                  </Link>
                );
              }
              return null;
            })}
          </div>
        </div>
      ) : (
        <div
          className={
            focusKid
              ? "mt-6 grid items-start gap-4 md:max-w-xl"
              : "mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {kids.map((child, index) => {
            if (focusKid && child.id !== focusKid.id) return null;
            const kidPlans = plansByKid.get(child.id) ?? [];
            if (kidPlans.length === 0) return null;
            const [avatarBg, avatarInk] = avatarTone(index);
            return (
              <section
                key={child.id}
                aria-label={`${child.name}'s week`}
                className="flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-card p-3.5 shadow-sm"
              >
                <Link href={`/app/kids/${child.id}`} className="flex items-center gap-2.5 px-0.5 group">
                  <span
                    className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: avatarBg, color: avatarInk }}
                  >
                    {child.name.charAt(0)}
                  </span>
                  <span className="text-sm font-bold text-strong group-hover:text-brand">
                    {child.name}
                  </span>
                </Link>
                {kidPlans.map((plan, planIndex) => {
                  const token = reports.get(child.id)?.token;
                  if (!token) return null;
                  const weekIdx = currentWeekIndex(plan, nowMs);
                  return (
                    <WeekBlock
                      key={`${plan.childId}-${plan.subjectId}`}
                      subjectLabel={subjectLabel(plan.subjectId)}
                      week={plan.weeks[weekIdx]}
                      weekNumber={weekIdx + 1}
                      childId={plan.childId}
                      subjectId={plan.subjectId}
                      token={token}
                      initialChecks={plan.progress}
                      tone={BLOCK_TONES[planIndex % BLOCK_TONES.length]}
                      retestDue={new Date(plan.retestAt).getTime() <= nowMs}
                    />
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-subtle">
        Check things off as they happen; the report reads this at re-check time. Day-by-day
        scheduling is coming; for now the week is yours to arrange.
      </p>
    </>
  );
}
