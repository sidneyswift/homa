import Link from "next/link";

import { ageInMonths, getMapDomain, isInScoredRange, MONTH_PLAN_DOMAIN } from "@homa/core";

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
 * store as the plan pages. Day-by-day scheduling is a later milestone
 * (M2-10); until then this board never pretends activities have days.
 */

/** Block tones cycle the template's subject palette per column position. */
const BLOCK_TONES: readonly WeekBlockTone[] = [
  { bg: "var(--clay-50)", ink: "var(--clay-700)" },
  { bg: "var(--sage-50)", ink: "var(--sage-700)" },
  { bg: "var(--gold-100)", ink: "var(--gold-ink)" },
  { bg: "var(--sky-100)", ink: "var(--sky-600)" },
];

function subjectLabel(domainId: string): string {
  if (domainId === MONTH_PLAN_DOMAIN) return "The month";
  return getMapDomain(domainId)?.displayName ?? domainId;
}

export function PlannerView({
  kids,
  reports,
  plans,
  timeZone,
  now,
}: {
  kids: ChildRecord[];
  reports: Map<string, DashboardReport>;
  plans: DashboardPlan[];
  timeZone: string;
  now: Date;
}) {
  const nowMs = now.getTime();
  const plansByKid = new Map<string, DashboardPlan[]>();
  for (const plan of plans) {
    const list = plansByKid.get(plan.childId) ?? [];
    list.push(plan);
    plansByKid.set(plan.childId, list);
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            This week {"\u00b7"} {weekSpanLabel(now, timeZone)}
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            Your week
          </h1>
        </div>
        <Link
          href="/chat"
          className="rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          Ask Homa to adjust the week
        </Link>
      </header>

      {plans.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border-subtle bg-card p-8 text-center shadow-sm">
          <p className="font-display text-xl font-semibold text-strong">
            No months are running yet.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Every report has a one-tap month: four weeks of small moves aimed at exactly
            what&apos;s growing. Start one and this board fills in.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {kids.map((child) => {
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
        <div className="mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kids.map((child, index) => {
            const kidPlans = plansByKid.get(child.id) ?? [];
            if (kidPlans.length === 0) return null;
            const [avatarBg, avatarInk] = avatarTone(index);
            return (
              <section
                key={child.id}
                aria-label={`${child.name}'s week`}
                className="flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-card p-3.5 shadow-sm"
              >
                <Link href={`/kids/${child.id}`} className="flex items-center gap-2.5 px-0.5 group">
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
                      key={`${plan.childId}-${plan.domainId}`}
                      subjectLabel={subjectLabel(plan.domainId)}
                      week={plan.weeks[weekIdx]}
                      weekNumber={weekIdx + 1}
                      childId={plan.childId}
                      domainId={plan.domainId}
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
