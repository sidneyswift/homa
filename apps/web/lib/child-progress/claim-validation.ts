import { SKILL_CATALOG_BY_ID } from "./skill-catalog";

/**
 * The deterministic half of "models judge, code verifies" (AGENTS.md).
 *
 * A model proposes claims about what a parent's message says. Nothing
 * it proposes is trusted: this module re-derives every fact that can be
 * checked, from data the model never controls, and drops whatever fails.
 * Pure and synchronous on purpose, so the whole trust boundary is unit
 * testable without a model, a database, or a clock.
 *
 * What is checked, and why each one exists:
 *   1. The skill exists in the current bank.               (no invented rungs)
 *   2. The child belongs to this authenticated family.     (tenancy law)
 *   3. The quote appears verbatim in the parent's message.  (provenance,
 *      the lesson-listen pattern: a claim must be traceable to the
 *      mother's own words, not to the model's summary of them)
 *   4. The claim is age-plausible for that child.           (a 3-year-old
 *      cannot be credited with map-scale reading because a sentence
 *      mentioned states)
 *   5. Strength is capped by confidence.                    (an inferred
 *      claim can never assert mastery)
 *   6. One claim per child per skill, strongest kept.       (a message
 *      cannot vote twice)
 */

export type ClaimAnswer = "easily" | "getting_there" | "not_yet";
export type ClaimConfidence = "high" | "medium" | "low";

/** What the model is allowed to say. Shape mirrors the Zod schema in
 *  claim-extraction.ts; kept as a plain type so this module stays free
 *  of the model layer. */
export interface ProposedClaim {
  childId: string;
  itemId: string;
  answer: ClaimAnswer;
  quote: string;
  confidence: ClaimConfidence;
}

export interface ClaimChild {
  childId: string;
  name: string;
  /** Whole months, as the scorer computes age. */
  ageMonths: number;
}

export interface ValidatedClaim extends ProposedClaim {
  /** The catalog statement this claim landed on, for the receipt the
   *  parent sees and for anything that needs to explain the write. */
  statement: string;
  subjectId: string;
}

export type ClaimRejectionReason =
  | "unknown_skill"
  | "unknown_child"
  | "quote_not_in_message"
  | "age_implausible"
  | "confidence_too_low"
  | "duplicate";

export interface RejectedClaim {
  claim: ProposedClaim;
  reason: ClaimRejectionReason;
}

export interface ClaimValidationResult {
  accepted: ValidatedClaim[];
  rejected: RejectedClaim[];
}

/**
 * A skill below the child's age is never rejected: a 9-year-old
 * confirming a 4-year-old rung is ordinary corroboration, and the
 * scorer already takes the strongest anchor rather than the newest.
 * Only the above-age direction can indicate a mis-mapping.
 *
 * How far ABOVE the child's age a skill may sit before the claim reads
 * as a mis-mapping rather than a report. Two years of headroom keeps
 * genuinely advanced children creditable (a 4-year-old reading at 6 is
 * real and the whole point of the product) while refusing the absurd
 * (a 3-year-old credited with map-scale reading, typical at 130 months,
 * because the sentence mentioned states).
 */
const MAX_MONTHS_ABOVE_AGE = 24;

/** Mastery has to be earned. An inferred claim tops out below it, so a
 *  model that is merely guessing can never assert a child does
 *  something easily (founder ruling `progress-signal-capture-v2` D4). */
const CONFIDENCE_ANSWER_CAP: Record<ClaimConfidence, ClaimAnswer[]> = {
  high: ["easily", "getting_there", "not_yet"],
  medium: ["getting_there", "not_yet"],
  low: [],
};

const ANSWER_STRENGTH: Record<ClaimAnswer, number> = {
  easily: 3,
  getting_there: 2,
  not_yet: 1,
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Quote provenance: the model may trim and re-case, never invent. */
function quoteAppearsIn(message: string, quote: string): boolean {
  const haystack = collapseWhitespace(message).toLocaleLowerCase("en-US");
  const needle = collapseWhitespace(quote).toLocaleLowerCase("en-US");
  return needle.length > 0 && haystack.includes(needle);
}

/** Apply the confidence cap: returns the answer actually allowed, or
 *  null when this confidence may not write at all. */
function cappedAnswer(claim: ProposedClaim): ClaimAnswer | null {
  const allowed = CONFIDENCE_ANSWER_CAP[claim.confidence];
  if (allowed.length === 0) return null;
  if (allowed.includes(claim.answer)) return claim.answer;
  // Too strong for this confidence: step down rather than drop, so a
  // real report still lands, just more conservatively.
  return allowed[0];
}

/**
 * validateProposedClaims(...): the gate. Everything the model said is
 * re-checked against the bank, the family, and the parent's own words.
 */
export function validateProposedClaims(input: {
  message: string;
  children: readonly ClaimChild[];
  claims: readonly ProposedClaim[];
}): ClaimValidationResult {
  const accepted: ValidatedClaim[] = [];
  const rejected: RejectedClaim[] = [];
  const childrenById = new Map(
    input.children.map((child) => [child.childId, child]),
  );
  // (childId, itemId) -> index into accepted, so a second claim for the
  // same skill competes with the first instead of writing twice.
  const seen = new Map<string, number>();

  for (const claim of input.claims) {
    const skill = SKILL_CATALOG_BY_ID.get(claim.itemId);
    if (!skill) {
      rejected.push({ claim, reason: "unknown_skill" });
      continue;
    }
    const child = childrenById.get(claim.childId);
    if (!child) {
      rejected.push({ claim, reason: "unknown_child" });
      continue;
    }
    if (!quoteAppearsIn(input.message, claim.quote)) {
      rejected.push({ claim, reason: "quote_not_in_message" });
      continue;
    }
    if (skill.typicalMonths - child.ageMonths > MAX_MONTHS_ABOVE_AGE) {
      rejected.push({ claim, reason: "age_implausible" });
      continue;
    }
    const answer = cappedAnswer(claim);
    if (answer === null) {
      // Low confidence never writes evidence. The caller still keeps the
      // message as an observation, so the signal is not lost.
      rejected.push({ claim, reason: "confidence_too_low" });
      continue;
    }

    const key = `${claim.childId}:${claim.itemId}`;
    const existingIndex = seen.get(key);
    const validated: ValidatedClaim = {
      ...claim,
      answer,
      statement: skill.statement,
      subjectId: skill.subjectId,
    };
    if (existingIndex === undefined) {
      seen.set(key, accepted.length);
      accepted.push(validated);
      continue;
    }
    const existing = accepted[existingIndex];
    if (ANSWER_STRENGTH[answer] > ANSWER_STRENGTH[existing.answer]) {
      rejected.push({ claim: existing, reason: "duplicate" });
      accepted[existingIndex] = validated;
    } else {
      rejected.push({ claim, reason: "duplicate" });
    }
  }

  return { accepted, rejected };
}
