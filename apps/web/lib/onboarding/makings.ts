/**
 * The makings meter, shadow only
 * (plans/2026-07-21-chat-first-onboarding.md §7.1, §7.2, §7.4).
 *
 * NOTHING here enforces anything. No tool calls it, no surface shows it
 * to a parent, and no code path refuses an action because of it. It
 * exists to answer one question with data before anyone decides
 * anything: if the meter were on, when would each family actually hit
 * it?
 *
 * That restraint is deliberate. Turning the meter on supersedes four
 * recorded decisions (paywall-door-placement, report-lock-four-open, D2
 * on internal-only metering, and T1 on what the free period is), and
 * that is a founder ruling, not an implementation detail. Writing the
 * predicate now and leaving it unwired means the ruling arrives with
 * real numbers attached instead of a guess.
 *
 * The economy has two pools, and only one of them is ever counted:
 *
 * - Never metered, on any channel, forever: conversation, planner
 *   edits, progress, report views, memories, journaling, logging hours,
 *   reading photos. That is the context engine and every habit loop.
 *   Charging for the evening debrief would meter the exact behavior that
 *   makes the product worth paying for.
 * - Metered: makings, meaning a visible artifact she can hold. A
 *   worksheet, a coloring page, a lesson with its worksheet, a month
 *   plan. Whole units, never fractions of a credit.
 */

import { mapDb } from "../map/db";

/** Whole units, never credit arithmetic. A picture book is three. */
export const MAKING_UNITS: Record<string, number> = {
  worksheet: 1,
  coloring_page: 1,
  subject_lesson_with_worksheet: 1,
  month_plan: 1,
  picture_book: 3,
};

/**
 * The taper, by week since signup. Week 1 and 2 are deliberately
 * generous: the free period's job is to install a rhythm, and a parent
 * who is rationing on day two never gets one. Week 3 onward is the
 * steady state a subscription buys her out of.
 */
export const MAKINGS_TAPER = [10, 10, 3] as const;

export function allowanceForWeek(weekIndex: number): number {
  if (weekIndex < 0) return MAKINGS_TAPER[0];
  return MAKINGS_TAPER[Math.min(weekIndex, MAKINGS_TAPER.length - 1)];
}

/**
 * The refill window: Monday to Monday, in the family's own week.
 * Monday is the homeschool planning rhythm, and a refill that lands the
 * morning she plans her week is a reason to open Homa rather than an
 * accounting event.
 */
export function refillWindow(now: Date): { startsAt: Date; refillsAt: Date } {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  // getUTCDay: 0 is Sunday, so Monday is 1 and Sunday rolls back six.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const refill = new Date(start);
  refill.setUTCDate(refill.getUTCDate() + 7);
  return { startsAt: start, refillsAt: refill };
}

export function weeksSince(signupAt: Date, now: Date): number {
  const ms = now.getTime() - signupAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

/** Why the meter would not apply, in the order it is decided. */
export type MakingsExemption = "billing_exempt" | "trial_started" | "sandbox";

export interface MakingsReading {
  familyId: string;
  /** Non-null means the meter would never have applied to this family. */
  exemption: MakingsExemption | null;
  allowance: number;
  used: number;
  remaining: number;
  weekIndex: number;
  refillsAt: string;
  /** Titles made in this window, so a message can name them, never invent them. */
  weekMade: string[];
  /** When the meter would first bite, if usage held its current pace. */
  predictedLockoutAt: string | null;
}

interface MakingsFamilyRow {
  id: string;
  created_at: string;
  billing_exempt: boolean;
  sandbox: boolean;
  trial_started_at: string | null;
}

function exemptionFor(row: MakingsFamilyRow): MakingsExemption | null {
  if (row.billing_exempt) return "billing_exempt";
  if (row.trial_started_at) return "trial_started";
  if (row.sandbox) return "sandbox";
  return null;
}

/**
 * predictedLockoutAt(reading, windowStart, now): when this family would
 * run out, at the pace they have kept this week.
 *
 * Null when they are not making anything, because a family making
 * nothing never hits a wall and a projected date for them would be
 * noise. Null too when they are already out: that is not a prediction.
 */
export function predictedLockoutAt(input: {
  used: number;
  allowance: number;
  windowStartMs: number;
  nowMs: number;
  refillsAtMs: number;
}): string | null {
  if (input.used === 0) return null;
  if (input.used >= input.allowance) return null;
  const elapsedMs = Math.max(1, input.nowMs - input.windowStartMs);
  const msPerMaking = elapsedMs / input.used;
  const atMs = input.nowMs + msPerMaking * (input.allowance - input.used);
  // Past the refill is not a lockout: the balance resets first.
  if (atMs >= input.refillsAtMs) return null;
  return new Date(atMs).toISOString();
}

/**
 * readFamilyMakings(familyId, now): what the meter WOULD say. Read-only,
 * and safe to call from an admin page and nowhere else.
 *
 * Materials are the countable artifact: one row per thing she can hold.
 * Superseded revisions do not count, because a parent who asked for one
 * fix should not pay twice for one worksheet.
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

  const { startsAt, refillsAt } = refillWindow(now);
  const weekIndex = weeksSince(new Date(family.created_at), now);
  const allowance = allowanceForWeek(weekIndex);

  const made = await sql<{ title: string | null }[]>`
    select title
    from public.materials
    where family_id = ${familyId}
      and status <> 'superseded'
      and created_at >= ${startsAt.toISOString()}
      and created_at < ${refillsAt.toISOString()}
    order by created_at asc
  `;
  const weekMade = made
    .map((row) => row.title)
    .filter((title): title is string => Boolean(title));
  const used = made.length;

  return {
    familyId,
    exemption: exemptionFor(family),
    allowance,
    used,
    remaining: Math.max(0, allowance - used),
    weekIndex,
    refillsAt: refillsAt.toISOString(),
    weekMade,
    predictedLockoutAt: predictedLockoutAt({
      used,
      allowance,
      windowStartMs: startsAt.getTime(),
      nowMs: now.getTime(),
      refillsAtMs: refillsAt.getTime(),
    }),
  };
}

/**
 * readFleetMakings(now, limit): the same reading for every family that
 * made anything this window, busiest first. This is the number that
 * answers P2: what a week's allowance should actually be.
 */
export async function readFleetMakings(
  now: Date = new Date(),
  limit = 50,
): Promise<MakingsReading[]> {
  const sql = mapDb();
  const { startsAt, refillsAt } = refillWindow(now);
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
      and m.created_at < ${refillsAt.toISOString()}
    group by f.id
    order by used desc
    limit ${limit}
  `;
  return rows.map((row) => {
    const weekIndex = weeksSince(new Date(row.created_at), now);
    const allowance = allowanceForWeek(weekIndex);
    return {
      familyId: row.id,
      exemption: exemptionFor(row),
      allowance,
      used: row.used,
      remaining: Math.max(0, allowance - row.used),
      weekIndex,
      refillsAt: refillsAt.toISOString(),
      weekMade: row.titles,
      predictedLockoutAt: predictedLockoutAt({
        used: row.used,
        allowance,
        windowStartMs: startsAt.getTime(),
        nowMs: now.getTime(),
        refillsAtMs: refillsAt.getTime(),
      }),
    };
  });
}
