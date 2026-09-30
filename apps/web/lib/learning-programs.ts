import { z } from "zod";
import { HOURS_SUBJECTS } from "./hours-model";

export const programDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Use a real calendar date.")
  .describe("Calendar date, YYYY-MM-DD.");
const clockSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);
export const programClassSchema = z.object({
  id: z
    .uuid()
    .describe("Stable class id; keep it when editing the same class."),
  title: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe("Class name from the parent or schedule."),
  subject: z
    .enum(HOURS_SUBJECTS)
    .describe("What is learned, independent of the program."),
  childIds: z
    .array(z.uuid())
    .min(1)
    .max(12)
    .describe("Explicit participants from this family's roster."),
  weekday: z
    .number()
    .int()
    .min(0)
    .max(6)
    .describe("Sunday is 0, Saturday is 6."),
  startTime: clockSchema
    .nullable()
    .describe("Local start time if shown; otherwise null."),
  endTime: clockSchema
    .nullable()
    .describe("Local end time if shown; otherwise null."),
  plannedMinutes: z
    .number()
    .int()
    .min(1)
    .max(600)
    .nullable()
    .describe(
      "Scheduled duration, never automatically credited as completed time.",
    ),
  category: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .nullable()
    .describe("Optional category beneath the subject."),
});
export type ProgramClass = z.infer<typeof programClassSchema>;
export function classMinutes(row: ProgramClass): number | null {
  if (row.startTime === null && row.endTime === null) return row.plannedMinutes;
  if (!row.startTime || !row.endTime)
    throw new Error("Supply both start and end times.");
  const minutes = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const duration = minutes(row.endTime) - minutes(row.startTime);
  if (duration < 1 || duration > 600)
    throw new Error("A class must end after it starts, within ten hours.");
  if (row.plannedMinutes !== null && row.plannedMinutes !== duration)
    throw new Error("The duration does not match the class times.");
  return duration;
}
export const programDraftSchema = z
  .object({
    id: z.uuid().describe("Stable program id; retain on retries and edits."),
    expectedRevision: z
      .number()
      .int()
      .min(1)
      .nullable()
      .describe("Current saved revision; null for a new program."),
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe("Parent's program name, such as Monday co-op."),
    classes: z
      .array(programClassSchema)
      .min(1)
      .max(64)
      .describe("Reviewed recurring classes with explicit participants."),
  })
  .superRefine((draft, ctx) => {
    const ids = new Set<string>();
    draft.classes.forEach((row, index) => {
      if (ids.has(row.id))
        ctx.addIssue({
          code: "custom",
          path: ["classes", index],
          message: "Each class needs its own identity.",
        });
      ids.add(row.id);
      if (new Set(row.childIds).size !== row.childIds.length)
        ctx.addIssue({
          code: "custom",
          path: ["classes", index],
          message: "List each child once.",
        });
      try {
        classMinutes(row);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["classes", index],
          message: String(error),
        });
      }
    });
    for (let i = 0; i < draft.classes.length; i++)
      for (let j = i + 1; j < draft.classes.length; j++) {
        const a = draft.classes[i],
          b = draft.classes[j];
        if (
          a.weekday === b.weekday &&
          a.startTime &&
          a.endTime &&
          b.startTime &&
          b.endTime &&
          a.startTime < b.endTime &&
          b.startTime < a.endTime &&
          a.childIds.some((id) => b.childIds.includes(id))
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["classes", j],
            message: "A child has overlapping classes. Review their schedule.",
          });
        }
      }
  });
export type ProgramDraft = z.infer<typeof programDraftSchema>;
export const programScheduleSchema = z
  .object({
    programId: z.uuid().describe("Owned program id from the saved catalog."),
    expectedRevision: z
      .number()
      .int()
      .min(1)
      .describe("Revision of the reviewed schedule."),
    from: programDateSchema,
    through: programDateSchema,
    excludedDates: z
      .array(programDateSchema)
      .max(90)
      .describe("Holidays or dates the parent explicitly excluded."),
  })
  .refine(
    (value) =>
      value.through >= value.from &&
      (Date.parse(value.through) - Date.parse(value.from)) / 86400000 < 90,
    "Schedule between one and ninety days at a time.",
  );
export type ProgramSchedule = z.infer<typeof programScheduleSchema>;
export interface LearningProgram {
  id: string;
  name: string;
  revision: number;
  classes: ProgramClass[];
}
export interface ProgramOccurrence {
  programId: string;
  programName: string;
  classId: string;
  childId: string;
  activityId: string | null;
  date: string;
  title: string | null;
  subject: string | null;
  status: string;
  minutes: number | null;
  plannedMinutes: number | null;
  revision: string | null;
}
export interface ProgramCatalog {
  programs: LearningProgram[];
  occurrences: ProgramOccurrence[];
}
