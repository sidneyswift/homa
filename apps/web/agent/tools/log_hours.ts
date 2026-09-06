import { randomUUID } from "node:crypto";

import { emitEvent } from "@homa/core";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { recordHoursPinned } from "../../lib/agent-pinned";
import { HOURS_SUBJECTS, type HoursSubject } from "../../lib/hours-model";
import { effectiveTimeZone, zonedDateString } from "../../lib/time-zone";
import {
  armVoiceActionThenMutate,
  recordVoiceAction,
  voiceToolReceiptContext,
} from "../../lib/voice/action-receipts";

/**
 * Capture-time school hours (M3-05 slice; lab evidence in build-log
 * 2026-07-09 midday: hours structured at the moment they are mentioned
 * survive to the compliance report; hours left in prose do not). The
 * model supplies the block; the family comes from session auth; the
 * child id only works inside the caller's own RLS view, and the insert
 * policy re-checks child coherence at the database.
 */

const logInput = z.object({
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
    .describe("The date it happened, YYYY-MM-DD. Omit for today. Use the context block's date when the parent says 'yesterday' etc."),
  note: z
    .string()
    .max(200)
    .optional()
    .describe("The parent's own words for the audit trail, e.g. 'about 45 min of math after breakfast'."),
  customLabel: z
    .string()
    .max(40)
    .optional()
    .describe(
      "Her own name for this block when the fixed subject list is too coarse to tell two blocks apart, e.g. subject 'reading' with customLabel 'Literature journal' alongside a separate independent-reading block. Only set this when the parent actually names the activity; never invent one.",
    ),
});

export default defineBoundedTool({
  description:
    "Log a block of school time to the family's hours record the moment the parent mentions one ('we did 45 minutes of math'). These rows are the family's compliance evidence, so log every real mention exactly once. School time only: movies, errands, and waiting rooms never count. When the duration is vague ('most of the morning'), ask one short 'about how long?' first.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: false,
  inputSchema: logInput,
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { logged: false, note: error.message };
      }
      throw error;
    }

    const receiptContext = voiceToolReceiptContext({
      familyId: access.familyId,
      attributes: ctx.session.auth.current?.attributes,
      runtimeSessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    });

    if (access.mode === "pinned") {
      if (receiptContext) {
        return {
          logged: false,
          note: "Homa could not guarantee an atomic Voice receipt on this expired session. Nothing changed. Start a fresh Voice session and try once more.",
        };
      }
      const pinnedChannel = (ctx.session.auth.current?.attributes as { channel?: string })
        ?.channel;
      const result = await recordHoursPinned({
        familyId: access.familyId,
        minutes: input.minutes,
        subject: input.subject,
        // A web session that fell back to pinned (expired browser token)
        // still logs as chat, the same label its caller path writes.
        source:
          pinnedChannel === "email" || pinnedChannel === "dispatch"
            ? pinnedChannel
            : pinnedChannel === "web"
              ? "chat"
              : "sms",
        childId: input.childId ?? null,
        happenedOn: input.happenedOn ?? null,
        note: input.note ?? null,
        customLabel: input.customLabel ?? null,
      });
      if (!result.logged) return result;
      return {
            ...result,
            done: true,
            subject: input.subject,
            minutes: input.minutes,
            note: "On the record. Mention it in one short natural aside; the running week total is there if it fits naturally.",
          };
    }

    const { db, familyId } = access;

    let happenedOn = input.happenedOn ?? null;
    if (!happenedOn) {
      const { data: family } = await db
        .from("families")
        .select("time_zone")
        .eq("id", familyId)
        .maybeSingle();
      happenedOn = zonedDateString(new Date(), effectiveTimeZone(family?.time_zone));
    }

    const customLabel = input.customLabel?.trim() || null;

    // Double-log guard: the same block mentioned twice in one chat must
    // not become two compliance rows. A distinct customLabel (her own
    // name for the block) makes two same-subject/duration/day blocks
    // distinguishable, so it is part of the match key too.
    const { data: existing } = await db
      .from("hours_log")
      .select("id")
      .eq("family_id", familyId)
      .eq("subject", input.subject)
      .eq("minutes", input.minutes)
      .eq("happened_on", happenedOn)
      .filter("child_id", input.childId ? "eq" : "is", input.childId ?? null)
      .filter("custom_label", customLabel ? "eq" : "is", customLabel)
      .limit(1);
    if (existing && existing.length > 0) {
      return {
        logged: true,
        done: true,
        note: "That block is already on the record for that day; nothing added twice.",
      };
    }

    const entryId = randomUUID();
    const mutate = async () => await db
      .from("hours_log")
      .insert({
        id: entryId,
        family_id: familyId,
        child_id: input.childId ?? null,
        subject: input.subject,
        minutes: input.minutes,
        happened_on: happenedOn,
        source: "chat",
        note: input.note ?? null,
        custom_label: customLabel,
      })
      .select("id")
      .single();
    const armed = receiptContext
      ? await armVoiceActionThenMutate({
          familyId: receiptContext.familyId,
          record: () => recordVoiceAction({
            ...receiptContext,
            objectKind: "hours_entry",
            objectId: entryId,
            effect: "hours.logged",
            namedEffect: `the ${input.minutes}-minute ${input.subject} entry in Hours`,
            undoCapability: "exact_delete",
            payload: {
              effect: "hours.logged",
              after: {
                childId: input.childId ?? null,
                subject: input.subject,
                customLabel,
                minutes: input.minutes,
                happenedOn,
                source: "chat",
                note: input.note ?? null,
              },
            },
          }),
          mutate,
          replay: async () => await db
            .from("hours_log")
            .select("id")
            .eq("id", entryId)
            .eq("family_id", familyId)
            .single(),
          succeeded: (result) => !result.error && Boolean(result.data?.id),
        })
      : { actionReceipt: null, result: await mutate(), replayed: false };
    const { error: insertError } = armed.result;
    if (insertError) {
      // 23505 from hours_log_block_unique_idx: a concurrent identical
      // call won the insert after this one's guard SELECT ran; losing
      // that race is the same outcome as the guard above.
      if (insertError.code === "23505") {
        return {
          logged: true,
          done: true,
          note: "That block is already on the record for that day; nothing added twice.",
        };
      }
      return { logged: false, note: `Could not log it: ${insertError.message}` };
    }

    const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data: weekRows } = await db
      .from("hours_log")
      .select("minutes")
      .eq("family_id", familyId)
      .eq("subject", input.subject)
      .gte("happened_on", weekAgo);
    const weekMinutes = (weekRows ?? []).reduce((total, row) => total + row.minutes, 0);

    const attributes = ctx.session.auth.current?.attributes as
      | { supabaseAccessToken?: string; familyId?: string; channel?: string }
      | undefined;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key && attributes?.supabaseAccessToken && attributes.familyId) {
      await emitEvent(
        {
          supabaseUrl: url,
          supabaseKey: key,
          accessToken: attributes.supabaseAccessToken,
          familyId: attributes.familyId,
        },
        "chat.hours_logged",
        {
          subject: input.subject as HoursSubject,
          minutes: input.minutes,
          channel: attributes.channel === "sms" ? "sms" : "web",
        },
      );
    }

    return {
      logged: true,
      done: true,
      subject: input.subject,
      minutes: input.minutes,
      weekMinutesForSubject: weekMinutes,
      ...(armed.actionReceipt ? { actionReceipt: armed.actionReceipt } : {}),
      note: "On the record. Mention it in one short natural aside; the running week total is there if it fits naturally.",
    };
  },
});
