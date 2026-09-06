import { z } from "zod";

import { HOURS_SUBJECTS } from "./hours-model";

/** Authenticated edit context owns audience and revision, never the view filter. */
export const hoursEditContextSchema = z.object({
  result: z.literal("ready"),
  revision: z.string().regex(/^[a-f0-9]{32}$/u),
  entry: z.object({
    id: z.string().uuid(), childId: z.string().uuid().nullable(), childName: z.string().nullable(),
    subject: z.enum(HOURS_SUBJECTS), customLabel: z.string().nullable(),
    minutes: z.number().int().min(1).max(600), happenedOn: z.string(),
    source: z.string(), note: z.string().nullable(),
  }),
  activity: z.object({
    id: z.string().uuid(), title: z.string(), note: z.string().nullable(),
    children: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    hoursEntryIds: z.array(z.string().uuid()),
  }).nullable(),
});

export type HoursEditContext = z.infer<typeof hoursEditContextSchema>;

export function hoursNoteCharacterCount(note: string): number {
  return Array.from(note.trim()).length;
}

export function recordedTimeAudience(context: HoursEditContext): string {
  if (!context.activity) return context.entry.childName ?? "the whole family";
  const names = context.activity.children.map((child) => child.name);
  return names.length > 0
    ? new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(names)
    : "the whole family";
}

export function hoursMutationError(receipt: unknown): string | null {
  const parsed = z.object({ result: z.string(), reason: z.string().optional() }).safeParse(receipt);
  if (!parsed.success) return "The change couldn't be confirmed. Reopen the record to check before trying again.";
  const { result, reason } = parsed.data;
  if (result === "applied") return null;
  if (result === "not_found") return "That entry couldn't be found. Close it and refresh the page.";
  if (result === "invalid") return "Check the subject, minutes and note, then try again.";
  if (reason === "duplicate") return "That change would match another time entry on this day. Nothing changed.";
  if (reason === "link-shape") return "This change can't be saved safely because the shared time records don't match. Nothing changed. Close this editor and refresh the page. If it still happens, contact support.";
  return "This record changed while it was open. Close it and reopen to review the latest version.";
}
