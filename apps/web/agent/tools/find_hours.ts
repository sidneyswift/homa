import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { readHoursCategorySummary } from "../../lib/hours-category-summary";
import { SUBJECT_LABELS } from "../../lib/hours-view";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import {
  HoursSummaryReadError,
} from "../../lib/hours-summary-reader";

/**
 * Reading the family's school-hours record (gh#354).
 *
 * Homa could WRITE hours from every channel and read them from none. On
 * 2026-07-25 a parent asked where the hours from her phone call had
 * landed and was told "nothing from the NYC trip has been logged yet",
 * three hours after that call logged 4.5 hours of it. The rows were
 * there. Asserting absence over a table you cannot read is worse than
 * saying you do not know, because the parent believes it.
 *
 * Retrieval and arithmetic only: totals come from one database snapshot, so
 * a model never adds minutes in its head. The tool re-scopes to the
 * caller's family on both auth paths, exactly like log_hours.
 */

const findInput = z.object({
  period: z
    .enum(["week", "month", "school_year", "all"])
    .default("week")
    .describe(
      "How far back to total. 'week' starts Monday; 'school_year' uses the saved start-date anniversary, or labeled all-time-through-today when unset. Use 'all' for everything, or from/through for an explicit date range.",
    ),
  childId: z
    .uuid()
    .nullish().transform(value => value ?? undefined)
    .describe("This child's own hours plus shared whole-family time by default. Use an id from the family context block. Omit for the whole family."),
  includeShared: z.boolean().default(true).describe("Include shared whole-family entries in each selected child's record. Selecting one child still includes their shared time. Set false only for an explicit request to exclude shared whole-family entries."),
  from: z.string().nullish().transform(value => value ?? undefined).describe("Inclusive YYYY-MM-DD start for an explicit requested range, overriding the period's start. Omit to use the chosen period."),
  through: z.string().nullish().transform(value => value ?? undefined).describe("Inclusive YYYY-MM-DD end for an explicit requested range. Omit for family-local today."),
  subject: z
    .enum(HOURS_SUBJECTS)
    .nullish().transform(value => value ?? undefined)
    .describe("Only this subject. Omit for every subject."),
  categoryId: z.uuid().nullish().transform(value => value ?? undefined).describe("Only this saved category. Use an id from manage_hours_categories or a previous Hours receipt; never invent one."),
  uncategorizedOnly: z.boolean().default(false).describe("Read only entries without a category. Cannot combine with categoryId."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("How many individual entries to return alongside the totals, newest first."),
});

export default defineBoundedTool({
  description:
    "Load the hours-records skill before calling. Read the family's logged school hours: running totals by child and subject, plus the most recent entries. Use whenever the parent asks what has been logged, where her hours went, how much time a child has done, or anything about her compliance record. Never say hours are missing or unlogged without calling this first.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: findInput,
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { found: null, complete: false, note: error.message };
      }
      throw error;
    }

    let record;
    try {
      const now = new Date();
      record = await readHoursCategorySummary(access, input, now);
    } catch (error) {
      return {
        found: null,
        complete: false,
        note: error instanceof HoursSummaryReadError && error.reason === "invalid"
          ? "The requested child, date range, or category filter is invalid. Use an owned child, valid inclusive calendar dates, and a saved category matching the subject only when that filter was requested. Otherwise omit categoryId. Do not report a total."
          : "Could not read the complete Hours record just now. Do not report a total or claim no entries match.",
      };
    }
    const periodLabels = { week: "This week", month: "This month", school_year: "School year", all: "All time", custom: "Selected dates" } as const;
    return {
      found: record.entryCount,
      complete: true,
      requestedPeriod: input.period,
      period: record.window.period,
      periodLabel: periodLabels[record.window.period],
      since: record.window.from,
      through: record.window.through,
      schoolYearSettingHref: record.window.schoolYearFallback ? "/app/settings#school-year-start" : null,
      includeShared: input.includeShared,
      totalMinutes: record.totalMinutes,
      byChild: record.recordedDaysByChild.map(({ childId, minutes }) => ({ childId, minutes })),
      byEntryScope: record.byEntryScope,
      bySubject: record.bySubject.map(row => ({ ...row, label: SUBJECT_LABELS[row.subject] })),
      byCategory: record.byCategory.map(row => ({ ...row, subjectLabel: SUBJECT_LABELS[row.subject] })),
      recordedDays: record.recordedDays,
      recordedDaysByChild: record.recordedDaysByChild,
      firstDay: record.firstDay,
      lastDay: record.lastDay,
      entries: record.entries,
      note: "Recorded learning days mean dates with timed entries, not an attendance or absence judgment. byChild gives each child's total including shared time when requested. byEntryScope is raw entry attribution, with null for whole-family entries. Shared rows count once in totalMinutes and toward each child's record when included; do not add the child totals to calculate family time. " + (record.window.schoolYearFallback ? "No valid school-year start is saved. These are all-time totals through today, not school-year totals. Offer the existing school-year setting. " : "") + (
        record.entryCount === 0
          ? "Nothing logged in that window. Say that plainly, and offer to log what she just described rather than implying she did no school."
          : "These are her real rows. Growth framing only: never call a total behind, and never compare one child to another."),
    };
  },
});
