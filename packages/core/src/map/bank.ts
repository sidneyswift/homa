import { MONTHS_AHEAD_CAP } from "./bands";
import { MAP_SUBJECTS, MAP_SOURCES, cdcChecklistUrl, type MapSubjectContent } from "./content";

/**
 * The map question bank: types, selection ladder, and lookups over the
 * versioned content in ./content. The bank is deterministic data, no I/O.
 *
 * Selection model (mirrors the template questionnaire's "band plus one above"
 * mechanic): per domain the child gets the item at their age frontier, and an
 * "easily" unlocks the next item up the ladder, which is how months-ahead is
 * detected. "Not yet" never triggers extra questions, downward drilling is
 * deliberately impossible.
 */

/** Bumped whenever content meaningfully changes; stored on every report. */
export const MAP_BANK_VERSION = "2026.07.5";

export const MAP_ANSWERS = ["easily", "getting_there", "not_yet", "not_sure", "skip"] as const;
export type MapAnswer = (typeof MAP_ANSWERS)[number];

export interface MapItem {
  /** Stable id: "<domain>.<slug>". Answers are stored against this. */
  id: string;
  /** Parent-observable statement, answerable from memory with the chips. */
  statement: string;
  /** Age in months by which the behavior is typical (the scoring anchor). */
  typicalMonths: number;
  /** Citation keys into MAP_SOURCES. */
  sources: readonly string[];
  /** Documented typical WINDOW [earliest, latest] in months, only where the
   * corpus gives a real cited range; display-only (see content.ts). */
  typicalRangeMonths?: readonly [number, number];
  /** Curriculum-standard keys this item aligns to (e.g. "CCSS K.CC.A.1"),
   * populated on most bank items in content.ts and surfaced in the evidence
   * pack. Optional: not every item maps to a formal standard. */
  standards?: readonly string[];
}

export interface MapSubject {
  id: string;
  displayName: string;
  /** One warm line shown when the domain's first question appears. */
  intro: string;
  /** 1 to 2 plain sentences shown when the subject's report card opens:
   * what this subject is and what it feeds (see content.ts). */
  whatItIs: string;
  /**
   * True for domains that track exposure, not age-normed development
   * (second language). They never produce a months-ahead number.
   */
  exposureBased: boolean;
  /** The free five-minute activity attached to a "growing right now" state. */
  growingActivity: { title: string; description: string };
  /** Age-appropriate swap for kids ~8 and up. */
  growingActivityOlder?: { title: string; description: string };
  items: readonly MapItem[];
}

/** The right growing activity for the child's age (older variant from ~8y). */
export function growingActivityFor(
  domain: MapSubject,
  ageMonths: number,
): { title: string; description: string } {
  if (ageMonths >= 96 && domain.growingActivityOlder) return domain.growingActivityOlder;
  return domain.growingActivity;
}

/** Deep dives ask at most this many new questions per sitting. */
export const DEEP_DIVE_CAP = 8;

interface AnsweredLookup {
  [itemId: string]: "easily" | "getting_there" | "not_yet" | "not_sure" | "skip";
}

/**
 * Where the deep dive should probe next, from the child's answers so far:
 * the midpoint between the strongest confirmed skill and the lowest
 * "not yet" (the read-through's exact ask: "how far back does the struggle
 * begin?" walks DOWN to find the real starting line; strong kids walk UP
 * past the report's two-rung cap).
 */
function probeMonths(domain: MapSubject, ageMonths: number, answers: AnsweredLookup): number {
  let reached: number | null = null;
  let ceiling: number | null = null;
  for (const item of domain.items) {
    const answer = answers[item.id];
    if (answer === "easily") {
      reached = Math.max(reached ?? -Infinity, item.typicalMonths);
    } else if (answer === "getting_there") {
      reached = Math.max(reached ?? -Infinity, item.typicalMonths - 6);
    } else if (answer === "not_yet") {
      ceiling = Math.min(ceiling ?? Infinity, item.typicalMonths);
    }
  }
  if (reached !== null && ceiling !== null) return Math.round((reached + ceiling) / 2);
  if (reached !== null) return reached + 6;
  if (ceiling !== null) return ceiling - 6;
  return ageMonths;
}

