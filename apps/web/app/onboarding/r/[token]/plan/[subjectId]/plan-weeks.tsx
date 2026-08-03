"use client";

import type { PlanWeek } from "@homa/core";

import {
  legacyTokenPlanChecksStorageKey,
  useLegacyTokenPlanChecks,
} from "../../../../../../lib/use-legacy-token-plan-checks";

/**
 * The four weeks with check-off boxes. This shareable token page keeps
 * its own local-first store; authenticated Planner uses atomic checks.
 */

export function PlanWeeks({
  weeks,
  weekLines = null,
  reportToken,
  subjectId,
  initialChecks = {},
}: {
  weeks: PlanWeek[];
  /** Model-written framing line per week (D8 overturn), index-aligned;
   * null entries fall back to the template focus line alone. */
  weekLines?: Array<string | null> | null;
  reportToken: string;
  subjectId: string;
  /** The plan row's synced checks: server truth, merged under local. */
  initialChecks?: Record<string, boolean>;
}) {
  const { done, toggle } = useLegacyTokenPlanChecks({
    storageKey: legacyTokenPlanChecksStorageKey(reportToken, subjectId),
    reportToken,
    subjectId,
    initialChecks,
  });

  const total = weeks.reduce((sum, week) => sum + week.activities.length, 0);
  const doneCount = Object.values(done).filter(Boolean).length;

  return (
    <div className="mt-7 flex flex-col gap-4">
      {doneCount > 0 ? (
        <p className="font-hand text-xl text-sage">
          {doneCount} of {total} done {"\u270e"}
        </p>
      ) : null}
      {weeks.map((week, weekIndex) => (
        <div key={week.week} className="rounded-lg border border-border-subtle p-5">
          <h3 className="font-display text-lg font-semibold text-strong">Week {week.week}</h3>
          <p className="mt-0.5 text-sm text-muted">
            Focus: {week.focus.charAt(0).toLowerCase()}
            {week.focus.slice(1)}
          </p>
          {weekLines?.[weekIndex] ? (
            <p className="mt-1.5 text-sm text-body">{weekLines[weekIndex]}</p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {week.activities.map((activity, index) => {
              const id = `${week.week}.${index}`;
              const checked = Boolean(done[id]);
              return (
                <li key={id}>
                  <label className="flex cursor-pointer items-start gap-3 text-body">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                      className="mt-1 h-4 w-4 flex-shrink-0 accent-[var(--sage-500)]"
                    />
                    <span className={checked ? "text-subtle line-through decoration-[var(--sage-400)]" : ""}>
                      {activity}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
