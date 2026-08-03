import type { AbilitiesExplorerSubjectId } from "./abilities-explorer-types";

export const ABILITIES_EXPLORER_EVENT_NAMES = [
  "progress.explorer_opened",
  "progress.explorer_subject_selected",
  "progress.explorer_ability_detail_opened",
  "progress.explorer_find_opened",
  "progress.explorer_connected_ability_opened",
  "progress.explorer_ask_homa_opened",
] as const;

export type AbilitiesExplorerEventName =
  (typeof ABILITIES_EXPLORER_EVENT_NAMES)[number];

export type AbilitiesExplorerDevice = "desktop" | "phone" | "tablet" | "unknown";

function deviceClass(): AbilitiesExplorerDevice {
  if (typeof window === "undefined") return "unknown";
  const width = window.innerWidth;
  if (width < 640) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

/** Best-effort analytics. A dropped beacon must never change the map UX. */
export function sendAbilitiesExplorerEvent(
  event: AbilitiesExplorerEventName,
  childId: string,
  subject: AbilitiesExplorerSubjectId,
): void {
  if (typeof window === "undefined") return;
  void fetch("/api/progress/abilities-explorer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, childId, subject, device: deviceClass() }),
    keepalive: true,
  }).catch(() => {
    // Analytics is deliberately fail-soft. The graph remains usable offline.
  });
}
