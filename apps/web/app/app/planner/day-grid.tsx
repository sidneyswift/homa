"use client";

import { useMemo } from "react";

import { planChecksStorageKey, usePlanChecks } from "../../../lib/use-plan-checks";
import type { WeekdayCell } from "../../../lib/time-zone";

/**
 * The week board as a Monday-to-Friday calendar. Server code
 * (planner-view.tsx) decides which activity lands on which day; this
 * component owns the rendering and the in-place check-offs, through the
 * same storage key and sync endpoint as the plan pages, so a box ticked
 * here is already ticked there (and on her phone).
 *
 * Checks stay keyed by plan ("week.activityIndex"), never by day: the
 * day placement is presentation, and rearranging or persisting it is
 * the M2-10 scheduling milestone, not this board.
 */

export interface PlannerDayPlan {
  /** Stable key items point at: `${childId}:${subjectId}`. */
  key: string;
  childId: string;
  subjectId: string;
  /** The report token (storage key + sync identity). */
  token: string;
  initialChecks: Record<string, boolean>;
}

export interface PlannerDayItem {
  planKey: string;
  /** "week.activityIndex", the same id the checks map uses. */
  checkId: string;
  text: string;
  /** Kid chip, shown only on the whole-family board. */
  kidName: string | null;
  avatarBg: string;
  avatarInk: string;
  toneBg: string;
  toneInk: string;
  subjectLabel: string;
}

export interface PlannerDay {
  cell: WeekdayCell;
  items: PlannerDayItem[];
}

function ActivityCard({ item, plan }: { item: PlannerDayItem; plan: PlannerDayPlan }) {
  const { done, toggle } = usePlanChecks({
    storageKey: planChecksStorageKey(plan.token, plan.subjectId),
    childId: plan.childId,
    subjectId: plan.subjectId,
    initialChecks: plan.initialChecks,
  });
  const checked = Boolean(done[item.checkId]);

  return (
    <div className="rounded-md p-2.5" style={{ background: item.toneBg }}>
      <div className="flex items-center justify-between gap-1.5">
        <span
          className="text-[0.58rem] font-bold uppercase tracking-[0.05em]"
          style={{ color: item.toneInk }}
        >
          {item.subjectLabel}
        </span>
        {item.kidName ? (
          <span
            className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold"
            style={{ background: item.avatarBg, color: item.avatarInk }}
            title={item.kidName}
            aria-label={item.kidName}
          >
            {item.kidName.charAt(0)}
          </span>
        ) : null}
      </div>
      <label className="mt-1.5 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggle(item.checkId)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--sage-500)]"
        />
        <span
          className={
            checked
              ? "text-[0.78rem] leading-snug text-subtle line-through decoration-[var(--sage-400)]"
              : "text-[0.78rem] leading-snug text-body"
          }
        >
          {item.text}
        </span>
      </label>
    </div>
  );
}

export function DayGrid({ days, plans }: { days: PlannerDay[]; plans: PlannerDayPlan[] }) {
  const plansByKey = useMemo(() => new Map(plans.map((plan) => [plan.key, plan])), [plans]);

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {days.map((day) => (
        <section
          key={day.cell.label}
          aria-label={`${day.cell.label} ${day.cell.dayOfMonth}${day.cell.isToday ? ", today" : ""}`}
          className={
            day.cell.isToday
              ? "flex flex-col gap-2 rounded-lg border border-brand bg-card p-2.5 shadow-sm"
              : "flex flex-col gap-2 rounded-lg border border-border-subtle bg-card p-2.5 shadow-sm"
          }
        >
          <header className="flex items-baseline justify-between gap-2 px-0.5">
            <span
              className={
                day.cell.isToday
                  ? "text-[0.68rem] font-bold uppercase tracking-[0.12em] text-brand"
                  : "text-[0.68rem] font-bold uppercase tracking-[0.12em] text-subtle"
              }
            >
              {day.cell.label} {day.cell.dayOfMonth}
            </span>
            {day.cell.isToday ? (
              <span className="rounded-pill bg-brand px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-on-brand">
                today
              </span>
            ) : null}
          </header>
          {day.items.length > 0 ? (
            day.items.map((item) => {
              const plan = plansByKey.get(item.planKey);
              if (!plan) return null;
              return (
                <ActivityCard
                  key={`${item.planKey}-${item.checkId}`}
                  item={item}
                  plan={plan}
                />
              );
            })
          ) : (
            <p className="px-0.5 pb-1 text-[0.72rem] text-subtle md:min-h-10">
              Open day
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
