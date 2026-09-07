import { emitEvent } from "@homa/core";
import { z } from "zod";
import { hoursCategoryNameSchema } from "../../lib/hours-categories";

import { defineBoundedTool, TOOL_DEADLINE } from "../../lib/agent-tool-deadline";
import { resolveAgentAccess } from "../../lib/agent-db";
import { recordHoursPinned } from "../../lib/agent-pinned";
import { hoursCaptureDisplayFields, hoursCaptureKey, hoursCaptureResultSchema } from "../../lib/hours-capture";
import { composeHoursNote, hoursWorkContextSchema } from "../../lib/hours-note-context";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import { learningMutationUuid, learningOperationFailure, sourceActivityOrdinalSchema } from "../../lib/learning-write-operations";
import { plannerHoursSourceForChannel, verifyPlannerSourceQuote } from "../../lib/planner-learning-activities";
import { plannerLearningToolContext } from "../../lib/planner-learning-tool-context";
import { effectiveTimeZone, zonedDateString } from "../../lib/time-zone";
import { armVoiceActionThenMutate, recordVoiceAction, voiceToolReceiptContext } from "../../lib/voice/action-receipts";

const logInput = z.object({
  sourceActivityOrdinal: sourceActivityOrdinalSchema,
  workContext: hoursWorkContextSchema.optional().describe("Separately verified earlier named work when the current duration refers back. Resolve it with recall, or ask if ambiguous. Current sourceQuote still comes from this message."),
  sourceQuote: z.string().trim().min(1).max(1000).describe("An exact span from the current parent message supporting this distinct activity."),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(600)
    .describe("The block's length in minutes. When the parent was vague, ask 'about how long?' BEFORE logging; never guess."),
  subject: z.enum(HOURS_SUBJECTS),
  childId: z
    .uuid()
    .optional()
    .describe("The child it was for (id from the family context block). Omit for family-wide time like co-op."),
  happenedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("The date it happened, YYYY-MM-DD. Omit for the canonical parent message date in the family time zone. Use the context block's date when the parent says 'yesterday' etc."),
  note: z
    .string()
    .max(200)
    .optional()
    .describe("The parent's own words for the audit trail, e.g. 'about 45 min of math after breakfast'."),
  customLabel: hoursCategoryNameSchema
    .optional()
    .describe(
      "Her own name for this block when the fixed subject list is too coarse to tell two blocks apart, e.g. subject 'reading' with customLabel 'Literature journal' alongside a separate independent-reading block. Only set this when the parent actually names the activity; never invent one.",
    ),
});

