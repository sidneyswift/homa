import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { readHoursPinned } from "../../lib/agent-pinned";
import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import {
  filterHours,
  hoursReadIsComplete,
  resolveHoursWindow,
  summarizeHours,
  type HoursPeriod,
  type HoursRow,
} from "../../lib/hours-summary";
import { effectiveTimeZone, zonedDateString } from "../../lib/time-zone";

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
 * Retrieval and arithmetic only: totals come from lib/hours-summary, so
 * a model never adds minutes in its head. The tool re-scopes to the
 * caller's family on both auth paths, exactly like log_hours.
 */

const findInput = z.object({
  period: z
    .enum(["week", "month", "school_year", "all"])
    .default("week")
    .describe(
      "How far back to total. 'week' is this week starting Monday, 'school_year' uses the family's saved start-date anniversary, or explicitly labeled all-time-through-today when unset. Use 'all' when she asks about everything or names a range you cannot express here.",
    ),
  childId: z
    .uuid()
    .optional()
    .describe("Only this child's hours (id from the family context block). Omit for the whole family."),
  subject: z
    .enum(HOURS_SUBJECTS)
    .optional()
    .describe("Only this subject. Omit for every subject."),
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
    "Read the family's logged school hours: running totals by child and subject, plus the most recent entries. Use whenever the parent asks what has been logged, where her hours went, how much time a child has done, or anything about her compliance record. Never say hours are missing or unlogged without calling this first.",
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

    let rows: HoursRow[];
    let timeZone: string;
    let schoolYearStartOn: string | null;
    let complete: boolean;

    if (access.mode === "pinned") {
      const pinned = await readHoursPinned(access.familyId);
      rows = pinned.rows;
      timeZone = pinned.timeZone;
      schoolYearStartOn = pinned.schoolYearStartOn;
      complete = pinned.complete;
    } else {
      const { db, familyId } = access;
      const { data: family, error: familyError } = await db
        .from("families")
        .select("time_zone, school_year_start_on")
        .eq("id", familyId)
        .maybeSingle();
      if (familyError || !family) return { found: null, complete: false, note: "Could not read the family settings. Do not report a total or claim nothing is logged." };
      timeZone = effectiveTimeZone(family.time_zone);
      schoolYearStartOn = family.school_year_start_on;
      const { data, error, count } = await db
        .from("hours_log")
        .select("child_id, subject, minutes, happened_on, source, note", { count: "exact" })
        .eq("family_id", familyId)
        .order("happened_on", { ascending: false })
        .limit(3000);
      if (error) {
        console.error("find_hours read failed:", error.message);
        return {
          found: null,
          complete: false,
          note: "Could not read the hours record just now. Say so plainly rather than telling her nothing is logged.",
        };
      }
      complete = hoursReadIsComplete(count, (data ?? []).length);
      rows = (data ?? []).map((row) => ({
        childId: (row.child_id as string | null) ?? null,
        subject: row.subject as string,
        minutes: row.minutes as number,
        happenedOn: row.happened_on as string,
        source: row.source as string,
        note: (row.note as string | null) ?? null,
      }));
    }

    const today = zonedDateString(new Date(), timeZone);
    const window = resolveHoursWindow(input.period as HoursPeriod, today, schoolYearStartOn);
    const from = window.from;
    const matching = filterHours(rows, {
      from,
      through: window.through,
      ...(input.childId === undefined ? {} : { childId: input.childId }),
      ...(input.subject === undefined ? {} : { subject: input.subject }),
    });
    if (!complete) return {
      found: null,
      complete: false,
      requestedPeriod: input.period,
      period: window.period,
      since: from,
      through: window.through,
      note: "Only part of the Hours record loaded. Do not report a total or claim no entries match; the full window has not been read.",
    };
    const totals = summarizeHours(matching);

    return {
      found: totals.entryCount,
      complete: true,
      requestedPeriod: input.period,
      period: window.period,
      periodLabel: window.label,
      through: window.through,
      schoolYearSettingHref: window.schoolYearFallback ? "/app/settings#school-year-start" : null,
      since: from,
      totalMinutes: totals.totalMinutes,
      byChild: totals.byChild,
      bySubject: totals.bySubject,
      firstDay: totals.firstDay,
      lastDay: totals.lastDay,
      entries: matching.slice(0, input.limit).map((row) => ({
        childId: row.childId,
        subject: row.subject,
        minutes: row.minutes,
        happenedOn: row.happenedOn,
        source: row.source,
        note: row.note,
      })),
      note: (window.schoolYearFallback ? "No valid school-year start is saved. These are all-time totals through today, not school-year totals. Offer the existing school-year setting. " : "") + (
        totals.entryCount === 0
          ? "Nothing logged in that window. Say that plainly, and offer to log what she just described rather than implying she did no school."
          : "These are her real rows. Growth framing only: never call a total behind, and never compare one child to another."),
    };
  },
});
