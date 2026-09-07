import { z } from "zod";
import { hoursCategoryNameSchema } from "./hours-categories";

import { composeHoursNote, hoursWorkContextSchema } from "./hours-note-context";
import { HOURS_SOURCES, HOURS_SUBJECTS } from "./hours-model";
import { sourceActivityOrdinalSchema } from "./learning-write-operations";
import { mapDb } from "./map/db";

export const hoursCaptureInputSchema = z.object({
  familyId: z.uuid().transform((id) => id.toLowerCase()),
  memberUserId: z.uuid().transform((id) => id.toLowerCase()).nullish(),
  workContext: hoursWorkContextSchema.nullish(),
  sourceMessageId: z.uuid().transform((id) => id.toLowerCase()),
  sourceActivityOrdinal: sourceActivityOrdinalSchema,
  sourceQuote: z.string().trim().min(1).max(1000),
  childId: z.uuid().transform((id) => id.toLowerCase()).nullish(),
  subject: z.enum(HOURS_SUBJECTS),
  minutes: z.number().int().min(1).max(600),
  happenedOn: z.iso.date().nullish(),
  note: z.string().trim().max(200).nullish(),
  customLabel: hoursCategoryNameSchema.nullish(),
  source: z.enum(HOURS_SOURCES),
});
export type HoursCaptureInput = z.input<typeof hoursCaptureInputSchema>;
export const hoursCaptureResultSchema = z.object({
  logged: z.boolean(), inserted: z.boolean(), status: z.enum(["recorded", "removed"]), resolvedDate: z.iso.date(),
  entry: z.object({ id: z.uuid(), childId: z.uuid().nullable(), subject: z.enum(HOURS_SUBJECTS),
    minutes: z.number().int().min(1).max(600), happenedOn: z.iso.date(), source: z.enum(HOURS_SOURCES),
    note: z.string().nullable(), customLabel: z.string().nullable() }).nullable(),
}).superRefine((value, context) => {
  if (value.logged !== (value.entry !== null) || value.logged !== (value.status === "recorded") || (!value.logged && value.inserted)) {
    context.addIssue({ code: "custom", message: "Invalid Hours capture receipt" });
  }
});
export type HoursCaptureResult = z.infer<typeof hoursCaptureResultSchema>;

/** Existing web/native receipt fields reflect the current saved row, including edited replays. */
export function hoursCaptureDisplayFields(result: HoursCaptureResult) {
  return { done: result.logged, entryId: result.entry?.id,
    subject: result.entry?.subject, minutes: result.entry?.minutes };
}

export function hoursCaptureKey(sourceMessageId: string, sourceActivityOrdinal: number): string {
  return `log-hours:${z.uuid().parse(sourceMessageId).toLowerCase()}:${sourceActivityOrdinalSchema.parse(sourceActivityOrdinal)}`;
}

export async function captureHoursPinned(raw: HoursCaptureInput): Promise<HoursCaptureResult> {
  const input = hoursCaptureInputSchema.parse(raw);
  const note = input.workContext ? composeHoursNote({ title: input.workContext.workTitle, note: input.note, sourceQuote: input.sourceQuote }).text : input.note || null;
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    await tx`set local statement_timeout = '15s'`;
    await tx`set local lock_timeout = '5s'`;
    const [row] = await tx<{ receipt: unknown }[]>`
      select public.record_hours_operation_pinned_v2(${input.familyId}::uuid, ${input.sourceMessageId}::uuid,
        ${input.sourceActivityOrdinal}, ${input.sourceQuote}, ${input.childId ?? null}::uuid,
        ${input.subject}, ${input.minutes}, ${input.happenedOn ?? null}::date, ${note},
        ${input.customLabel || null}, ${input.source}, ${input.memberUserId ?? null}::uuid,
        ${input.workContext ? tx.json(input.workContext) : null}::jsonb) as receipt
    `;
    return hoursCaptureResultSchema.parse(row?.receipt);
  }) as HoursCaptureResult;
}
