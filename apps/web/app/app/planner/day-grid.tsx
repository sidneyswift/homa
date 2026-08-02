"use client";

import { useMemo } from "react";

import type { FamilyAssetReference } from "../../../lib/library/family-asset-reference";
import { planChecksStorageKey, usePlanChecks } from "../../../lib/use-plan-checks";
import type { WeekdayCell } from "../../../lib/time-zone";
import { KidAvatar } from "../../../components/dashboard/kid-avatar";

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
  /**
   * True for a week derived from the child's age, which has no stored
   * plan row behind it (founder ruling onboarding-lesson-per-subject).
   * Its activities are real and worth reading; there is simply nowhere
   * to record a check-off, so the box is not offered rather than
   * offered and silently dropped.
   */
  readOnly?: boolean;
}

export interface PlannerDayItem {
  planKey: string;
  /** "week.activityIndex", the same id the checks map uses. */
  checkId: string;
  text: string;
  /** Kid chip, shown only on the whole-family board. */
  kidName: string | null;
  /** Position in the family list (tone) and the photo when added. */
  kidIndex: number;
  kidAvatarUrl: string | null;
  toneBg: string;
  toneInk: string;
  subjectLabel: string;
  /** Family Library resources that grounded this activity. */
  sources: FamilyAssetReference[];
}

export interface PlannerDay {
  cell: WeekdayCell;
  items: PlannerDayItem[];
  /** D17, birthday on the board (§4.2): "Mia turns 7", render-only,
   * one line per visible kid whose real birthday lands on this day.
   * Empty on every ordinary day. */
  birthdays?: string[];
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
          <KidAvatar
            name={item.kidName}
            index={item.kidIndex}
            avatarUrl={item.kidAvatarUrl}
            size={18}
            label={item.kidName}
          />
        ) : null}
      </div>
      <label
        className={`mt-1.5 flex items-start gap-2 ${plan.readOnly ? "" : "cursor-pointer"}`}
      >
        {plan.readOnly ? (
          // A dot, not a disabled checkbox: a greyed box invites a tap
          // and then refuses it, which reads as broken rather than as
          // not-yet-hers.
          <span
            aria-hidden="true"
            className="mt-[0.4rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-border"
          />
        ) : (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggle(item.checkId)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--sage-500)]"
          />
        )}
        {/* Done = sage check + faded text, no strikethrough: these are
            multi-sentence activities, and a line through a paragraph
            made the week's anchor unreadable (reader gate 2026-07-11). */}
        <span
          className={
            checked
              ? "text-[0.78rem] leading-snug text-subtle"
              : "text-[0.78rem] leading-snug text-body"
          }
        >
          {item.text}
        </span>
      </label>
      {item.sources.length > 0 ? (
        <p className="ml-6 mt-1 text-[0.68rem] leading-snug text-subtle">
          <span className="font-semibold">From </span>
          {item.sources.map((source, index) => (
            <span key={source.id}>
              {index > 0 ? ", " : null}
              {source.libraryUrl ? (
                <a
                  href={source.libraryUrl}
                  className="underline decoration-border underline-offset-2 hover:text-body"
                >
                  {source.title}
                  {source.sourceLocator ? ` · ${source.sourceLocator}` : null}
                </a>
              ) : (
                `${source.title}${source.sourceLocator ? ` · ${source.sourceLocator}` : ""}`
              )}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function DayGrid({
  days,
  plans,
  singleColumn = false,
}: {
  days: PlannerDay[];
  plans: PlannerDayPlan[];
  /** The chat's planner canvas is ~half a viewport wide: five viewport-
   * breakpoint columns would crush there, so it stacks the days. */
  singleColumn?: boolean;
}) {
  const plansByKey = useMemo(() => new Map(plans.map((plan) => [plan.key, plan])), [plans]);

  return (
    <div className={singleColumn ? "grid gap-3" : "grid gap-3 md:grid-cols-5"}>
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
          {day.birthdays && day.birthdays.length > 0 ? (
            <div className="flex flex-col gap-1 px-0.5">
              {day.birthdays.map((label) => (
                <span
                  key={label}
                  className="w-fit rounded-pill bg-[var(--gold-100)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--gold-ink)]"
                >
                  {"\u{1F382}"} {label}
                </span>
              ))}
            </div>
          ) : null}
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
            <>
              {/* "Free", not "Open": on a page of verb-first buttons,
                  "Open day" parses as an instruction to open something
                  (copy-editor gate 2026-07-11). */}
              <p className="px-0.5 pb-1 text-[0.72rem] text-subtle md:min-h-10">
                Free day
              </p>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
