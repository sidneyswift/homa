import { HOURS_SUBJECTS, type HoursSubject } from "../hours-model";

/**
 * The family time machine (gh#343): a deterministic synthetic history
 * for a family that has used Homa for one month, three, six, or a
 * school year.
 *
 * Why it exists: every fixture Homa had described a family on its first
 * day. Nothing exercised the surfaces whose whole value is accumulated
 * history (the hours page's school-year total, a full Binder, the state
 * evidence report in gh#317), so those surfaces were only ever seen
 * empty. This module generates the rows; scripts/seed-family-history.mts
 * writes them.
 *
 * Determinism is the point, so a fixture can be regenerated identically
 * and a test can assert exact totals: a seeded PRNG picks every choice,
 * and the caller passes the reference date (pure module, no clock).
 * Nothing here calls a model or replays a real turn; these are plausible
 * rows, never claims about a real family.
 */

export const HISTORY_PROFILES = ["month1", "month3", "month6", "year1"] as const;
export type HistoryProfile = (typeof HISTORY_PROFILES)[number];

export interface HistoryProfileShape {
  months: number;
  /** Share of eligible school days that get any logging at all. A new
   * family logs sporadically; a settled one logs most days. */
  loggingRate: number;
  /** Weeks deliberately left empty (illness, travel, a hard season), so
   * gap handling and honest-gap copy have something real to meet. */
  gapWeeks: number;
  label: string;
}

export const HISTORY_PROFILE_SHAPES: Record<HistoryProfile, HistoryProfileShape> = {
  month1: {
    months: 1,
    loggingRate: 0.45,
    gapWeeks: 0,
    label: "One month in: logging is sporadic, the habit is not set yet.",
  },
  month3: {
    months: 3,
    loggingRate: 0.7,
    gapWeeks: 1,
    label: "Three months in: a steady rhythm with one quiet week.",
  },
  month6: {
    months: 6,
    loggingRate: 0.78,
    gapWeeks: 2,
    label: "Half a year in: mid-year, two quiet weeks, real totals.",
  },
  year1: {
    months: 12,
    loggingRate: 0.8,
    gapWeeks: 3,
    label: "A full school year: the shape an evidence report needs.",
  },
};

/** Mulberry32: a tiny deterministic PRNG. The same seed always produces
 * the same family, which is what makes a fixture assertable. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Subjects weighted the way a real week skews: reading and math most
 * days, the rest in rotation. */
const SUBJECT_WEIGHTS: ReadonlyArray<readonly [HoursSubject, number]> = [
  ["reading", 22],
  ["math", 20],
  ["science", 11],
  ["social studies", 10],
  ["art", 8],
  ["music", 6],
  ["PE", 8],
  ["co-op", 5],
  ["life skills", 7],
  ["other", 3],
];

function pickSubject(random: () => number): HoursSubject {
  const total = SUBJECT_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [subject, weight] of SUBJECT_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return subject;
  }
  return "reading";
}

const NOTES: readonly string[] = [
  "read together after breakfast",
  "worked through the next section",
  "kitchen table, went well",
  "outside for most of it",
  "she asked to keep going",
  "short one today",
  "co-op morning",
  "library trip counted for this",
  "hands-on, lots of questions",
  "finished the chapter",
];

export interface HistoryHoursRow {
  childIndex: number | null;
  subject: HoursSubject;
  minutes: number;
  happenedOn: string;
  source: "chat" | "sms" | "call";
  note: string;
}

export interface HistoryMemoryRow {
  childIndex: number | null;
  kind: "fact" | "what_works" | "daily_note";
  content: string;
  daysAgo: number;
}