export default defineBoundedTool({
  description: "Load the planner skill before calling. Record one distinct block of school time with the current parent message's source ordinal and exact quote. Use an existing Planner activity's completion path when it owns this learning. Minutes must come from the parent. The result states whether a row was inserted, already exists, was removed, or could not be saved.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: logInput,
  async execute(input, ctx) {
    try {
      const attributes = ctx.session.auth.current?.attributes;
      const access = await resolveAgentAccess(attributes);
      const trusted = plannerLearningToolContext(attributes);
      if (!trusted) return { logged: false, note: "Homa could not verify a current parent message. Nothing was recorded." };
      const sourceQuote = verifyPlannerSourceQuote({ canonicalInboundText: trusted.canonicalInboundText, sourceQuote: input.sourceQuote });
      const receiptContext = voiceToolReceiptContext({ familyId: access.familyId, attributes,
        runtimeSessionId: ctx.session.id, turnId: ctx.session.turn.id });
      if (access.mode === "pinned") {
        if (receiptContext) return { logged: false, note: "This Voice session expired. Nothing changed. Start a fresh Voice session." };
        return await recordHoursPinned({ ...input, familyId: access.familyId, sourceMessageId: trusted.sourceMessageId,
          sourceQuote, source: plannerHoursSourceForChannel(trusted.sourceChannel),
          memberUserId: typeof attributes?.memberUserId === "string" ? attributes.memberUserId : null });
      }
      const { db, familyId } = access;
      const operationKey = hoursCaptureKey(trusted.sourceMessageId, input.sourceActivityOrdinal);
      const entryId = learningMutationUuid(operationKey, "hours");
      const customLabel = input.customLabel?.trim() || null;
      const note = input.workContext ? composeHoursNote({ title: input.workContext.workTitle, note: input.note, sourceQuote }).text : input.note?.trim() || null;
      // Voice needs an exact compensator before the write. The RPC verifies this
      // date against its atomic resolution; a concurrent zone change refuses.
      let expectedDate: string | null = null;
      if (receiptContext) {
        const { data: prior, error: priorError } = await db.from("learning_write_operations")
          .select("resolved_date").eq("family_id", familyId).eq("operation_key", operationKey).maybeSingle();
        if (priorError) throw new Error("Hours operation context unavailable");
        expectedDate = prior?.resolved_date ?? input.happenedOn ?? null;
        if (!expectedDate) {
          const [sourceRead, familyRead] = await Promise.all([
            db.from("conversation_messages").select("created_at").eq("family_id", familyId).eq("id", trusted.sourceMessageId).eq("role", "user").single(),
            db.from("families").select("time_zone").eq("id", familyId).single(),
          ]);
          if (sourceRead.error || familyRead.error) throw new Error("Hours source date unavailable");
          expectedDate = zonedDateString(new Date(sourceRead.data.created_at), effectiveTimeZone(familyRead.data.time_zone));
        }
      }
      const mutate = async () => {
        const { data, error } = await db.rpc("record_hours_operation_v2", {
          source_message: trusted.sourceMessageId, activity_ordinal: input.sourceActivityOrdinal, source_quote: sourceQuote,
          target_child: input.childId ?? null, target_subject: input.subject, target_minutes: input.minutes,
          requested_date: input.happenedOn ?? null, target_note: note, target_label: customLabel, expected_resolved_date: expectedDate, work_context: input.workContext ?? null,
        }).abortSignal(AbortSignal.timeout(15_000));
        if (error) throw new Error("Hours capture did not commit", { cause: error.code });
        return hoursCaptureResultSchema.parse(data);
      };
      const armed = receiptContext ? await armVoiceActionThenMutate({
        familyId,
        record: () => recordVoiceAction({ ...receiptContext, objectKind: "hours_entry", objectId: entryId,
          effect: "hours.logged", namedEffect: `the ${input.minutes}-minute ${input.subject} entry in Hours`, undoCapability: "exact_delete",
          payload: { effect: "hours.logged", after: { childId: input.childId ?? null, subject: input.subject, customLabel,
            minutes: input.minutes, happenedOn: expectedDate!, source: "chat", note } } }),
        mutate,
        replay: mutate,
        succeeded: (result) => result.inserted && result.logged,
      }) : { result: await mutate(), actionReceipt: null };
      const result = armed.result;
      const caller = attributes as { supabaseAccessToken?: string } | undefined;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (result.inserted && result.entry && url && key && caller?.supabaseAccessToken) {
        await emitEvent({ supabaseUrl: url, supabaseKey: key, accessToken: caller.supabaseAccessToken, familyId },
          "chat.hours_logged", { subject: result.entry.subject, minutes: result.entry.minutes, channel: "web" });
      }
      return { ...result, ...hoursCaptureDisplayFields(result),
        ...(armed.actionReceipt?.lifecycleStatus === "committed" ? { actionReceipt: armed.actionReceipt } : {}),
        note: result.logged ? (result.inserted ? "On the record." : "That activity is already recorded. These are its current details.")
          : "That entry was removed after it was recorded. Nothing was recreated." };
    } catch (error) {
      const failure = learningOperationFailure(error);
      if (failure) return { logged: false, ...failure };
      return { logged: false, note: "Homa could not save that time. No new entry was confirmed. Open Hours to check the record before trying again." };
    }
  },
});
