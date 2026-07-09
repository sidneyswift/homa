"use client";

import Link from "next/link";
import type { PlanWeek } from "@homa/core";

import { planChecksStorageKey, usePlanChecks } from "../../../lib/use-plan-checks";

/**
 * One subject's block on the week board: this week's focus and
 * activities from the child's real four-week plan, checkable in place.
 * Shares the plan page's exact storage key and sync endpoint, so a box
 * ticked here is already ticked there (and on her phone). Checked rows
 * get the template's done treatment: sage check, strikethrough, faded.
 */

export interface WeekBlockTone {
  bg: string;
  ink: string;
}

export function WeekBlock({
  subjectLabel,
  week,
  weekNumber,
  childId,
  domainId,
  token,
  initialChecks,
  tone,
  retestDue,
}: {
  subjectLabel: string;
  week: PlanWeek;
  /** 1-based, for the "week n of 4" chip. */
  weekNumber: number;
  childId: string;
  domainId: string;
  /** The report token, for the storage key + the full-plan link. */
  token: string;
  initialChecks: Record<string, boolean>;
  tone: WeekBlockTone;
  retestDue: boolean;
}) {
  const { done, toggle } = usePlanChecks({
    storageKey: planChecksStorageKey(token, domainId),
    childId,
    domainId,
    initialChecks,
  });

  return (
    <div className="rounded-md p-3.5" style={{ background: tone.bg }}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[0.62rem] font-bold uppercase tracking-[0.05em]"
          style={{ color: tone.ink }}
        >
          {subjectLabel}
        </span>
        <span className="font-mono text-[0.62rem]" style={{ color: tone.ink }}>
          week {weekNumber} of 4
        </span>
      </div>
      <p className="mt-1 text-[0.85rem] font-medium text-body">
        {week.focus}
      </p>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {week.activities.map((activity, index) => {
          const id = `${week.week}.${index}`;
          const checked = Boolean(done[id]);
          return (
            <li key={id}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--sage-500)]"
                />
                <span
                  className={
                    checked
                      ? "text-[0.82rem] leading-snug text-subtle line-through decoration-[var(--sage-400)]"
                      : "text-[0.82rem] leading-snug text-body"
                  }
                >
                  {activity}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Link
          href={`/onboarding/r/${token}/plan/${domainId}`}
          className="text-[0.72rem] font-semibold text-brand hover:underline"
        >
          full plan
        </Link>
        {retestDue ? (
          <span
            className="rounded-pill px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em]"
            style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}
          >
            re-check ready
          </span>
        ) : null}
      </div>
    </div>
  );
}
