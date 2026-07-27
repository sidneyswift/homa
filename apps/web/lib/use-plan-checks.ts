"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";

/**
 * The plan check-off store, shared by the tokenized plan page and the
 * week planner so a box ticked on either surface shows up on the other.
 * Checks live in TWO places on purpose: localStorage (instant, works for
 * any link holder, survives reloads on this device) and, for the owning
 * parent, the plan row itself via a debounced sync, so the month has a
 * memory the report can read at retest. A shared-link viewer's sync gets
 * a quiet 401 and their checks simply stay local; nothing is ever forged.
 *
 * localStorage is read through useSyncExternalStore (it IS an external
 * store): hydration-safe by construction (the server snapshot is null),
 * and no setState-in-effect cascade. The in-tab listener set makes a
 * toggle on one mounted surface re-render every other one immediately.
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

export function usePlanChecks({
  storageKey,
  childId,
  subjectId,
  initialChecks = {},
}: {
  storageKey: string;
  childId: string;
  subjectId: string;
  /** The plan row's synced checks: server truth, merged under local. */
  initialChecks?: Record<string, boolean>;
}): { done: Record<string, boolean>; toggle: (id: string) => void } {
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
        body: JSON.stringify({ childId, subjectId, checks: next }),
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

  return { done, toggle };
}

/** The one canonical localStorage key for a plan's checks, shared by
 * every surface that renders them. */
export function planChecksStorageKey(token: string, subjectId: string): string {
  return `homa-plan-${token}-${subjectId}`;
}

/**
 * Replaces the local copy with the server's map and re-renders every
 * mounted surface. Only for the moment right after an agent plan edit:
 * the server just remapped check keys around moved activities, so its
 * map is the truth and a stale local copy would tick the wrong boxes.
 * Everywhere else the normal local-over-server merge stands.
 */
export function overwritePlanChecks(
  storageKey: string,
  checks: Record<string, boolean>,
): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(checks));
  } catch {
    // Private mode: the server copy still renders via initialChecks.
  }
  storeListeners.forEach((listener) => listener());
}
