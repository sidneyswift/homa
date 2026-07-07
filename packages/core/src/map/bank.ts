import { MONTHS_AHEAD_CAP } from "./bands";
import { MAP_DOMAINS, MAP_SOURCES, type MapDomainContent } from "./content";

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
export const MAP_BANK_VERSION = "2026.07.2";

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
}

export interface MapDomain {
  id: string;
  displayName: string;
  /** One warm line shown when the domain's first question appears. */
  intro: string;
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
  domain: MapDomain,
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
function probeMonths(domain: MapDomain, ageMonths: number, answers: AnsweredLookup): number {
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
  domainId: string,
  ageMonths: number,
  answers: AnsweredLookup,
  answeredThisSitting: number,
): MapItem | null {
  const domain = getMapDomain(domainId);
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

export interface LadderRung {
  itemId: string;
  statement: string;
  typicalMonths: number;
  /** confirmed = "easily"; emerging = "getting there"; next_up = the named
   * next step (a "not yet", or the first unanswered rung above everything
   * confirmed). Never a locked state: the ladder only ever shows what she
   * lit and the single rung ahead. */
  state: "confirmed" | "emerging" | "next_up";
}

/**
 * The subject's ladder as the report draws it (the map, finally drawn):
 * every item the parent answered with real signal, in anchor order, plus
 * at most one unanswered "next up" rung above the highest confirmed
 * anchor, within the ahead cap. Pure display data; scoring never reads it.
 */
export function ladderRungs(
  domainId: string,
  ageMonths: number,
  answers: AnsweredLookup,
): LadderRung[] {
  const domain = getMapDomain(domainId);
  if (!domain) return [];
  const sorted = [...domain.items].sort((a, b) => a.typicalMonths - b.typicalMonths);

  const rungs: LadderRung[] = [];
  let highestAnswered = -Infinity;
  let hasNamedNext = false;
  for (const item of sorted) {
    const answer = answers[item.id];
    if (answer === "easily") {
      rungs.push({ itemId: item.id, statement: item.statement, typicalMonths: item.typicalMonths, state: "confirmed" });
      highestAnswered = Math.max(highestAnswered, item.typicalMonths);
    } else if (answer === "getting_there") {
      rungs.push({ itemId: item.id, statement: item.statement, typicalMonths: item.typicalMonths, state: "emerging" });
      highestAnswered = Math.max(highestAnswered, item.typicalMonths);
    } else if (answer === "not_yet") {
      // Only the LOWEST not-yet names the next step; higher ones are
      // beyond the frontier and drawing them would read as a wall.
      if (!hasNamedNext) {
        rungs.push({ itemId: item.id, statement: item.statement, typicalMonths: item.typicalMonths, state: "next_up" });
        hasNamedNext = true;
      }
      highestAnswered = Math.max(highestAnswered, item.typicalMonths);
    }
  }
  if (rungs.length === 0) return [];

  if (!hasNamedNext) {
    const next = sorted.find(
      (item) =>
        answers[item.id] === undefined &&
        item.typicalMonths > highestAnswered &&
        item.typicalMonths <= ageMonths + MONTHS_AHEAD_CAP,
    );
    if (next) {
      rungs.push({ itemId: next.id, statement: next.statement, typicalMonths: next.typicalMonths, state: "next_up" });
    }
  }
  return rungs;
}

export { MAP_DOMAINS, MAP_SOURCES, type MapDomainContent };

const itemIndex = new Map<string, { domain: MapDomain; item: MapItem }>();
for (const domain of MAP_DOMAINS) {
  for (const item of domain.items) {
    itemIndex.set(item.id, { domain, item });
  }
}

export function getMapItem(itemId: string): { domain: MapDomain; item: MapItem } | undefined {
  return itemIndex.get(itemId);
}

export function getMapDomain(domainId: string): MapDomain | undefined {
  return MAP_DOMAINS.find((domain) => domain.id === domainId);
}

/** At most this many rungs above the base per domain: two rungs reach the
 * +24 month display cap in every domain, so further questions would add
 * fatigue without adding signal. */
export const MAX_LADDER_RUNGS = 2;

/**
 * The questions one child can ever be asked, in serving order: per domain,
 * the frontier item (greatest typicalMonths at or below the child's age,
 * falling back to the easiest item for young twos) plus up to two ladder
 * rungs above it, within the +24 month cap. Rung N+1 is only SHOWN after
 * "easily" on rung N, so strong domains climb until the child's real
 * frontier is found (this is how "+18 months ahead" becomes measurable),
 * while everyone else answers exactly one question per domain.
 */
export interface MapQuestionPlan {
  domainId: string;
  base: MapItem;
  /** Ascending rungs above the base, within the ahead cap. */
  ladders: MapItem[];
}

export function planQuestions(ageMonths: number): MapQuestionPlan[] {
  const plans: MapQuestionPlan[] = [];
  for (const domain of MAP_DOMAINS) {
    const sorted = [...domain.items].sort((a, b) => a.typicalMonths - b.typicalMonths);
    const atOrBelow = sorted.filter((item) => item.typicalMonths <= ageMonths);
    const base = atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : sorted[0];
    const ladders = sorted
      .filter(
        (item) =>
          item.typicalMonths > base.typicalMonths &&
          item.typicalMonths <= ageMonths + MONTHS_AHEAD_CAP,
      )
      .slice(0, MAX_LADDER_RUNGS);
    plans.push({ domainId: domain.id, base, ladders });
  }
  return plans;
}
