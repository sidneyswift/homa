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
    if (knownDuplicates.has(fingerprint)) {
      results.push({ item, outcome: "duplicate", detail: "Already exported from this device." });
      continue;
    }
    try {
      const eventId = await destination.create(calendarCreatePayload(item));
      await remember(familyId, fingerprint, eventId);
      results.push({ item, outcome: "saved", detail: destination.title });
    } catch (cause) {
      results.push({
        item,
        outcome: "failed",
        detail: cause instanceof Error ? cause.message : "The event was not saved.",
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
