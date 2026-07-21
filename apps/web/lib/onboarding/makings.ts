/**
 * How much each family actually makes, per week.
 *
 * Counting only. There is no allowance here, because there is no
 * decision yet about whether there should be one, what it would be, or
 * whether a meter is the right idea at all. Inventing a number and
 * building a taper around it would dress a guess up as a plan and then
 * quietly make that guess the default.
 *
 * So this answers the question that has to come first: what do families
 * do when nothing is limiting them? Once that has a real shape, the
 * decisions in docs/homa-planning/plans/2026-07-21-onboarding-open-decisions.md
 * have something to be decided against.
 *
 * Artifacts are what gets counted: a worksheet, a coloring page, a
 * lesson's worksheet, a month plan. Conversation, planner edits,
 * progress, memories, journaling and logged hours are not counted here
 * and are not candidates for counting: that is the context engine and
 * every habit loop, and metering the evening debrief would meter the
 * exact behavior that makes the product worth paying for.
 */

import { mapDb } from "../map/db";

/**
 * The week, Monday to Monday. Monday because that is the homeschool
 * planning rhythm, so a week boundary there matches how these families
 * already think about their time.
 */
export function weekWindow(now: Date): { startsAt: Date; endsAt: Date } {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  // getUTCDay: 0 is Sunday, so Monday is 1 and Sunday rolls back six.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { startsAt: start, endsAt: end };
}

export function weeksSince(signupAt: Date, now: Date): number {
  const ms = now.getTime() - signupAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

/** Families whose numbers should not shape a decision about paying
 *  families: exempt, trialing, and test families. */
export type MakingsExclusion = "billing_exempt" | "trial_started" | "sandbox";

export interface MakingsReading {
  familyId: string;
  /** Non-null means this family should be read separately, or not at all. */
  excluded: MakingsExclusion | null;
  /** Artifacts made in this week. */
  made: number;
  /** Weeks since signup, so week one can be told from week six. */
  weekIndex: number;
  weekStartsAt: string;
  /** Titles, so a reading can name what was made rather than guess. */
  titles: string[];
}

interface MakingsFamilyRow {
  id: string;
  created_at: string;
  billing_exempt: boolean;
  sandbox: boolean;
  trial_started_at: string | null;
}

function exclusionFor(row: MakingsFamilyRow): MakingsExclusion | null {
  if (row.billing_exempt) return "billing_exempt";
  if (row.trial_started_at) return "trial_started";
  if (row.sandbox) return "sandbox";
  return null;
}

/**
 * readFamilyMakings(familyId, now): one family's week. Read-only.
 *
 * Superseded revisions are not counted: a parent who asked for one fix
 * made one worksheet, not two, and counting the revision would overstate
 * every number a decision later rests on.
 */
export async function readFamilyMakings(
  familyId: string,
  now: Date = new Date(),
): Promise<MakingsReading | null> {
  const sql = mapDb();
  const rows = await sql<MakingsFamilyRow[]>`
    select id, created_at::text as created_at, billing_exempt, sandbox,
           trial_started_at::text as trial_started_at
    from public.families
    where id = ${familyId}
  `;
  const family = rows[0];
  if (!family) return null;

  const { startsAt, endsAt } = weekWindow(now);
  const rowsMade = await sql<{ title: string | null }[]>`
    select title
    from public.materials
    where family_id = ${familyId}
      and status <> 'superseded'
      and created_at >= ${startsAt.toISOString()}
      and created_at < ${endsAt.toISOString()}
    order by created_at asc
  `;

  return {
    familyId,
    excluded: exclusionFor(family),
    made: rowsMade.length,
    weekIndex: weeksSince(new Date(family.created_at), now),
    weekStartsAt: startsAt.toISOString(),
    titles: rowsMade
      .map((row) => row.title)
      .filter((title): title is string => Boolean(title)),
  };
}

/**
 * readFleetMakings(now, limit): every family that made anything this
 * week, busiest first. The shape of this list is the input to any later
 * decision about limits, and right now it is the only honest thing to
 * look at.
 */
export async function readFleetMakings(
  now: Date = new Date(),
  limit = 50,
): Promise<MakingsReading[]> {
  const sql = mapDb();
  const { startsAt, endsAt } = weekWindow(now);
  const rows = await sql<
    (MakingsFamilyRow & { used: number; titles: string[] })[]
  >`
    select f.id, f.created_at::text as created_at, f.billing_exempt, f.sandbox,
           f.trial_started_at::text as trial_started_at,
           count(m.id)::int as used,
           coalesce(array_agg(m.title order by m.created_at) filter (where m.title is not null), '{}') as titles
    from public.families f
    join public.materials m on m.family_id = f.id
      and m.status <> 'superseded'
      and m.created_at >= ${startsAt.toISOString()}
      and m.created_at < ${endsAt.toISOString()}
    group by f.id
    order by used desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    familyId: row.id,
    excluded: exclusionFor(row),
    made: row.used,
    weekIndex: weeksSince(new Date(row.created_at), now),
    weekStartsAt: startsAt.toISOString(),
    titles: row.titles,
  }));
}
