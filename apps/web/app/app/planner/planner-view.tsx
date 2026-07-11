import Link from "next/link";

import { ageInMonths, getMapSubject, isInScoredRange, MONTH_PLAN_SUBJECT } from "@homa/core";

import type { ChildRecord } from "../../../lib/family";
import {
  currentWeekIndex,
  type DashboardPlan,
  type DashboardReport,
} from "../../../lib/dashboard";
import { weekdayCells, weekSpanLabel } from "../../../lib/time-zone";
import { avatarTone } from "../../../components/dashboard/sidebar";
import {
  DayGrid,
  type PlannerDay,
  type PlannerDayItem,
  type PlannerDayPlan,
} from "./day-grid";
import { spreadAcrossWeekdays } from "./spread-week";

/**
 * The week board as a Monday-to-Friday calendar (founder ask,
 * 2026-07-10; pure render, page.tsx owns auth + data). Each kid's
 * CURRENT week of their real four-week plans is spread across the five
 * weekdays (spread-week.ts, deterministic), checkable in place through
 * the same store as the plan pages. The focus strip above the grid
 * keeps each plan's focus line, week-of-4 position, and full-plan
 * link. Day placement is presentation only, checks stay keyed by plan;
 * persisted day-by-day scheduling is a later milestone (M2-10). When
 * the context switcher has one kid selected (focusChildId), the board
 * narrows to that kid and the heading names them.
 */

interface BlockTone {
  bg: string;
  ink: string;
}

/** Block tones cycle the template's subject palette per plan position. */
const BLOCK_TONES: readonly BlockTone[] = [
  { bg: "var(--clay-50)", ink: "var(--clay-700)" },
  { bg: "var(--sage-50)", ink: "var(--sage-700)" },
  { bg: "var(--gold-100)", ink: "var(--gold-ink)" },
  { bg: "var(--sky-100)", ink: "var(--sky-600)" },
];

function subjectLabel(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

/** One plan's context row in the focus strip above the grid. */
interface FocusRow {
  key: string;
  kidName: string | null;
  avatarBg: string;
  avatarInk: string;
  subjectLabel: string;
  focus: string;
  weekNumber: number;
  tone: BlockTone;
  planHref: string;
  retestDue: boolean;
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

  const days: PlannerDay[] = weekdayCells(now, timeZone).map((cell) => ({
    cell,
    items: [],
  }));
  const dayPlans: PlannerDayPlan[] = [];
  const focusRows: FocusRow[] = [];

  kids.forEach((child, kidIndex) => {
    if (focusKid && child.id !== focusKid.id) return;
    const token = reports.get(child.id)?.token;
    if (!token) return;
    const kidPlans = plansByKid.get(child.id) ?? [];
    const [avatarBg, avatarInk] = avatarTone(kidIndex);

    // Gather the kid's whole week first, then spread it over the five
    // days, so one kid's activities pace the week instead of piling up.
    const gathered: Omit<PlannerDayItem, "kidName" | "avatarBg" | "avatarInk">[] = [];
    kidPlans.forEach((plan) => {
      const weekIdx = currentWeekIndex(plan, nowMs);
      const week = plan.weeks[weekIdx];
      // Cycle tones across the whole board (focusRows counts every plan
      // placed so far), so on the family calendar two kids' first plans
      // get different colors instead of both landing on clay.
      const tone = BLOCK_TONES[focusRows.length % BLOCK_TONES.length];
      const planKey = `${plan.childId}:${plan.subjectId}`;
      dayPlans.push({
        key: planKey,
        childId: plan.childId,
        subjectId: plan.subjectId,
        token,
        initialChecks: plan.progress,
      });
      focusRows.push({
        key: planKey,
        kidName: focusKid ? null : child.name,
        avatarBg,
        avatarInk,
        subjectLabel: subjectLabel(plan.subjectId),
        focus: week.focus,
        weekNumber: weekIdx + 1,
        tone,
        planHref: `/onboarding/r/${token}/plan/${plan.subjectId}`,
        retestDue: new Date(plan.retestAt).getTime() <= nowMs,
      });
      week.activities.forEach((text, index) => {
        gathered.push({
          planKey,
          checkId: `${week.week}.${index}`,
          text,
          toneBg: tone.bg,
          toneInk: tone.ink,
          subjectLabel: subjectLabel(plan.subjectId),
        });
      });
    });

    const slots = spreadAcrossWeekdays(gathered.length);
    gathered.forEach((entry, index) => {
      days[slots[index]].items.push({
        ...entry,
        kidName: focusKid ? null : child.name,
        avatarBg,
        avatarInk,
      });
    });
  });

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

      {focusRows.length === 0 ? (
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
        <>
          <div className="mt-6 flex flex-col gap-1.5">
            {focusRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md px-3 py-2"
                style={{ background: row.tone.bg }}
              >
                {row.kidName ? (
                  <span
                    className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[0.68rem] font-bold"
                    style={{ background: row.avatarBg, color: row.avatarInk }}
                    title={row.kidName}
                    aria-label={row.kidName}
                  >
                    {row.kidName.charAt(0)}
                  </span>
                ) : null}
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.05em]"
                  style={{ color: row.tone.ink }}
                >
                  {row.subjectLabel}
                </span>
                <span className="min-w-0 flex-1 basis-52 text-[0.82rem] leading-snug text-body">
                  {row.focus}
                </span>
                <span className="font-mono text-[0.62rem]" style={{ color: row.tone.ink }}>
                  week {row.weekNumber} of 4
                </span>
                {row.retestDue ? (
                  <span
                    className="rounded-pill px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em]"
                    style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}
                  >
                    re-check ready
                  </span>
                ) : null}
                <Link
                  href={row.planHref}
                  className="text-[0.72rem] font-semibold text-brand hover:underline"
                >
                  full plan
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <DayGrid days={days} plans={dayPlans} />
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-subtle">
        Check things off as they happen; the report reads this at re-check time. The days are
        a starting point: any day counts, and moving activities around is coming.
      </p>
    </>
  );
}
