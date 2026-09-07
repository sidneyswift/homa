import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { hasAcceptedLearningWriteOperation, learningOperationFailure, sourceActivityOrdinalSchema } from "../../lib/learning-write-operations";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import { emitMapEvent } from "../../lib/map/events";
import {
  findLoggedActivityCandidates,
  plannerHoursNote,
  plannerHoursSourceForChannel,
  plannerLearningIdempotencyKey,
  plannerLearningMutationUuid,
  recordPlannerLearningActivity,
  verifyPlannerSourceQuote,
} from "../../lib/planner-learning-activities";
import { findScheduledActivityCandidates } from "../../lib/plan-schedule";
import { plannerLearningToolContext } from "../../lib/planner-learning-tool-context";
import { plannerEventClient } from "../../lib/planner-events";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

const inputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .describe("Short faithful activity name, such as 'Horizons lesson 42'."),
    subject: z.enum(HOURS_SUBJECTS).describe(
      "The school subject. Gymnastics is PE and piano is music when the parent presents them as school learning.",
    ),
    activityDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .describe("The planned or completed calendar date, YYYY-MM-DD, resolved from the family context date."),
    status: z
      .enum(["planned", "completed"])
      .describe("planned for future/to-do work; completed only when the parent says it already happened."),
    childIds: z
      .array(z.string().uuid())
      .max(12)
      .describe("Explicitly choose every participating child id from family context on each call. Repeat the child's id for every separate activity they did. Use an empty array only for genuinely whole-family learning, never as a substitute for a named child."),
    durationMinutes: z
      .number()
      .int()
      .min(1)
      .max(600)
      .optional()
      .describe("Actual completed minutes only when the parent supplied them. Never estimate."),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe("Useful detail the parent supplied that does not belong in the short title."),
    sourceActivityOrdinal: sourceActivityOrdinalSchema,
    sourceQuote: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe("An exact verbatim span from the current parent message that supports this activity."),
    confirmNotDuplicate: z
      .boolean()
      .optional()
      .describe(
        "Leave unset on the first attempt. Set true only after a possibleDuplicate response showed you the existing candidate(s) and you confirmed this is genuinely separate work, not the same lesson.",
      ),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.status === "planned" && input.durationMinutes !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Planned work cannot carry actual completed time",
      });
    }
  });

