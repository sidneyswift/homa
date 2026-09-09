import { z } from "zod";
import { HOURS_SUBJECTS } from "./hours-model";
import type { HoursEntry } from "./hours-view";

export const hoursCategoryNameSchema = z.string().trim().max(80).refine(name => Array.from(name).length <= 40);

export const hoursCategorySchema = z.object({ id: z.uuid(), subject: z.enum(HOURS_SUBJECTS), name: hoursCategoryNameSchema.min(1) });
export type HoursCategory = z.infer<typeof hoursCategorySchema>;
export const saveHoursCategorySchema = z.object({
  subject: z.enum(HOURS_SUBJECTS), name: hoursCategoryNameSchema.min(1),
  categoryId: z.uuid().optional(), expectedName: z.string().optional(),
});
export type SaveHoursCategory = z.infer<typeof saveHoursCategorySchema>;

/** Same scope as the visible Hours record; no time-to-mastery mapping. */
export function categorySubtotals(entries: readonly HoursEntry[], categories: readonly HoursCategory[]) {
  const rows = categories.map(category => ({ ...category, minutes: 0 }));
  for (const entry of entries) {
    const existing = rows.find(row => row.subject === entry.subject && row.name === entry.customLabel);
    if (existing) existing.minutes += entry.minutes;
    else {
      const id = `${entry.subject}:${entry.customLabel ?? ""}`;
      const remainder = rows.find(row => row.id === id);
      if (remainder) remainder.minutes += entry.minutes;
      else rows.push({ id, subject: entry.subject, name: entry.customLabel ?? "", minutes: entry.minutes });
    }
  }
  return rows;
}
