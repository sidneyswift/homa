import { emitMapEvent } from "./map/events";
import { z } from "zod";
import type { AgentAccess } from "./agent-db";
import { hoursEditContextSchema } from "./hours-edit";
import { HOURS_SUBJECTS } from "./hours-model";
import { mapDb } from "./map/db";

export const hoursCorrectionSchema = z
  .object({
    entryId: z.uuid().describe("Exact Hours entry from a fresh read."),
    revision: z
      .string()
      .regex(/^[a-f0-9]{32}$/u)
      .describe("Current revision from inspect_hours_entry."),
    scope: z
      .enum(["child", "shared"])
      .describe(
        "child changes only the selected child; shared changes the linked activity's participants.",
      ),
    operation: z
      .enum(["update", "remove"])
      .describe(
        "Correct recorded time or remove only the selected time records.",
      ),
    subject: z
      .enum(HOURS_SUBJECTS)
      .nullable()
      .describe("Correct subject for update; null for remove."),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(600)
      .nullable()
      .describe(
        "Actual minutes supplied by the parent for update; null for remove.",
      ),
    category: z
      .string()
      .refine(value => Array.from(value).length <= 40, "Keep the category name to 40 characters or fewer.")
      .nullable()
      .describe("Category to keep or set; null clears it."),
    note: z
      .string()
      .refine(value => Array.from(value).length <= 200, "Keep the note to 200 characters or fewer.")
      .nullable()
      .describe("Parent's note to keep or set; null clears it."),
  })
  .refine(
    (value) =>
      value.operation === "remove" ||
      (value.subject !== null && value.minutes !== null),
    "An update needs subject and minutes.",
  );
export type HoursCorrection = z.infer<typeof hoursCorrectionSchema>;
export async function inspectHoursEntry(access: AgentAccess, entryId: string) {
  z.uuid().parse(entryId);
  let raw: unknown;
  if (access.mode === "caller") {
    const { data, error } = await access.db
      .rpc("get_hours_entry_edit_context", { target_entry_id: entryId })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error("Time record unavailable.");
    raw = data;
  } else
    raw = await mapDb().begin(async (tx) => {
      await tx`set local statement_timeout='15s'`;
      await tx`set local lock_timeout='3s'`;
      return (
        await tx`select public.lock_hours_entry_pinned(${access.familyId}::uuid,${entryId}::uuid) as result`
      )[0].result;
    });
  const context = hoursEditContextSchema.safeParse(raw);
  return context.success ? context.data : { result: "unavailable" as const };
}
export async function correctHoursEntry(
  access: AgentAccess,
  request: HoursCorrection,
) {
  const i = hoursCorrectionSchema.parse(request);
  let raw: unknown;
  if (access.mode === "caller") {
    const { data, error } = await access.db
      .rpc("correct_hours_entry", {
        f: access.familyId,
        eid: i.entryId,
        revision: i.revision,
        scope: i.scope,
        operation: i.operation,
        subject: i.subject,
        minutes: i.minutes,
        label: i.category,
        note: i.note,
      })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error("Correction could not be confirmed.");
    raw = data;
  } else
    raw = await mapDb().begin(async (tx) => {
      await tx`set local statement_timeout='15s'`;
      await tx`set local lock_timeout='3s'`;
      return (
        await tx`select public.correct_hours_entry_pinned(${access.familyId}::uuid,${i.entryId}::uuid,${i.revision},${i.scope},${i.operation},${i.subject},${i.minutes},${i.category},${i.note}) as result`
      )[0].result;
    });
  const receipt = z
    .object({
      result: z.enum(["applied", "not_found", "invalid", "conflict"]),
      entryId: z.uuid().optional(),
      affectedEntries: z.number().optional(),
      reason: z.string().optional(),
      note: z.string().optional(),
    })
    .parse(raw);
  if (receipt.result === "applied")
    await emitMapEvent("hours.corrected", {
      family_id: access.familyId,
      scope: i.scope,
      operation: i.operation,
      count: receipt.affectedEntries ?? 1,
    });
  return receipt;
}
