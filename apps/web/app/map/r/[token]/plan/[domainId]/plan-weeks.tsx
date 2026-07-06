"use client";

import { useEffect, useState } from "react";

import type { PlanWeek } from "@homa/core";

/**
 * The four weeks with check-off boxes. Progress lives in localStorage
 * (keyed by report token + subject), so the plan becomes a daily surface
 * she returns to instead of a printout she loses. Checks survive reloads
 * on her device; the retest email is the loop's real memory.
 */
export function PlanWeeks({
  weeks,
  storageKey,
}: {
  weeks: PlanWeek[];
  storageKey: string;
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // Private mode: checks just won't persist.
    }
    setLoaded(true);
  }, [storageKey]);

  function toggle(id: string) {
    setDone((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Persistence is a nicety, not a requirement.
      }
      return next;
    });
  }

  const total = weeks.reduce((sum, week) => sum + week.activities.length, 0);
  const doneCount = Object.values(done).filter(Boolean).length;

  return (
    <div className="mt-7 flex flex-col gap-4">
      {loaded && doneCount > 0 ? (
        <p className="font-hand text-xl text-sage">
          {doneCount} of {total} done {"\u270e"}
        </p>
      ) : null}
      {weeks.map((week) => (
        <div key={week.week} className="rounded-lg border border-border-subtle p-5">
          <h3 className="font-display text-lg font-semibold text-strong">Week {week.week}</h3>
          <p className="mt-0.5 text-sm text-muted">
            Focus: {week.focus.charAt(0).toLowerCase()}
            {week.focus.slice(1)}
          </p>
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
