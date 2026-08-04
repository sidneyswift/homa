import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import { emitMapEvent } from "../../lib/map/events";
import {
  completeGeneratedPlanActivity,
  completePlannerLearningActivity,
  getGeneratedPlanActivityCompletionTarget,
  getPlannerLearningActivityPinned,
  plannerHoursNote,
  plannerHoursSourceForChannel,
  plannerLearningIdempotencyKey,
  plannerLearningMutationUuid,
  verifyPlannerSourceQuote,
} from "../../lib/planner-learning-activities";
import { plannerLearningToolContext } from "../../lib/planner-learning-tool-context";
import { plannerEventClient } from "../../lib/planner-events";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

const common = {
  sourceQuote: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .describe("An exact verbatim span from the current parent message saying the work happened."),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(600)
    .optional()
    .describe("Actual minutes only when the parent supplied them. Never estimate."),
};

export const completePlannerActivityInputSchema = z
  .object({
    targetKind: z
      .enum(["logged_activity", "generated_plan_activity"])
      .describe("Which exact Planner storage shape open_planner returned."),
    activityId: z
      .string()
      .uuid()
      .optional()
      .describe("For logged_activity only: stable activity id from open_planner or record_planner_activity."),
    childId: z.string().uuid().optional().describe("For generated_plan_activity only: child id from open_planner."),
    subjectId: z.string().min(1).max(80).optional().describe("For generated_plan_activity only: subject id from open_planner."),
    week: z.number().int().min(1).max(4).optional().describe("For generated_plan_activity only: week number from open_planner."),
    activityIndex: z.number().int().min(0).max(999).optional().describe("For generated_plan_activity only: activity index from open_planner."),
    expectedText: z.string().min(1).max(4000).optional().describe("For generated_plan_activity only: exact activity text from open_planner."),
    planRevision: z.number().int().min(1).optional().describe("For generated_plan_activity only: exact planRevision from open_planner."),
    happenedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional()
      .describe("For generated_plan_activity only: date the work happened, YYYY-MM-DD."),
    hoursSubject: z
      .enum(HOURS_SUBJECTS)
      .optional()
      .describe("For generated plan work only: required with durationMinutes; omit when no time was supplied."),
    ...common,
  })
  .strict()
  .superRefine((input, context) => {
    const generatedKeys = [
      "childId",
      "subjectId",
      "week",
      "activityIndex",
      "expectedText",
      "planRevision",
      "happenedOn",
      "hoursSubject",
    ] as const;
    if (input.targetKind === "logged_activity") {
      if (input.activityId === undefined) {
        context.addIssue({
          code: "custom",
          path: ["activityId"],
          message: "activityId is required for logged_activity",
        });
      }
      for (const key of generatedKeys) {
        if (input[key] !== undefined) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is only valid for generated_plan_activity`,
          });
        }
      }
      return;
    }
    if (input.activityId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["activityId"],
        message: "activityId is only valid for logged_activity",
      });
    }
    for (const key of generatedKeys.slice(0, 7)) {
      if (input[key] === undefined) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required for generated_plan_activity`,
        });
      }
    }
    if ((input.durationMinutes === undefined) !== (input.hoursSubject === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["hoursSubject"],
        message: "durationMinutes and hoursSubject must be supplied together",
      });
    }
  });

type CompleteToolInput = z.infer<typeof completePlannerActivityInputSchema>;
type LoggedActivityInput = CompleteToolInput & {
  targetKind: "logged_activity";
  activityId: string;
};
type GeneratedPlanActivityInput = CompleteToolInput & {
  targetKind: "generated_plan_activity";
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  expectedText: string;
  planRevision: number;
  happenedOn: string;
};

function exactLoggedActivityInput(input: CompleteToolInput): LoggedActivityInput {
  if (input.targetKind !== "logged_activity" || !input.activityId) {
    throw new TypeError("Logged Planner activity identity is incomplete");
  }
  return input as LoggedActivityInput;
}

