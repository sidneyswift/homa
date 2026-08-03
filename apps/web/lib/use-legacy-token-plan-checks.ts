"use client";

import { useMemo, useRef, useSyncExternalStore } from "react";

/**
 * Local-first checks for the shareable token plan page only. A link
 * holder can check boxes on this device, while an owning parent with a
 * matching session also syncs the whole map to the token's plan.
 * Authenticated app surfaces must use useAuthenticatedPlanChecks.
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
    return null;
  }
}

const SYNC_DEBOUNCE_MS = 900;

export function useLegacyTokenPlanChecks({
  storageKey,
  reportToken,
  subjectId,
  initialChecks = {},
}: {
  storageKey: string;
  reportToken: string;
  subjectId: string;
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
    return { ...initialChecks, ...local };
  }, [rawDone, initialChecks]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSync(next: Record<string, boolean>) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void fetch("/api/map/plan/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportToken, subjectId, checks: next }),
      }).catch(() => undefined);
    }, SYNC_DEBOUNCE_MS);
  }

  function toggle(id: string) {
    const next = { ...done, [id]: !done[id] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Shared-link checks remain usable in memory when storage is unavailable.
    }
    storeListeners.forEach((listener) => listener());
    scheduleSync(next);
  }

  return { done, toggle };
}

export function legacyTokenPlanChecksStorageKey(
  reportToken: string,
  subjectId: string,
): string {
  return `homa-plan-${reportToken}-${subjectId}`;
}
