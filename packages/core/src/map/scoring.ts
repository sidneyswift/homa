import { MONTHS_AHEAD_CAP } from "./bands";
import { MAP_DOMAINS, getMapItem, planQuestions, type MapAnswer } from "./bank";

/**
 * The deterministic map scorer. Pure functions, no I/O, no model calls:
 * the same answers always produce the same map, and the whole thing is
 * unit-tested from fixtures (scripts/map-check.mjs).
 *
 * Model: every item is anchored to the age (in months) by which the behavior
 * is typical per the cited frameworks. "Easily" means the child has reached
 * that anchor; "getting there" means the skill is emerging (half-band
 * credit); "not yet" tells us the frontier sits at or below that anchor,
 * never anything worse. The domain's months-ahead is the highest anchor
 * reached minus the child's age, capped at +24 per the position rubric.
 *
 * Display law (BUILD.md #4): there is no negative number anywhere in the
 * output. A frontier below age renders as position "growing", the sanctioned
 * growth framing, with an activity attached by the caller.
 */

export type MapPosition = "ahead" | "on_track" | "growing" | "not_mapped";

/** Ahead begins at half a band above age; below that is "right in the band". */
export const AHEAD_THRESHOLD_MONTHS = 6;
/** "Getting there" earns the anchor minus half a band. */
export const EMERGING_DISCOUNT_MONTHS = 6;

export interface MapAnswerInput {
  itemId: string;
  answer: MapAnswer;
}

export interface DomainScore {
  domainId: string;
  position: MapPosition;
  /** Whole months ahead of age; null unless position is "ahead" or "on_track". */
  monthsAhead: number | null;
  /** True when both the base and a ladder item carried real signal. */
  highConfidence: boolean;
  /** Count of real observations (easily / getting there / not yet). */
  observations: number;
  /** Statement of the strongest item she confirmed, for honest evidence lines. */
  strongestObservedStatement: string | null;
  exposureBased: boolean;
}

export interface MapScores {
  domains: DomainScore[];
  /** Domain ids sorted strongest first among scored, growth last. */
  strengthOrder: string[];
  mappedCount: number;
  totalDomains: number;
  observationCount: number;
}

function isRealObservation(answer: MapAnswer): boolean {
  return answer === "easily" || answer === "getting_there" || answer === "not_yet";
}

export function scoreMap(ageMonths: number, answers: MapAnswerInput[]): MapScores {
  const byDomain = new Map<string, MapAnswerInput[]>();
  for (const entry of answers) {
    const found = getMapItem(entry.itemId);
    if (!found) continue;
    const list = byDomain.get(found.domain.id) ?? [];
    list.push(entry);
    byDomain.set(found.domain.id, list);
  }

  const domains: DomainScore[] = MAP_DOMAINS.map((domain) => {
    const domainAnswers = byDomain.get(domain.id) ?? [];
    const observations = domainAnswers.filter((a) => isRealObservation(a.answer));

    if (observations.length === 0) {
      return {
        domainId: domain.id,
        position: "not_mapped" as const,
        monthsAhead: null,
        highConfidence: false,
        observations: 0,
        strongestObservedStatement: null,
        exposureBased: domain.exposureBased,
      };
    }

    let frontier: number | null = null;
    let strongestStatement: string | null = null;
    let sawNotYet = false;

    for (const entry of observations) {
      const found = getMapItem(entry.itemId);
      if (!found) continue;
      const anchor = found.item.typicalMonths;
      if (entry.answer === "easily") {
        if (frontier === null || anchor > frontier) {
          frontier = anchor;
          strongestStatement = found.item.statement;
        }
      } else if (entry.answer === "getting_there") {
        const reached = anchor - EMERGING_DISCOUNT_MONTHS;
        if (frontier === null || reached > frontier) {
          frontier = reached;
          strongestStatement = found.item.statement;
        }
      } else if (entry.answer === "not_yet") {
        sawNotYet = true;
      }
    }

    const highConfidence = observations.length >= 2;

    if (domain.exposureBased) {
      const position: MapPosition = frontier !== null ? "on_track" : "growing";
      return {
        domainId: domain.id,
        position,
        monthsAhead: null,
        highConfidence,
        observations: observations.length,
        strongestObservedStatement: strongestStatement,
        exposureBased: true,
      };
    }

    if (frontier === null) {
      // Only "not yet" signal: the frontier sits at or below her base item.
      return {
        domainId: domain.id,
        position: "growing" as const,
        monthsAhead: null,
        highConfidence,
        observations: observations.length,
        strongestObservedStatement: null,
        exposureBased: false,
      };
    }

    const delta = frontier - ageMonths;
    let position: MapPosition;
    let monthsAhead: number | null;
    if (delta >= AHEAD_THRESHOLD_MONTHS) {
      position = "ahead";
      monthsAhead = Math.min(delta, MONTHS_AHEAD_CAP);
    } else if (delta >= 0 || !sawNotYet) {
      // At or near age, or the only miss was a ladder item well above age.
      position = "on_track";
      monthsAhead = Math.max(0, Math.min(delta, MONTHS_AHEAD_CAP));
    } else {
      position = "growing";
      monthsAhead = null;
    }

    return {
      domainId: domain.id,
      position,
      monthsAhead,
      highConfidence,
      observations: observations.length,
      strongestObservedStatement: strongestStatement,
      exposureBased: false,
    };
  });

  const rank = (score: DomainScore): number => {
    if (score.position === "ahead" || score.position === "on_track") {
      return 1000 + (score.monthsAhead ?? 0);
    }
    if (score.position === "growing") return 10;
    return 0;
  };
  const strengthOrder = [...domains]
    .filter((score) => score.position !== "not_mapped")
    .sort((a, b) => rank(b) - rank(a))
    .map((score) => score.domainId);

  return {
    domains,
    strengthOrder,
    mappedCount: domains.filter((score) => score.position !== "not_mapped").length,
    totalDomains: domains.length,
    observationCount: answers.filter((a) => isRealObservation(a.answer)).length,
  };
}

/** How many questions a child of this age can be asked at most (base + all rungs). */
export function maxQuestionsForAge(ageMonths: number): number {
  return planQuestions(ageMonths).reduce(
    (total, plan) => total + 1 + plan.ladders.length,
    0,
  );
}