export default defineBoundedTool({
  description:
    "Load the planner skill before calling. Record one independent learning activity in the family's Planner as planned or completed. Use the moment a parent says what schoolwork, enrichment, PE, music, co-op, or life skills they did, or asks Homa to put future work on a date. One call records one visible Planner row; call again for each distinct lesson in the same message. This is the log-first path when the activity is not already an exact generated-plan item. Optional real minutes also go to Hours. Never infer mastery or update ChildProgress. Requires an exact quote from the current parent message. When this child already has Planner work for the same subject and date, the call returns possibleDuplicate with the existing candidate(s) instead of writing a second row; check whether it is the same lesson (use complete_planner_activity or edit_plan on the existing item) before ever retrying with confirmNotDuplicate.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema,
  async execute(input, ctx) {
    try {
      const attributes = ctx.session.auth.current?.attributes;
      const access = await resolveAgentAccess(attributes);
      const trusted = plannerLearningToolContext(
        attributes,
      );
      if (!trusted) {
        return {
          recorded: false,
          note: "Homa could not verify a current parent message, so nothing was added to Planner.",
        };
      }
      const sourceQuote = verifyPlannerSourceQuote({
        canonicalInboundText: trusted.canonicalInboundText,
        sourceQuote: input.sourceQuote,
      });
      const childIds = [...new Set(input.childIds ?? [])].sort();
      const idempotencyKey = plannerLearningIdempotencyKey({
        action: "record",
        sourceMessageId: trusted.sourceMessageId,
        identity: [input.sourceActivityOrdinal],
      });
      const activityId = plannerLearningMutationUuid(idempotencyKey, "activity");
      if (childIds.length > 0 && !input.confirmNotDuplicate) {
        const [logged, scheduled] = await Promise.all([
          findLoggedActivityCandidates({
            familyId: access.familyId,
            childIds,
            subject: input.subject,
            activityDate: input.activityDate,
            excludeActivityId: activityId,
          }),
          findScheduledActivityCandidates({
            familyId: access.familyId,
            childIds,
            subjectId: input.subject,
            activityDate: input.activityDate,
          }),
        ]);
        if ((logged.length > 0 || scheduled.length > 0) && !await hasAcceptedLearningWriteOperation({
          familyId: access.familyId,
          key: idempotencyKey,
          sourceMessageId: trusted.sourceMessageId,
        })) {
          return {
            recorded: false,
            possibleDuplicate: true,
            candidates: [
              ...logged.map((candidate) => ({
                source: "already_logged" as const,
                title: candidate.title,
                status: candidate.status,
              })),
              ...scheduled.map((candidate) => ({
                source: "already_scheduled" as const,
                title: candidate.activityText,
                status: "planned" as const,
              })),
            ],
            note: "Homa already has Planner work for this child, this subject, on this date. If this is the same lesson, use complete_planner_activity (for an already-scheduled plan item) or leave the existing log entry alone; do not add a second row for it. If this is genuinely separate additional work, call record_planner_activity again with confirmNotDuplicate: true.",
          };
        }
      }
      const hoursChildren = input.durationMinutes === undefined
        ? []
        : childIds.length === 0 ? [null] : childIds;
      const hoursEntryIds = hoursChildren.map((_, index) =>
        plannerLearningMutationUuid(idempotencyKey, `hours:${index}`));
      const receiptContext = voiceToolReceiptContext({
        familyId: access.familyId,
        attributes,
        runtimeSessionId: ctx.session.id,
        turnId: ctx.session.turn.id,
      });
      const mutate = () => recordPlannerLearningActivity({
          familyId: access.familyId,
          title: input.title,
          subject: input.subject,
          activityDate: input.activityDate,
          status: input.status,
          durationMinutes: input.durationMinutes ?? null,
          note: input.note ?? null,
          childIds,
          sourceChannel: trusted.sourceChannel,
          sourceQuote,
          sourceMessageId: trusted.sourceMessageId,
          idempotencyKey,
          sourceActivityOrdinal: input.sourceActivityOrdinal,
          activityId,
          hoursEntryIds,
        });
      const armed = receiptContext
        ? await armVoiceActionThenMutate({
            familyId: access.familyId,
            record: () => recordVoiceAction({
              ...receiptContext,
              objectKind: "plan_activity",
              objectId: activityId,
              effect: "planner_activity.recorded",
              namedEffect: `recorded ${input.title.trim()} in Planner`,
              undoCapability: "exact_delete",
              payload: {
                effect: "planner_activity.recorded",
                after: {
                  title: input.title.trim(),
                  subject: input.subject,
                  activityDate: input.activityDate,
                  status: input.status,
                  durationMinutes: input.durationMinutes ?? null,
                  note: input.note?.trim() || null,
                  sourceChannel: trusted.sourceChannel,
                  sourceQuote,
                  sourceMessageId: trusted.sourceMessageId,
                  idempotencyKey,
                  childIds,
                  hours: hoursChildren.map((childId, index) => ({
                    id: hoursEntryIds[index],
                    childId,
                    subject: input.subject,
                    minutes: input.durationMinutes!,
                    happenedOn: input.activityDate,
                    source: plannerHoursSourceForChannel(trusted.sourceChannel),
                    note: plannerHoursNote(sourceQuote, input.title, input.note),
                  })),
                },
              },
            }),
            mutate,
            replay: async (receipt) => {
              if (receipt.undoneAt) {
                return {
                  status: "unknown_child" as const,
                  note: "That Voice action already ran and was undone.",
                };
              }
              return await mutate();
            },
            succeeded: (result) => result.status === "recorded" && result.created,
          })
        : { actionReceipt: null, result: await mutate(), replayed: false };
      const result = armed.result;
      if (result.status !== "recorded") {
        return { recorded: false, note: result.note };
      }
      if (result.created) {
        const channel = (attributes ?? {}) as { channel?: string };
        await emitMapEvent("planner.learning_recorded", {
          family_id: access.familyId,
          subject: result.activity.subject,
          status: result.activity.status,
          audience: result.activity.childIds.length === 0 ? "whole_family" : "children",
          child_count: result.activity.childIds.length,
          has_duration: result.activity.durationMinutes !== null,
          surface: "chat",
          client: plannerEventClient(channel.channel),
        });
      }
      return {
        recorded: true,
        done: true,
        created: result.created,
        activity: {
          id: result.activity.id,
          title: result.activity.title,
          subject: result.activity.subject,
          activityDate: result.activity.activityDate,
          status: result.activity.status,
          childIds: result.activity.childIds,
          durationMinutes: result.activity.durationMinutes,
          hoursEntryIds: result.activity.hoursEntryIds,
        },
        ...(armed.actionReceipt && (result.created || armed.replayed)
          ? { actionReceipt: armed.actionReceipt }
          : {}),
        note: result.created
          ? "It is in Planner. Confirm the activity, date, child, and whether it is planned or finished in one short aside."
          : "That exact activity is already in Planner from this message; nothing was added twice.",
      };
    } catch (error) {
      const failure = learningOperationFailure(error);
      if (failure) return { recorded: false, ...failure };
      if (error instanceof MissingFamilyContextError) {
        return { recorded: false, note: error.message };
      }
      if (error instanceof TypeError) {
        return { recorded: false, note: error.message };
      }
      throw error;
    }
  },
});
