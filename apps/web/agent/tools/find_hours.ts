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
  periodStart,
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
      "How far back to total. 'week' is this week starting Monday, 'school_year' starts August 1. Use 'all' when she asks about everything or names a range you cannot express here.",
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
        return { found: 0, note: error.message };
      }
      throw error;
    }

    let rows: HoursRow[];
    let timeZone: string;

    if (access.mode === "pinned") {
      const pinned = await readHoursPinned(access.familyId);
      rows = pinned.rows;
      timeZone = pinned.timeZone;
    } else {
      const { db, familyId } = access;
      const { data: family } = await db
        .from("families")
        .select("time_zone")
        .eq("id", familyId)
        .maybeSingle();
      timeZone = effectiveTimeZone(family?.time_zone);
      const { data, error } = await db
        .from("hours_log")
        .select("child_id, subject, minutes, happened_on, source, note")
        .eq("family_id", familyId)
        .order("happened_on", { ascending: false })
        .limit(3000);
      if (error) {
        console.error("find_hours read failed:", error.message);
        return {
          found: 0,
          note: "Could not read the hours record just now. Say so plainly rather than telling her nothing is logged.",
        };
      }
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
    const from = periodStart(input.period as HoursPeriod, today);
    const matching = filterHours(rows, {
      from,
      ...(input.childId === undefined ? {} : { childId: input.childId }),
      ...(input.subject === undefined ? {} : { subject: input.subject }),
    });
    const totals = summarizeHours(matching);

    return {
      found: totals.entryCount,
      period: input.period,
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
      note:
        totals.entryCount === 0
          ? "Nothing logged in that window. Say that plainly, and offer to log what she just described rather than implying she did no school."
          : "These are her real rows. Growth framing only: never call a total behind, and never compare one child to another.",
    };
  },
});
