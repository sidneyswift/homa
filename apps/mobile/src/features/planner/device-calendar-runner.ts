import {
  calendarCreatePayload,
  calendarExportFingerprint,
  type CalendarExportItem,
} from "./device-calendar-export";
import type { DeviceCalendarDestination } from "./device-calendar-native";

export type CalendarExportOutcome = "saved" | "canceled" | "denied" | "duplicate" | "failed";

export interface CalendarExportResult {
  item: CalendarExportItem;
  outcome: CalendarExportOutcome;
  detail: string | null;
}

const SESSION_EXPORT_LIMIT = 500;
const sessionExports = new Set<string>();

function sessionExportKey(familyId: string, fingerprint: string): string {
  return `${familyId}:${fingerprint}`;
}

function rememberForSession(key: string): void {
  sessionExports.add(key);
  if (sessionExports.size <= SESSION_EXPORT_LIMIT) return;
  const oldest = sessionExports.values().next().value;
  if (oldest) sessionExports.delete(oldest);
}

export async function saveCalendarExports(
  familyId: string,
  items: readonly CalendarExportItem[],
  knownDuplicates: ReadonlySet<string>,
  destination: DeviceCalendarDestination,
  remember: (familyId: string, fingerprint: string, deviceEventId: string | null) => Promise<void>,
): Promise<CalendarExportResult[]> {
  const results: CalendarExportResult[] = [];
  for (const item of items) {
    const fingerprint = calendarExportFingerprint(item);
    const sessionKey = sessionExportKey(familyId, fingerprint);
    if (knownDuplicates.has(fingerprint)) {
      results.push({ item, outcome: "duplicate", detail: "Already exported from this device." });
      continue;
    }
    if (sessionExports.has(sessionKey)) {
      results.push({ item, outcome: "duplicate", detail: "Already saved in this Homa session." });
      continue;
    }
    let eventId: string;
    try {
      eventId = await destination.create(calendarCreatePayload(item));
    } catch (cause) {
      results.push({
        item,
        outcome: "failed",
        detail: cause instanceof Error ? cause.message : "The event was not saved.",
      });
      continue;
    }

    // The provider result is authoritative. Once EventKit returns an id,
    // the event is saved even if Homa's local retry ledger fails afterward.
    rememberForSession(sessionKey);
    try {
      await remember(familyId, fingerprint, eventId);
      results.push({ item, outcome: "saved", detail: destination.title });
    } catch {
      results.push({
        item,
        outcome: "saved",
        detail: `Saved to ${destination.title}. Homa could not record duplicate protection on this device. Check the calendar before retrying after restarting Homa.`,
      });
    }
  }
  return results;
}

export function outcomeResults(
  items: readonly CalendarExportItem[],
  outcome: Extract<CalendarExportOutcome, "canceled" | "denied" | "failed">,
  detail: string,
): CalendarExportResult[] {
  return items.map((item) => ({ item, outcome, detail }));
}