/**
 * The next question of a subject deep dive, or null when the sitting is
 * done (bank exhausted or DEEP_DIVE_CAP new answers). Deterministic given
 * the answers, so the client can recompute after every tap, exactly like
 * the main checklist's queue.
 */
export function nextDeepDiveItem(
  subjectId: string,
  ageMonths: number,
  answers: AnsweredLookup,
  answeredThisSitting: number,
): MapItem | null {
  const domain = getMapSubject(subjectId);
  if (!domain || answeredThisSitting >= DEEP_DIVE_CAP) return null;
  const unanswered = domain.items.filter((item) => answers[item.id] === undefined);
  if (unanswered.length === 0) return null;
  const probe = probeMonths(domain, ageMonths, answers);
  return [...unanswered].sort(
    (a, b) =>
      Math.abs(a.typicalMonths - probe) - Math.abs(b.typicalMonths - probe) ||
      a.typicalMonths - b.typicalMonths,
  )[0];
}

export { MAP_SUBJECTS, MAP_SOURCES, cdcChecklistUrl, type MapSubjectContent };

const itemIndex = new Map<string, { subject: MapSubject; item: MapItem }>();
for (const domain of MAP_SUBJECTS) {
  for (const item of domain.items) {
    itemIndex.set(item.id, { subject: domain, item });
  }
}

export function getMapItem(itemId: string): { subject: MapSubject; item: MapItem } | undefined {
  return itemIndex.get(itemId);
}

export function getMapSubject(subjectId: string): MapSubject | undefined {
  return MAP_SUBJECTS.find((domain) => domain.id === subjectId);
}

/** At most this many rungs above the base per non-core domain: two rungs
 * approach the display cap, and electives and motor domains stay light
 * on purpose. */
export const MAX_LADDER_RUNGS = 2;

/** Core subjects climb until the frontier is actually found: up to six
 * rungs above the base (seven questions in a subject, worst case), and
 * past the display window, because rungs only ever appear on an "easily"
 * streak. Founder ruling 2026-07-08 ("I would rather give way more
 * questions if it gives way more accurate results"): for a strong kid
 * every extra rung is real corroboration and the honest search for where
 * the run ends; for everyone else the climb never starts. The DISPLAYED
 * number still caps at aheadCapForAge; the extra rungs feed the receipts,
 * the evidence lines, and the plan's starting line. */
export const CORE_LADDER_RUNGS = 6;
export const CORE_SUBJECT_IDS: readonly string[] = [
  "math",
  "literacy",
  "phonics",
  "writing",
  "language",
];

/**
 * The questions one child can ever be asked, in serving order: per domain,
 * the frontier item (greatest typicalMonths at or below the child's age,
 * falling back to the easiest item for young twos) plus ladder rungs above
 * it. Non-core domains serve up to two rungs within the +24 month window;
 * core subjects serve up to six rungs with no window, so a genuinely
 * advanced kid's real frontier gets found instead of assumed. Rung N+1 is
 * only SHOWN after "easily" on rung N, so strong domains climb while
 * everyone else answers exactly one question per domain.
 */
export interface MapQuestionPlan {
  subjectId: string;
  base: MapItem;
  /** Ascending rungs above the base. */
  ladders: MapItem[];
}

export function planQuestions(ageMonths: number): MapQuestionPlan[] {
  const plans: MapQuestionPlan[] = [];
  for (const domain of MAP_SUBJECTS) {
    const sorted = [...domain.items].sort((a, b) => a.typicalMonths - b.typicalMonths);
    const atOrBelow = sorted.filter((item) => item.typicalMonths <= ageMonths);
    const base = atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : sorted[0];
    const core = CORE_SUBJECT_IDS.includes(domain.id);
    const ladders = sorted
      .filter(
        (item) =>
          item.typicalMonths > base.typicalMonths &&
          (core || item.typicalMonths <= ageMonths + MONTHS_AHEAD_CAP),
      )
      .slice(0, core ? CORE_LADDER_RUNGS : MAX_LADDER_RUNGS);
    plans.push({ subjectId: domain.id, base, ladders });
  }
  return plans;
}
