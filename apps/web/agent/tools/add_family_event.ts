import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  addFamilyEventCaller,
  addFamilyEventPinned,
  getFamilyEventCaller,
  getFamilyEventPinned,
  parseFamilyEventInput,
} from "../../lib/family-events";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

/**
 * Homa's own family calendar (issue #176, CG-03), a co-founder's own
 * words: "have an option for each kid and then a family calendar...
 * added homa lessons, family subjects, related activities, appts etc."
 * This is the appointments-and-trips half; school-plan scheduling is a
 * separate tool, schedule_plan_activity. Not Google Calendar and never
 * synced externally (her words were explicit this is Homa's own
 * calendar), and this tool never reshuffles anything else on the
 * schedule around a new event: that optimizer ("doctor's appt Tuesday,
 * let's push things back") is explicitly out of scope for this slice.
 */

export default defineBoundedTool({
  description:
    "Add an appointment, trip, or other non-school event to the family's own calendar (never Google or any external calendar): a doctor's appointment, a co-op day, a museum visit, a family trip. Use when the parent mentions something happening on a specific day or date range that is not a school lesson. Give it a whole family (omit childId) or one child's own calendar. Does not touch or reshuffle anything else already scheduled.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z
    .object({
      title: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .describe("Short, plain name for the event, e.g. \"Doctor's appt\" or \"Camping trip\"."),
      startsOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("The first day, YYYY-MM-DD. Use the family context block's date for relative days like 'Tuesday' or 'next week'."),
      endsOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("The last day, YYYY-MM-DD, for a multi-day event like a trip. Omit for a single-day event."),
      startTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional()
        .describe("24h HH:MM the event starts, e.g. '14:00' for 2pm. Omit for an all-day entry."),
      endTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional()
        .describe("24h HH:MM the event ends. Omit if unknown."),
      childId: z
        .uuid()
        .optional()
        .describe("The child this is for (id from the family context block). Omit for a whole-family event."),
      note: z
        .string()
        .max(500)
        .optional()
        .describe("Any extra detail the parent gave, in her own words."),
      recurrence: z
        .object({
          frequency: z.literal("weekly"),
          interval: z.number().int().min(1).max(52),
          weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        })
        .strict()
        .optional()
        .describe("Weekly series when the parent says this repeats. Weekdays use Sunday 0 through Saturday 6. Omit for a one-time event."),
    })
    .strict(),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { added: false, note: error.message };
      }
      throw error;
    }

    const receiptContext = voiceToolReceiptContext({
      familyId: access.familyId,
      attributes,
      runtimeSessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    });
    const parsed = parseFamilyEventInput(input);
    if (!parsed.ok) return { added: false, note: parsed.error };
    const eventId = randomUUID();
    const mutate = () => access.mode === "pinned"
      ? addFamilyEventPinned(access.familyId, { ...input, id: eventId })
      : addFamilyEventCaller(access.db, access.familyId, { ...input, id: eventId });
    const armed = receiptContext
      ? await armVoiceActionThenMutate({
          familyId: receiptContext.familyId,
          record: () => recordVoiceAction({
            ...receiptContext,
            objectKind: "family_event",
            objectId: eventId,
            effect: "family_event.added",
            namedEffect: `${parsed.value.title} on the family calendar`,
            undoCapability: "exact_delete",
            payload: {
              effect: "family_event.added",
              after: {
                childId: input.childId ?? null,
                title: parsed.value.title,
                startsOn: parsed.value.startsOn,
                endsOn: parsed.value.endsOn,
                startTime: parsed.value.startTime,
                endTime: parsed.value.endTime,
                note: parsed.value.note,
              },
            },
          }),
          mutate,
          replay: async (receipt) => {
            if (receipt.undoneAt) {
              return { added: false as const, note: "That Voice action already ran and was undone." };
            }
            const event = access.mode === "pinned"
              ? await getFamilyEventPinned(access.familyId, eventId)
              : await getFamilyEventCaller(access.db, access.familyId, eventId);
            return event
              ? {
                  added: true as const,
                  eventId: event.id,
                  title: event.title,
                  startsOn: event.startsOn,
                  endsOn: event.endsOn,
                  event,
                }
              : { added: false as const, note: "That Voice action already ran, but the event is no longer there." };
          },
          succeeded: (result) => result.added,
        })
      : { actionReceipt: null, result: await mutate(), replayed: false };
    const result = armed.result;
    if (!result.added) return result;

    return {
      ...result,
      done: true,
      ...(armed.actionReceipt ? { actionReceipt: armed.actionReceipt } : {}),
      note: "Added to the family calendar. Confirm it back to the parent in one short natural aside; the calendar page shows it right away.",
    };
  },
});
