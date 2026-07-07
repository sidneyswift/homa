"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";

import type { PlanWeek } from "@homa/core";

/**
 * The four weeks with check-off boxes. Checks live in TWO places on
 * purpose: localStorage (instant, works for any link holder, survives
 * reloads on this device) and, for the owning parent, the plan row
 * itself via a debounced sync, so the month has a memory the report can
 * read at retest ("your work is showing up in the numbers", now with
 * receipts). A shared-link viewer's sync gets a quiet 401 and their
 * checks simply stay local; nothing is ever forged.
 *
 * localStorage is read through useSyncExternalStore (it IS an external
 * store): hydration-safe by construction (the server snapshot is null),
 * and no setState-in-effect cascade.
 */

const storeListeners = new Set<() => void>();

function subscribeToChecks(callback: () => void): () => void {
  storeListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    storeListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readChecks(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    // Private mode: checks just won't persist.
    return null;
  }
}

const SYNC_DEBOUNCE_MS = 900;

export function PlanWeeks({
  weeks,
  storageKey,
  weekLines = null,
  childId,
  domainId,
  initialChecks = {},
}: {
  weeks: PlanWeek[];
  storageKey: string;
  /** Model-written framing line per week (D8 overturn), index-aligned;
   * null entries fall back to the template focus line alone. */
  weekLines?: Array<string | null> | null;
  childId: string;
  domainId: string;
  /** The plan row's synced checks: server truth, merged under local. */
  initialChecks?: Record<string, boolean>;
}) {
  const rawDone = useSyncExternalStore(
    subscribeToChecks,
    () => readChecks(storageKey),
    () => null,
  );
  const done = useMemo<Record<string, boolean>>(() => {
    let local: Record<string, boolean> = {};
    if (rawDone) {
      try {
        local = JSON.parse(rawDone) as Record<string, boolean>;
      } catch {
        local = {};
      }
    }
    // Server ∪ local, true wins: a check made on her phone shows up on
    // the laptop, and a check made offline still counts here.
    return { ...initialChecks, ...local };
  }, [rawDone, initialChecks]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSync(next: Record<string, boolean>) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void fetch("/api/map/plan/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, domainId, checks: next }),
      }).catch(() => undefined);
    }, SYNC_DEBOUNCE_MS);
  }

  function toggle(id: string) {
    const next = { ...done, [id]: !done[id] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Persistence is a nicety, not a requirement.
    }
    storeListeners.forEach((listener) => listener());
    scheduleSync(next);
  }

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
