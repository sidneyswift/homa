import { aheadCapForAge } from "./bands";
import { MAP_SUBJECTS, getMapItem, planQuestions, type MapAnswer, type MapItem } from "./bank";
import { domainForBankItem } from "./item-domains";

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
 * reached minus the child's age, capped per the position rubric.
 *
 * Two honesty rules keep the number conservative (2026-07-08, after pilot
 * parents flagged inflated claims like "+19 months" on a 2-year-old):
 *
 * 1. Window credit: anchors are "typical BY" ages, the late edge of a wide
 *    normal window (docs/homa-benchmarks/00-synthesis.md correction 6).
 *    Where the bank documents the real window (typicalRangeMonths), an
 *    "easily" earns the EARLY edge of that window, because that is the
 *    age at which doing the skill genuinely starts to be early.
 * 2. Age-scaled cap: months-ahead never exceeds about a third of the
 *    child's age (aheadCapForAge), the honest resolution limit of a
 *    short parent questionnaire, within the absolute +24 cap.
 *
 * Display law (BUILD.md #4): `monthsAhead` is never negative. A frontier
 * below age reads as position "growing" with `monthsAhead: null`, and the
 * REAL signed distance travels separately in `frontierDeltaMonths`
 * (founder ruling 2026-07-13: the trajectory chart plots the real
 * negative number instead of a euphemism slot). Surfaces that still
 * speak in growth framing simply keep ignoring the raw field.
 */

export type MapPosition = "ahead" | "on_track" | "growing" | "not_mapped";

/**
 * Names the scoring RULES in effect, separate from the bank version
 * (content) and the child's recorded birthday (age basis). Stamped on
 * every stored scoring (child_reports, its history snapshots, and
 * child_progress_snapshots) so an archived number can always be traced
 * to the rules that produced it: the 2026-07-08 rule change (window
 * credit + age-scaled cap) moved live charts with zero change in child
 * evidence, and the archives couldn't say why. Bump this whenever
 * scoring semantics change. "v1" is the window-credit + age-cap era,
 * matching the value check-in snapshots already store.
 */
export const MAP_SCORER_VERSION = "map-score-v1";

/** Ahead begins at half a band above age; below that is "right in the band". */
export const AHEAD_THRESHOLD_MONTHS = 6;
/** "Getting there" earns the anchor minus half a band. */
export const EMERGING_DISCOUNT_MONTHS = 6;

export interface MapAnswerInput {
  itemId: string;
  answer: MapAnswer;
}

export interface SubjectScore {
  subjectId: string;
  position: MapPosition;
  /** Whole months ahead of age; null unless position is "ahead" or "on_track". */
  monthsAhead: number | null;
  /**
   * The RAW signed frontier distance: highest credited months minus age,
   * uncapped in both directions, null when nothing measurable was
   * confirmed (no easily/getting_there yet) or the subject is
   * exposure-based. This is the honest number behind the display fields:
   * negative for a below-age frontier (founder ruling 2026-07-13, the
   * trajectory chart plots it as-is), above the cap for a frontier the
   * display floors (beyondScale). Display surfaces keep using
   * monthsAhead; charts and analysis read this.
   */
  frontierDeltaMonths: number | null;
  /**
   * True when monthsAhead is a FLOOR, not the measurement: the child's
   * confirmed frontier ran past the display cap, or they confirmed the
   * highest item the bank has for this subject. Display and narrative
   * say so plainly ("the checklist stops here, not the child"), so a
   * genuinely advanced kid is never mistaken for a merely capped number.
   */
  beyondScale: boolean;
  /** True when at least two checklist items in this subject carried real signal. */
  highConfidence: boolean;
  /** Count of real observations (easily / getting there / not yet). */
  observations: number;
  /** Statement of the strongest item she confirmed, for honest evidence lines. */
  strongestObservedStatement: string | null;
  /** The strongest observed item's typical-age anchor in months, so a
   * surface can say "typical around age 4½" next to the statement. */
  strongestObservedMonths: number | null;
  /**
   * Statement of the specific next step (the lowest "not yet" item), so a
   * growing subject can be named concretely instead of generically.
   */
  frontierStatement: string | null;
  /**
   * The frontier item's id and its taxonomy domain (age-aware knowledge
   * plan, KC-1). This is the specific skill line the child is working,
   * so the fleet demand queue and the corpus matcher can key research by
   * domain (math.multiplication-division) instead of the whole subject.
   * Both null when no frontier item was identified (mirrors
   * frontierStatement) or the item carries no domain assignment.
   */
  frontierItemId: string | null;
  frontierDomain: string | null;
  exposureBased: boolean;
}

export interface MapScores {
  subjects: SubjectScore[];
  /** Domain ids sorted strongest first among scored, growth last. */
  strengthOrder: string[];
  mappedCount: number;
  totalSubjects: number;
  observationCount: number;
}

function isRealObservation(answer: MapAnswer): boolean {
  return answer === "easily" || answer === "getting_there" || answer === "not_yet";
}

/** The months an "easily" earns: the early edge of the documented typical
 * window when the corpus gives one, else the single anchor. */
function creditMonths(item: MapItem): number {
  return item.typicalRangeMonths ? item.typicalRangeMonths[0] : item.typicalMonths;
}

export function scoreMap(ageMonths: number, answers: MapAnswerInput[]): MapScores {
  const bySubject = new Map<string, MapAnswerInput[]>();
  for (const entry of answers) {
    const found = getMapItem(entry.itemId);
    if (!found) continue;
    const list = bySubject.get(found.subject.id) ?? [];
    list.push(entry);
    bySubject.set(found.subject.id, list);
  }

  const subjects: SubjectScore[] = MAP_SUBJECTS.map((subject) => {
    const subjectAnswers = bySubject.get(subject.id) ?? [];
    const observations = subjectAnswers.filter((a) => isRealObservation(a.answer));

    if (observations.length === 0) {
      return {
        subjectId: subject.id,
        position: "not_mapped" as const,
        monthsAhead: null,
        frontierDeltaMonths: null,
        beyondScale: false,
        highConfidence: false,
        observations: 0,
        strongestObservedStatement: null,
        strongestObservedMonths: null,
        frontierStatement: null,
        frontierItemId: null,
        frontierDomain: null,
        exposureBased: subject.exposureBased,
      };
    }

    let frontier: number | null = null;
    let strongestStatement: string | null = null;
    let strongestAnchor: number | null = null;
    let sawNotYet = false;
    let frontierStatement: string | null = null;
    let frontierItemId: string | null = null;
    let frontierAnchor: number | null = null;
    let topOfBankConfirmed = false;
    const bankTop = Math.max(...subject.items.map((item) => item.typicalMonths));

    for (const entry of observations) {
      const found = getMapItem(entry.itemId);
      if (!found) continue;
      const anchor = found.item.typicalMonths;
      if (entry.answer === "easily") {
        const reached = creditMonths(found.item);
        if (frontier === null || reached > frontier) frontier = reached;
        if (anchor === bankTop) topOfBankConfirmed = true;
        // Evidence lines name the strongest thing she has SEEN, so the
        // statement follows the raw anchor even when the scored credit
        // (the window's early edge) sits lower.
        if (strongestAnchor === null || anchor > strongestAnchor) {
          strongestAnchor = anchor;
          strongestStatement = found.item.statement;
        }
      } else if (entry.answer === "getting_there") {
        const reached = creditMonths(found.item) - EMERGING_DISCOUNT_MONTHS;
        if (frontier === null || reached > frontier) frontier = reached;
        if (strongestAnchor === null || anchor > strongestAnchor) {
          strongestAnchor = anchor;
          strongestStatement = found.item.statement;
        }
        if (frontierAnchor === null || anchor < frontierAnchor) {
          frontierAnchor = anchor;
          frontierStatement = found.item.statement;
          frontierItemId = found.item.id;
        }
      } else if (entry.answer === "not_yet") {
        sawNotYet = true;
        // The lowest not-yet item names the concrete next step.
        if (frontierAnchor === null || anchor < frontierAnchor) {
          frontierAnchor = anchor;
          frontierStatement = found.item.statement;
          frontierItemId = found.item.id;
        }
      }
    }

    const highConfidence = observations.length >= 2;

    if (subject.exposureBased) {
      const position: MapPosition = frontier !== null ? "on_track" : "growing";
      return {
        subjectId: subject.id,
        position,
        monthsAhead: null,
        frontierDeltaMonths: null,
        beyondScale: false,
        highConfidence,
        observations: observations.length,
        strongestObservedStatement: strongestStatement,
        strongestObservedMonths: strongestAnchor,
        frontierStatement,
        frontierItemId,
        frontierDomain: frontierItemId ? domainForBankItem(frontierItemId) : null,
        exposureBased: true,
      };
    }

    if (frontier === null) {
      // Only "not yet" signal: the frontier sits at or below her base
      // item, but nothing measurable was confirmed, so there is no
      // number, raw or displayed.
      return {
        subjectId: subject.id,
        position: "growing" as const,
        monthsAhead: null,
        frontierDeltaMonths: null,
        beyondScale: false,
        highConfidence,
        observations: observations.length,
        strongestObservedStatement: null,
        strongestObservedMonths: null,
        frontierStatement,
        frontierItemId,
        frontierDomain: frontierItemId ? domainForBankItem(frontierItemId) : null,
        exposureBased: false,
      };
    }

    const delta = frontier - ageMonths;
    const cap = aheadCapForAge(ageMonths);
    let position: MapPosition;
    let monthsAhead: number | null;
    if (delta >= AHEAD_THRESHOLD_MONTHS) {
      position = "ahead";
      monthsAhead = Math.min(delta, cap);
    } else if (delta >= 0 || !sawNotYet) {
      // At or near age, or the only miss was a ladder item well above age.
      position = "on_track";
      monthsAhead = Math.max(0, Math.min(delta, cap));
    } else {
      position = "growing";
      monthsAhead = null;
    }

    // The number is a floor when the confirmed frontier ran past the
    // display cap, or the child confirmed the hardest item the bank has.
    const beyondScale =
      position === "ahead" && monthsAhead !== null && (delta > monthsAhead || topOfBankConfirmed);

    return {
      subjectId: subject.id,
      position,
      monthsAhead,
      frontierDeltaMonths: delta,
      beyondScale,
      highConfidence,
      observations: observations.length,
      strongestObservedStatement: strongestStatement,
      strongestObservedMonths: strongestAnchor,
      frontierStatement,
      frontierItemId,
      frontierDomain: frontierItemId ? domainForBankItem(frontierItemId) : null,
      exposureBased: false,
    };
  });

  const rank = (score: SubjectScore): number => {
    if (score.position === "ahead" || score.position === "on_track") {
      return 1000 + (score.monthsAhead ?? 0);
    }
    if (score.position === "growing") return 10;
    return 0;
  };
  const strengthOrder = [...subjects]
    .filter((score) => score.position !== "not_mapped")
    .sort((a, b) => rank(b) - rank(a))
    .map((score) => score.subjectId);

  return {
    subjects,
    strengthOrder,
    mappedCount: subjects.filter((score) => score.position !== "not_mapped").length,
    totalSubjects: subjects.length,
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
