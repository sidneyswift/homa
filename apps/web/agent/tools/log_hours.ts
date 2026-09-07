import { emitEvent } from "@homa/core";
import { z } from "zod";

import { defineBoundedTool, TOOL_DEADLINE } from "../../lib/agent-tool-deadline";
import { resolveAgentAccess } from "../../lib/agent-db";
import { recordHoursPinned } from "../../lib/agent-pinned";
import { hoursCaptureDisplayFields, hoursCaptureKey, hoursCaptureResultSchema } from "../../lib/hours-capture";
import { composeHoursNote, hoursWorkContextSchema } from "../../lib/hours-note-context";
import { verifyHoursNoteGrounding } from "../../lib/hours-note-grounding";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import { hasAcceptedLearningWriteOperation, learningMutationUuid, learningOperationFailure, sourceActivityOrdinalSchema } from "../../lib/learning-write-operations";
import { plannerHoursSourceForChannel, verifyPlannerSourceQuote } from "../../lib/planner-learning-activities";
import { plannerLearningToolContext } from "../../lib/planner-learning-tool-context";
import { effectiveTimeZone, zonedDateString } from "../../lib/time-zone";
import { modelUsageChannelFromAttributes } from "../../lib/model-usage";
import { armVoiceActionThenMutate, recordVoiceAction, voiceToolReceiptContext } from "../../lib/voice/action-receipts";

const logInput = z.object({
  sourceActivityOrdinal: sourceActivityOrdinalSchema,
  workContext: hoursWorkContextSchema.nullable().describe("Choose explicitly: provide the verified earlier parent source when this duration refers back to a book or named work, including an earlier message still visible in this conversation. Recall is needed for its canonical source ID even when you already know the title. Ask before writing if ambiguous. Use null only when no earlier named-work context is needed. A title placed only in note does not supply provenance. Current sourceQuote still comes from this message."),
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
    .describe("Faithful detail for the audit trail. An earlier book/work title belongs in verified workContext, not only in this free-text note. If the reference is ambiguous, ask before writing."),
  customLabel: z
    .string()
    .max(40)
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
      let sourceQuote: string;
      try {
        sourceQuote = verifyPlannerSourceQuote({ canonicalInboundText: trusted.canonicalInboundText, sourceQuote: input.sourceQuote });
      } catch {
        return { logged: false, reason: "invalid_source_quote",
          note: "Nothing was saved or attempted. sourceQuote must appear exactly in the authenticated current parent message. Do not combine earlier and current messages. For an earlier title, recall its parent source and provide workContext separately, keeping the current quote and the same activity ordinal." };
      }
      const note = input.workContext ? composeHoursNote({ title: input.workContext.workTitle, note: input.note, sourceQuote }).text : input.note?.trim() || null;
      const acceptedReplay=note&&trusted.canonicalInboundText!==note
        ? await hasAcceptedLearningWriteOperation({familyId:access.familyId,key:hoursCaptureKey(trusted.sourceMessageId,input.sourceActivityOrdinal),sourceMessageId:trusted.sourceMessageId}) : false;
      const noteGrounding=acceptedReplay?{supported:true}:await verifyHoursNoteGrounding({familyId:access.familyId,
        memberUserId:typeof attributes?.memberUserId==="string"?attributes.memberUserId:null,
        sourceMessageId:trusted.sourceMessageId,canonicalInboundText:trusted.canonicalInboundText,
        note,workContext:input.workContext,channel:modelUsageChannelFromAttributes(attributes)});
      if(!noteGrounding.supported)return {logged:false,reason:noteGrounding.reason,
        note:"Nothing was saved. The note needs its parent-message evidence. For an earlier book or work title, call recall and provide workContext with its exact parent source. If the reference is ambiguous, ask which work; do not omit the requested title or guess it."};
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
