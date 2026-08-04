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
    <div className="quiet-plan__weeks">
      {doneCount > 0 ? (
        <p className="quiet-plan__progress">
          {doneCount} of {total} done {"\u270e"}
        </p>
      ) : null}
      {weeks.map((week, weekIndex) => (
        <section key={week.week} className="quiet-plan__week">
          <h3 className="quiet-plan__week-title">Week {week.week}</h3>
          <p className="quiet-plan__week-focus">
            Focus: {week.focus.charAt(0).toLowerCase()}
            {week.focus.slice(1)}
          </p>
          {weekLines?.[weekIndex] ? (
            <p className="quiet-plan__week-note">{weekLines[weekIndex]}</p>
          ) : null}
          <ul className="quiet-plan__activities">
            {week.activities.map((activity, index) => {
              const id = `${week.week}.${index}`;
              const checked = Boolean(done[id]);
              return (
                <li key={id}>
                  <label className={`quiet-plan__activity ${checked ? "quiet-plan__activity--done" : ""}`.trim()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                    />
                    <span>{activity}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
