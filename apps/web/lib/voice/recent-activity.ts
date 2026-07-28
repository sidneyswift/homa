import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import { mapDb } from "../map/db";

/**
 * A bounded "what just happened" digest for the general phone line
 * (issue #176, CG-03, item 5). This is honest in exactly the way the
 * CG-01 phone-call amnesia finding demanded of the OTHER direction (a
 * call claiming durable writes it cannot make): here the call INGESTS
 * recent chat/SMS/web activity at call start (the same call-start
 * webhook that already renders family context, /api/voice/context),
 * it never claims live mid-call awareness of anything happening in
 * parallel. Bounded to the last 3 of each source within the last 72
 * hours, rendered as plain sentences the call assistant's own system
 * prompt can reference naturally ("I saw you finished the counting
 * worksheet earlier"), never as a mechanical "here is your digest".
 *
 * Reads run on the server connection with an explicit family_id
 * predicate (the same posture as lib/family-context.ts's
 * loadFamilyContextPinned, which this sits alongside). plan_activity_schedule
 * is a net-new table from this same change and may not exist yet on a
 * given target; that read fails closed to nothing rather than breaking
 * the call's context load.
 */

const LOOKBACK_HOURS = 72;
const MAX_PER_SOURCE = 3;

export interface RecentMaterialRow {
  title: string;
  childName: string | null;
  status: "draft" | "final" | "superseded";
  createdAt: string;
}

export interface RecentScheduleRow {
  childName: string;
  subjectId: string;
  scheduledDate: string;
}

export interface RecentHoursRow {
  childName: string | null;
  subject: string;
  minutes: number;
  happenedOn: string;
}

function subjectLabelFor(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "the month plan";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

/** "today", "yesterday", or a short day count; date-only comparison
 * against `today`, both already YYYY-MM-DD in the family's own zone. */
function relativeDay(dateOnly: string, today: string): string {
  if (dateOnly === today) return "today";
  const daysAgo = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dateOnly}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000),
  );
  if (daysAgo === 1) return "yesterday";
  if (daysAgo > 1) return `${daysAgo} days ago`;
  return "today";
}

/**
 * renderRecentActivityDigest(input): plain sentences, or "" when
 * nothing happened in the window. Pure, so it is unit-testable without
 * a database.
 */
export function renderRecentActivityDigest(input: {
  materials: readonly RecentMaterialRow[];
  scheduled: readonly RecentScheduleRow[];
  hours: readonly RecentHoursRow[];
  /** YYYY-MM-DD in the family's own zone, for "today"/"yesterday" wording. */
  today: string;
}): string {
  const lines: string[] = [];

  for (const material of input.materials) {
    const who = material.childName ? `${material.childName}'s` : "a";
    const verb = material.status === "final" ? "finished and kept" : "started";
    lines.push(
      `${verb === "started" ? "Started" : "Finished"} ${who} "${material.title}" ${relativeDay(material.createdAt.slice(0, 10), input.today)}.`,
    );
  }

  for (const entry of input.scheduled) {
    lines.push(
      `${entry.childName}'s ${subjectLabelFor(entry.subjectId)} activity was scheduled for ${entry.scheduledDate}.`,
    );
  }

  for (const entry of input.hours) {
    const who = entry.childName ?? "the family";
    lines.push(
      `${who === "the family" ? "The family" : who} logged ${entry.minutes} minutes of ${entry.subject} ${relativeDay(entry.happenedOn, input.today)}.`,
    );
  }

  if (lines.length === 0) return "";
  return ["Recent activity (last 72 hours, for natural reference only):", ...lines].join("\n");
}

interface RawMaterialRow {
  title: string;
  child_name: string | null;
  status: "draft" | "final" | "superseded";
  created_at: string;
}

interface RawScheduleRow {
  child_name: string;
  subject_id: string;
  scheduled_date: string;
}

interface RawHoursRow {
  child_name: string | null;
  subject: string;
  minutes: number;
  happened_on: string;
}

/**
 * loadRecentActivityDigest(familyId, today): the call-start webhook's
 * read. `today` is the family's own YYYY-MM-DD (effectiveTimeZone +
 * zonedDateString), computed by the caller so this module stays free of
 * a time-zone dependency. `sql` is an injection seam for the read-path
 * regression test (same convention as lib/map/store.ts).
 */
export async function loadRecentActivityDigest(
  familyId: string,
  today: string,
  sql: ReturnType<typeof mapDb> = mapDb(),
): Promise<string> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const [materials, hours, scheduled] = await Promise.all([
    sql<RawMaterialRow[]>`
      select m.title, c.name as child_name, m.status, m.created_at::text as created_at
      from public.materials m
      left join public.children c on c.id = m.child_id
      where m.family_id = ${familyId} and m.created_at >= ${since}
      order by m.created_at desc
      limit ${MAX_PER_SOURCE}
    `,
    sql<RawHoursRow[]>`
      select c.name as child_name, h.subject, h.minutes,
             to_char(h.happened_on, 'YYYY-MM-DD') as happened_on
      from public.hours_log h
      left join public.children c on c.id = h.child_id
      where h.family_id = ${familyId} and h.created_at >= ${since}
      order by h.created_at desc
      limit ${MAX_PER_SOURCE}
    `,
    // plan_activity_schedule is net-new (this same change) and may not
    // exist yet on a given target; fail closed to nothing, never break
    // the call's context load over an unmigrated table.
    sql<RawScheduleRow[]>`
      select c.name as child_name, s.subject_id,
             to_char(s.scheduled_date, 'YYYY-MM-DD') as scheduled_date
      from public.plan_activity_schedule s
      join public.children c on c.id = s.child_id
      where s.family_id = ${familyId} and s.updated_at >= ${since}
      order by s.updated_at desc
      limit ${MAX_PER_SOURCE}
    `.catch((error: unknown) => {
      console.error(
        "voice recent-activity: plan_activity_schedule read failed (migration may be unapplied):",
        error instanceof Error ? error.message : "unknown",
      );
      return [] as RawScheduleRow[];
    }),
  ]);

  return renderRecentActivityDigest({
    materials: materials.map((row) => ({
      title: row.title,
      childName: row.child_name,
      status: row.status,
      createdAt: row.created_at,
    })),
    scheduled: scheduled.map((row) => ({
      childName: row.child_name,
      subjectId: row.subject_id,
      scheduledDate: row.scheduled_date,
    })),
    hours: hours.map((row) => ({
      childName: row.child_name,
      subject: row.subject,
      minutes: row.minutes,
      happenedOn: row.happened_on,
    })),
    today,
  });
}
