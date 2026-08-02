import * as Calendar from "expo-calendar";

import type { CalendarCreatePayload } from "./device-calendar-export";

export interface DeviceCalendarDestination {
  id: string;
  title: string;
  create(payload: CalendarCreatePayload): Promise<string>;
}

export type CalendarDestinationResult =
  | { kind: "ready"; destination: DeviceCalendarDestination }
  | { kind: "denied"; canAskAgain: boolean }
  | { kind: "canceled" }
  | { kind: "failed"; message: string };

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Calendar could not be opened.";
}

/**
 * iOS-only and write-only by construction. This never calls getCalendars,
 * listEvents, getEvent, or any other personal-event read API.
 */
export async function chooseWriteOnlyCalendar(): Promise<CalendarDestinationResult> {
  try {
    const permission = await Calendar.requestCalendarPermissions(true);
    if (!permission.granted) return { kind: "denied", canAskAgain: permission.canAskAgain };
    const calendar = await Calendar.presentPicker();
    if (!calendar) return { kind: "canceled" };
    return {
      kind: "ready",
      destination: {
        id: calendar.id,
        title: calendar.title,
        async create(payload) {
          const event = await calendar.createEvent({
            title: payload.title,
            startDate: payload.startDate,
            endDate: payload.endDate,
            allDay: payload.allDay,
            timeZone: payload.timeZone,
            notes: payload.notes,
            url: payload.url,
            recurrenceRule: payload.recurrenceRule
              ? {
                  ...payload.recurrenceRule,
                  frequency: Calendar.Frequency.WEEKLY,
                  daysOfTheWeek: payload.recurrenceRule.daysOfTheWeek.map(({ dayOfTheWeek }) => ({
                    dayOfTheWeek: dayOfTheWeek as Calendar.DayOfTheWeek,
                  })),
                }
              : undefined,
          });
          return event.id;
        },
      },
    };
  } catch (cause) {
    return { kind: "failed", message: errorMessage(cause) };
  }
}