export interface FamilyHistory {
  profile: HistoryProfile;
  shape: HistoryProfileShape;
  hours: HistoryHoursRow[];
  memories: HistoryMemoryRow[];
  /** Totals the caller can assert against the hours page. */
  totals: {
    rows: number;
    minutes: number;
    perChildMinutes: number[];
    familyWideMinutes: number;
    distinctDays: number;
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * generateFamilyHistory: the rows for one synthetic family.
 *
 * `asOf` is the last day of the window (the caller's "today"), so the
 * history always ends at the present and a six-month family looks like
 * one that started six months ago, not one frozen in the past.
 *
 * The hours model's two load-bearing rules are honored here rather than
 * discovered at insert time: the unique block index on (family_id,
 * subject, minutes, happened_on, coalesce(child_id, zero-uuid)) means a
 * duplicate combination fails closed, so minutes are nudged until each
 * row is unique within its day; and a null childIndex is a family-wide
 * row that counts toward every child's total.
 */
export function generateFamilyHistory(input: {
  profile: HistoryProfile;
  childCount: number;
  asOf: Date;
  seed?: number;
}): FamilyHistory {
  const shape = HISTORY_PROFILE_SHAPES[input.profile];
  const random = seededRandom(input.seed ?? 20260728);
  const totalDays = Math.round(shape.months * 30.4);
  const start = addDays(input.asOf, -totalDays);

  // Quiet weeks, spread through the window rather than clustered at the
  // end, so a gap never looks like the family simply stopped.
  const gapStarts = new Set<number>();
  for (let index = 0; index < shape.gapWeeks; index += 1) {
    const slot = Math.floor(
      ((index + 1) / (shape.gapWeeks + 1)) * totalDays + (random() - 0.5) * 12,
    );
    gapStarts.add(Math.max(0, Math.min(totalDays - 7, slot)));
  }
  const inGap = (dayOffset: number): boolean =>
    [...gapStarts].some((gap) => dayOffset >= gap && dayOffset < gap + 7);

  const hours: HistoryHoursRow[] = [];
  const perChildMinutes = Array.from({ length: input.childCount }, () => 0);
  let familyWideMinutes = 0;
  const days = new Set<string>();

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
    const date = addDays(start, dayOffset);
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (inGap(dayOffset)) continue;
    if (random() > shape.loggingRate) continue;

    const happenedOn = isoDate(date);
    // 1 to 3 entries a day, plus an occasional family-wide co-op block.
    const entryCount = 1 + Math.floor(random() * 3);
    const usedKeys = new Set<string>();
    const familyWideToday = random() < 0.12;

    for (let entry = 0; entry < entryCount; entry += 1) {
      const childIndex =
        familyWideToday && entry === 0
          ? null
          : Math.floor(random() * input.childCount);
      const subject =
        childIndex === null ? "co-op" : pickSubject(random);
      // A logged block is 20 to 120 minutes: a real homeschool day is
      // a few of these, which lands a full year near the several-hundred
      // hour range states actually ask about (PA asks 900).
      let minutes = 20 + Math.floor(random() * 21) * 5;
      // Fail-closed dedupe: the unique block index would reject an
      // identical (subject, minutes, day, child) row, so nudge minutes
      // until this row is distinct within the day.
      let key = `${subject}:${minutes}:${childIndex ?? "family"}`;
      let nudges = 0;
      while (usedKeys.has(key) && nudges < 40) {
        minutes += 5;
        if (minutes > 240) minutes = 20;
        key = `${subject}:${minutes}:${childIndex ?? "family"}`;
        nudges += 1;
      }
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);

      hours.push({
        childIndex,
        subject,
        minutes,
        happenedOn,
        source: random() < 0.82 ? "chat" : random() < 0.6 ? "sms" : "call",
        note: NOTES[Math.floor(random() * NOTES.length)],
      });
      days.add(happenedOn);
      if (childIndex === null) familyWideMinutes += minutes;
      else perChildMinutes[childIndex] += minutes;
    }
  }

  // A few durable facts, the kind a year of conversation leaves behind.
  const memorySeeds: ReadonlyArray<[HistoryMemoryRow["kind"], string]> = [
    ["what_works", "Short lessons before lunch land better than long afternoon blocks."],
    ["fact", "Co-op meets on alternating Fridays."],
    ["what_works", "Reading aloud together goes further than independent reading right now."],
    ["fact", "The family takes a full week off around the winter holidays."],
    ["daily_note", "A hard week; we kept the load light on purpose."],
  ];
  const memoryCount = Math.min(
    memorySeeds.length,
    1 + Math.floor(shape.months / 2),
  );
  const memories: HistoryMemoryRow[] = memorySeeds
    .slice(0, memoryCount)
    .map(([kind, content], index) => ({
      childIndex:
        kind === "fact" || input.childCount === 0
          ? null
          : index % input.childCount,
      kind,
      content,
      daysAgo: Math.floor((totalDays / (memoryCount + 1)) * (index + 1)),
    }));

  return {
    profile: input.profile,
    shape,
    hours,
    memories,
    totals: {
      rows: hours.length,
      minutes: hours.reduce((sum, row) => sum + row.minutes, 0),
      perChildMinutes,
      familyWideMinutes,
      distinctDays: days.size,
    },
  };
}

/** Every subject the generator can emit is a real hours subject: the
 * check constraint in migration #37 rejects anything else, and a
 * seeder that fails halfway leaves a half-built fixture. */
export function generatedSubjectsAreValid(history: FamilyHistory): boolean {
  const allowed = new Set<string>(HOURS_SUBJECTS);
  return history.hours.every((row) => allowed.has(row.subject));
}
