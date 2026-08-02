import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  acceptedOfferDeliveryIdFromAttributes,
  completeAcceptedOfferFulfillment,
  reserveAcceptedOfferFulfillment,
} from "../../lib/conversation-continuity/offer-fulfillment";
import {
  createCustomTask,
  getTaskMutationSnapshot,
} from "../../lib/tasks/custom";
import { refuseScheduleSpawnedSession } from "../../lib/tasks/guard";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

/**
 * Parent-created scheduled tasks over chat (HT-6, M3-08 pulled forward).
 * The M3-08 safety law (lib/tasks/guard.ts) refuses sessions that a
 * schedule started, so no task can ever create tasks. familyId comes
 * from session auth only.
 */

export default defineBoundedTool({
  description:
    "Create a recurring scheduled task for this family: a reminder or a small job Homa runs on chosen days at a chosen hour, delivered by text, email, or just saved to the Homa's tasks page. Use when the parent asks for a reminder or recurring help ('remind me Tuesdays at 3 to prep co-op'). Confirm the days, hour, and delivery before calling.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: z.object({
    label: z
      .string()
      .min(3)
      .max(60)
      .describe("Short name the parent will recognize on her tasks page, e.g. 'Co-op prep reminder'."),
    prompt: z
      .string()
      .min(10)
      .max(1000)
      .describe(
        "What Homa should do each time, written for future-Homa: the reminder text to compose, or the small job to perform.",
      ),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .describe("Days it runs: 0 = Sunday .. 6 = Saturday."),
    localHour: z
      .number()
      .int()
      .min(0)
      .max(23)
      .describe("The hour in the family's own time zone (24h). Tasks run on the hour."),
    deliveryPref: z
      .enum(["text", "email", "none"])
      .describe("text = text her (email fallback); email = email only; none = just save the result to her tasks page."),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    const refusal = refuseScheduleSpawnedSession(attributes);
    if (refusal) return { created: false, note: refusal };

    let familyId: string;
    try {
      familyId = (await resolveAgentAccess(attributes)).familyId;
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { created: false, note: error.message };
      }
      throw error;
    }

    // The authenticated adult on this session (web JWT or an attributed
    // SMS number) becomes the task's one delivery recipient; an adult
    // without an account falls back to the account owner.
    const memberUserId = (attributes as { memberUserId?: unknown } | undefined)
      ?.memberUserId;
    const sourceOfferDeliveryId =
      acceptedOfferDeliveryIdFromAttributes(attributes);
    let taskId: string = randomUUID();
    let reservedSourceDeliveryId: string | null = null;
    if (sourceOfferDeliveryId) {
      try {
        const reservation = await reserveAcceptedOfferFulfillment({
          familyId,
          sourceDeliveryId: sourceOfferDeliveryId,
          kind: "task",
          referenceId: taskId,
        });
        if (reservation.referenceId) {
          taskId = reservation.referenceId;
          reservedSourceDeliveryId = sourceOfferDeliveryId;
        }
      } catch (error) {
        console.error(
          "create_task fulfillment reservation failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    const receiptContext = voiceToolReceiptContext({
      familyId,
      attributes,
      runtimeSessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    });
    const recipientMemberUserId =
      typeof memberUserId === "string" ? memberUserId : null;
    const mutate = () => createCustomTask(
      familyId,
      input,
      "homa",
      recipientMemberUserId,
      reservedSourceDeliveryId,
      taskId,
    );
    const armed = receiptContext
      ? await armVoiceActionThenMutate({
          familyId,
          record: () => recordVoiceAction({
            ...receiptContext,
            objectKind: "task",
            objectId: taskId,
            effect: "task.created",
            namedEffect: input.label,
            undoCapability: "exact_delete",
            payload: {
              effect: "task.created",
              after: {
                kind: "custom",
                label: input.label.trim(),
                prompt: input.prompt.trim(),
                localHour: input.localHour,
                weekdays: [...new Set(input.weekdays)].sort((left, right) => left - right),
                deliveryPref: input.deliveryPref,
                paused: false,
                pausedAt: null,
                enabled: true,
                nextRunAt: null,
                lastRunAt: null,
                createdBy: "homa",
                recipientMemberUserId,
                sourceOfferDeliveryId: reservedSourceDeliveryId,
                createdAt: null,
              },
            },
          }),
          mutate,
          replay: async (receipt) => {
            if (receipt.undoneAt) {
              return { ok: false as const, note: "That Voice action already ran and was undone." };
            }
            const task = await getTaskMutationSnapshot(familyId, taskId);
            return task
              ? { ok: true as const, id: taskId }
              : { ok: false as const, note: "That Voice action already ran, but the task is no longer there." };
          },
          succeeded: (result) => result.ok,
        })
      : { actionReceipt: null, result: await mutate(), replayed: false };
    const result = armed.result;
    if (!result.ok) return { created: false, note: result.note };
    try {
      if (reservedSourceDeliveryId) {
        await completeAcceptedOfferFulfillment({
          familyId,
          sourceDeliveryId: reservedSourceDeliveryId,
          kind: "task",
          referenceId: result.id,
        });
      }
    } catch (error) {
      console.error(
        "create_task fulfillment attribution failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return {
      created: true,
      taskId: result.id,
      ...(armed.actionReceipt ? { actionReceipt: armed.actionReceipt } : {}),
      note: "Task created; it shows on the Homa's tasks page and runs at the next scheduled hour. Confirm to the parent in one short natural aside.",
    };
  },
});