function exactGeneratedPlanActivityInput(
  input: CompleteToolInput,
): GeneratedPlanActivityInput {
  if (
    input.targetKind !== "generated_plan_activity"
    || !input.childId
    || !input.subjectId
    || input.week === undefined
    || input.activityIndex === undefined
    || !input.expectedText
    || input.planRevision === undefined
    || !input.happenedOn
  ) {
    throw new TypeError("Generated Planner activity identity is incomplete");
  }
  return input as GeneratedPlanActivityInput;
}

export default defineBoundedTool({
  description:
    "Load the planner skill before calling. Mark one exact Planner activity finished when the current parent message says it happened. Call open_planner first unless record_planner_activity just returned the stable id. For a logged activity, pass its id. For generated plan work, pass childId, subjectId, week, activityIndex, exact text, and planRevision from open_planner; stale or mismatched targets make no change. Optional real minutes also go to Hours. Never infer mastery or update ChildProgress.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: completePlannerActivityInputSchema,
  async execute(input, ctx) {
    try {
      const attributes = ctx.session.auth.current?.attributes;
      const access = await resolveAgentAccess(attributes);
      const trusted = plannerLearningToolContext(
        attributes,
      );
      if (!trusted) {
        return {
          completed: false,
          note: "Homa could not verify a current parent message, so nothing changed in Planner.",
        };
      }
      const sourceQuote = verifyPlannerSourceQuote({
        canonicalInboundText: trusted.canonicalInboundText,
        sourceQuote: input.sourceQuote,
      });
      if (input.targetKind === "logged_activity") {
        const loggedInput = exactLoggedActivityInput(input);
        const before = await getPlannerLearningActivityPinned({
          familyId: access.familyId,
          activityId: loggedInput.activityId,
        });
        if (!before) {
          return {
            completed: false,
            conflict: true,
            note: "That Planner activity is no longer there. Nothing changed.",
          };
        }
        const idempotencyKey = plannerLearningIdempotencyKey({
          action: "complete-independent",
          sourceMessageId: trusted.sourceMessageId,
          identity: [loggedInput.activityId, input.durationMinutes ?? null],
        });
        const hoursChildren = input.durationMinutes === undefined
          ? []
          : before.childIds.length === 0 ? [null] : before.childIds;
        const hoursEntryIds = hoursChildren.map((_, index) =>
          plannerLearningMutationUuid(idempotencyKey, `hours:${index}`));
        const receiptContext = voiceToolReceiptContext({
          familyId: access.familyId,
          attributes,
          runtimeSessionId: ctx.session.id,
          turnId: ctx.session.turn.id,
        });
        if (receiptContext && before.sourceMessageId === null) {
          return {
            completed: false,
            note: "Voice could not verify the original Planner record, so nothing changed. Open Planner and check it off there.",
          };
        }
        const mutate = () => completePlannerLearningActivity({
            familyId: access.familyId,
            activityId: loggedInput.activityId,
            expectedStatus: "planned",
            durationMinutes: input.durationMinutes ?? null,
            sourceChannel: trusted.sourceChannel,
            sourceQuote,
            sourceMessageId: trusted.sourceMessageId,
            idempotencyKey,
            hoursEntryIds,
          });
        const armed = receiptContext
          ? await armVoiceActionThenMutate({
              familyId: access.familyId,
              record: () => recordVoiceAction({
                ...receiptContext,
                objectKind: "plan_activity",
                objectId: loggedInput.activityId,
                effect: "planner_activity.completed",
                namedEffect: `marked ${before.title} finished in Planner`,
                undoCapability: "exact_restore",
                payload: {
                  effect: "planner_activity.completed",
                  beforeStatus: "planned",
                  after: {
                    title: before.title,
                    subject: before.subject,
                    activityDate: before.activityDate,
                    durationMinutes: input.durationMinutes ?? null,
                    note: before.note,
                    sourceChannel: before.sourceChannel,
                    sourceQuote: before.sourceQuote,
                    sourceMessageId: before.sourceMessageId!,
                    childIds: before.childIds,
                    completionSourceChannel: trusted.sourceChannel,
                    completionSourceQuote: sourceQuote,
                    completionSourceMessageId: trusted.sourceMessageId,
                    completionIdempotencyKey: idempotencyKey,
                    hours: hoursChildren.map((childId, index) => ({
                      id: hoursEntryIds[index],
                      childId,
                      subject: before.subject,
                      minutes: input.durationMinutes!,
                      happenedOn: before.activityDate,
                      source: plannerHoursSourceForChannel(trusted.sourceChannel),
                      note: plannerHoursNote(sourceQuote),
                    })),
                  },
                },
              }),
              mutate,
              replay: async (receipt) => {
                if (receipt.undoneAt) {
                  return {
                    status: "conflict" as const,
                    reason: "status-mismatch" as const,
                    note: "That Voice action already ran and was undone.",
                  };
                }
                const current = await getPlannerLearningActivityPinned({
                  familyId: access.familyId,
                  activityId: loggedInput.activityId,
                });
                return current?.status === "completed"
                  ? { status: "completed" as const, activity: current, changed: false }
                  : {
                      status: "conflict" as const,
                      reason: "status-mismatch" as const,
                      note: "That Planner activity is no longer finished.",
                    };
              },
              succeeded: (result) => result.status === "completed" && result.changed,
            })
          : { actionReceipt: null, result: await mutate(), replayed: false };
        const result = armed.result;
        if (result.status === "conflict") {
          return { completed: false, conflict: true, note: result.note };
        }
        if (result.changed) {
          const channel = (attributes ?? {}) as { channel?: string };
          await emitMapEvent("planner.learning_completed", {
            family_id: access.familyId,
            subject: result.activity.subject,
            target: "logged_activity",
            child_count: result.activity.childIds.length,
            has_duration: result.activity.durationMinutes !== null,
            surface: "chat",
            client: plannerEventClient(channel.channel),
          });
        }
        return {
          completed: true,
          done: true,
          changed: result.changed,
          activityId: result.activity.id,
          status: result.activity.status,
          durationMinutes: result.activity.durationMinutes,
          hoursEntryIds: result.activity.hoursEntryIds,
          ...(armed.actionReceipt && (result.changed || armed.replayed)
            ? { actionReceipt: armed.actionReceipt }
            : {}),
          note: result.changed
            ? "Marked finished in Planner. Confirm it in one short natural aside."
            : "That activity was already finished from this message; nothing changed twice.",
        };
      }

      const generatedInput = exactGeneratedPlanActivityInput(input);
      const target = await getGeneratedPlanActivityCompletionTarget({
        familyId: access.familyId,
        childId: generatedInput.childId,
        subjectId: generatedInput.subjectId,
        week: generatedInput.week,
        activityIndex: generatedInput.activityIndex,
        expectedText: generatedInput.expectedText,
        planRevision: generatedInput.planRevision,
      });
      if (target.status === "conflict") {
        return { completed: false, conflict: true, note: target.note };
      }
      const idempotencyKey = plannerLearningIdempotencyKey({
        action: "complete-generated",
        sourceMessageId: trusted.sourceMessageId,
        identity: [
          generatedInput.childId,
          generatedInput.subjectId,
          generatedInput.week,
          generatedInput.activityIndex,
          generatedInput.expectedText,
          generatedInput.planRevision,
          generatedInput.happenedOn,
          input.durationMinutes ?? null,
          input.hoursSubject ?? null,
        ],
      });
      const hoursEntryId = input.durationMinutes === undefined
        ? null
        : plannerLearningMutationUuid(idempotencyKey, "hours:0");
      const receiptContext = voiceToolReceiptContext({
        familyId: access.familyId,
        attributes,
        runtimeSessionId: ctx.session.id,
        turnId: ctx.session.turn.id,
      });
      const mutate = () => completeGeneratedPlanActivity({
          familyId: access.familyId,
          childId: generatedInput.childId,
          subjectId: generatedInput.subjectId,
          week: generatedInput.week,
          activityIndex: generatedInput.activityIndex,
          expectedText: generatedInput.expectedText,
          planRevision: generatedInput.planRevision,
          happenedOn: generatedInput.happenedOn,
          durationMinutes: input.durationMinutes ?? null,
          hoursSubject: input.hoursSubject ?? null,
          sourceChannel: trusted.sourceChannel,
          sourceQuote,
          hoursEntryId,
        });
      const armed = receiptContext
        ? await armVoiceActionThenMutate({
            familyId: access.familyId,
            record: () => recordVoiceAction({
              ...receiptContext,
              objectKind: "plan_activity",
              objectId: target.planId,
              effect: "plan_activity.completed",
              namedEffect: `marked ${generatedInput.expectedText} finished in Planner`,
              undoCapability: "exact_restore",
              payload: {
                effect: "plan_activity.completed",
                completion: {
                  childId: generatedInput.childId,
                  subjectId: generatedInput.subjectId,
                  week: generatedInput.week,
                  activityIndex: generatedInput.activityIndex,
                  expectedText: generatedInput.expectedText,
                  planRevision: generatedInput.planRevision,
                  progressKey: target.progressKey,
                  beforeProgressRevision: target.progressRevision,
                  beforeValue: target.previousValue,
                  afterProgressRevision: target.previousValue === true
                    ? target.progressRevision
                    : target.progressRevision + 1,
                  hours: hoursEntryId && input.durationMinutes !== undefined && input.hoursSubject
                    ? [{
                        id: hoursEntryId,
                        childId: generatedInput.childId,
                        subject: input.hoursSubject,
                        minutes: input.durationMinutes,
                        happenedOn: generatedInput.happenedOn,
                        source: plannerHoursSourceForChannel(trusted.sourceChannel),
                        note: plannerHoursNote(sourceQuote),
                      }]
                    : [],
                },
              },
            }),
            mutate,
            replay: async (receipt) => receipt.undoneAt
              ? {
                  status: "conflict" as const,
                  reason: "activity-mismatch" as const,
                  note: "That Voice action already ran and was undone.",
                }
              : {
                  status: "completed" as const,
                  planId: target.planId,
                  progressKey: target.progressKey,
                  progressRevision: target.previousValue === true
                    ? target.progressRevision
                    : target.progressRevision + 1,
                  changed: false,
                  hoursEntryIds: hoursEntryId ? [hoursEntryId] : [],
                },
            succeeded: (result) => result.status === "completed" && result.changed,
          })
        : { actionReceipt: null, result: await mutate(), replayed: false };
      const result = armed.result;
      if (result.status === "conflict") {
        return { completed: false, conflict: true, note: result.note };
      }
      if (result.changed) {
        const channel = (attributes ?? {}) as { channel?: string };
        await emitMapEvent("planner.learning_completed", {
          family_id: access.familyId,
          subject: generatedInput.subjectId,
          target: "generated_plan_activity",
          child_count: 1,
          has_duration: input.durationMinutes !== undefined,
          surface: "chat",
          client: plannerEventClient(channel.channel),
        });
      }
      return {
        completed: true,
        done: true,
        changed: result.changed,
        planId: result.planId,
        progressKey: result.progressKey,
        progressRevision: result.progressRevision,
        hoursEntryIds: result.hoursEntryIds,
        ...(armed.actionReceipt && (result.changed || armed.replayed)
          ? { actionReceipt: armed.actionReceipt }
          : {}),
        note: result.changed
          ? "Marked finished in Planner. Confirm it in one short natural aside."
          : "That generated-plan activity was already finished; nothing changed twice.",
      };
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { completed: false, note: error.message };
      }
      if (error instanceof TypeError) {
        return { completed: false, note: error.message };
      }
      throw error;
    }
  },
});
