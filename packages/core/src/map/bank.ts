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
export const MAP_BANK_VERSION = "2026.07.0";

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
  items: readonly MapItem[];
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
