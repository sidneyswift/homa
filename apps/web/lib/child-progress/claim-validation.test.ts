import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateProposedClaims,
  type ClaimChild,
  type ProposedClaim,
} from "./claim-validation";

/**
 * The trust boundary's teeth (AGENTS.md "Models judge, code verifies").
 *
 * A model proposes; this gate decides. Every test here is a way a model
 * could be wrong, careless, or compromised, and the assertion is that
 * the claim never reaches the ledger. Pure functions only, so the whole
 * boundary is provable without a model or a database.
 */

const STORY: ClaimChild = {
  childId: "child-story",
  name: "Story",
  ageMonths: 52, // 4 years old
};
const JUNE: ClaimChild = {
  childId: "child-june",
  name: "June",
  ageMonths: 112, // 9 years old
};
const CHILDREN = [STORY, JUNE];

const MESSAGE =
  "Story counted five objects and told me how many, and June read a very simple book on her own.";

function claim(overrides: Partial<ProposedClaim> = {}): ProposedClaim {
  return {
    childId: STORY.childId,
    itemId: "math.how-many-5",
    answer: "easily",
    quote: "Story counted five objects and told me how many",
    confidence: "high",
    ...overrides,
  };
}

describe("validateProposedClaims", () => {
  it("accepts a well-formed claim and attaches the catalog statement", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim()],
    });

    assert.deepEqual(result.rejected, []);
    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0].itemId, "math.how-many-5");
    assert.equal(result.accepted[0].subjectId, "math");
    assert.match(result.accepted[0].statement, /Counts 5 objects/);
  });

  it("refuses a skill that is not in the bank", () => {
    // The model cannot invent a rung, however plausible it sounds.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ itemId: "math.counts-to-eleventy" })],
    });

    assert.deepEqual(result.accepted, []);
    assert.equal(result.rejected[0].reason, "unknown_skill");
  });

  it("refuses a child outside the family, which is the tenancy law", () => {
    // The single most important check in this file: a model-supplied id
    // can never reach a child the caller did not authorize.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ childId: "child-from-another-family" })],
    });

    assert.deepEqual(result.accepted, []);
    assert.equal(result.rejected[0].reason, "unknown_child");
  });

  it("refuses a quote the parent never wrote", () => {
    // Provenance: a claim has to trace to the mother's own words, so a
    // fabricated or paraphrased quote is dropped even when the skill and
    // the child are both real.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ quote: "Story counted all the way to one hundred" })],
    });

    assert.deepEqual(result.accepted, []);
    assert.equal(result.rejected[0].reason, "quote_not_in_message");
  });

  it("forgives whitespace and casing in an otherwise real quote", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ quote: "story   COUNTED five objects" })],
    });

    assert.equal(result.accepted.length, 1);
  });

  it("refuses a skill far above the child's age", () => {
    // The 50-states scavenger hunt failure: a sentence mentions states,
    // so a model reaches for map reading and credits the 4-year-old with
    // a skill typical at 130 months.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [
        claim({ itemId: "social_studies.maps-scale", quote: "Story counted" }),
      ],
    });

    assert.deepEqual(result.accepted, []);
    assert.equal(result.rejected[0].reason, "age_implausible");
  });

  it("allows an advanced child a skill within the headroom", () => {
    // A 4-year-old reading a simple book (typical 72 months) is exactly
    // the story this product exists to tell, so it must not be refused.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [
        claim({
          itemId: "literacy.emergent-reader",
          quote: "read a very simple book on her own",
        }),
      ],
    });

    assert.equal(result.accepted.length, 1);
  });

  it("allows an older child to confirm a much earlier rung", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [
        claim({
          childId: JUNE.childId,
          itemId: "math.counts-to-5",
          quote: "June read a very simple book",
        }),
      ],
    });

    assert.equal(result.accepted.length, 1);
  });

  it("caps mastery claims the model is only medium-confident about", () => {
    // Inference can support "getting there"; it can never assert that a
    // child does something easily.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ answer: "easily", confidence: "medium" })],
    });

    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0].answer, "getting_there");
  });

  it("lets a medium-confidence not_yet through unchanged", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ answer: "not_yet", confidence: "medium" })],
    });

    assert.equal(result.accepted[0].answer, "not_yet");
  });

  it("never writes evidence from a low-confidence guess", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [claim({ confidence: "low" })],
    });

    assert.deepEqual(result.accepted, []);
    assert.equal(result.rejected[0].reason, "confidence_too_low");
  });

  it("keeps one claim per child and skill, strongest kept", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [
        claim({ answer: "not_yet" }),
        claim({ answer: "easily" }),
      ],
    });

    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0].answer, "easily");
    assert.equal(result.rejected[0].reason, "duplicate");
  });

  it("keeps the same skill separately for different children", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [
        claim(),
        claim({ childId: JUNE.childId, quote: "June read a very simple book" }),
      ],
    });

    assert.equal(result.accepted.length, 2);
  });

  it("drops only the bad claims in a mixed batch", () => {
    // Partial failure must not cost the parent her good report, which is
    // the bug the old matcher had: one conflicted item dropped the lot.
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [
        claim(),
        claim({ itemId: "not.a.real.skill" }),
        claim({ childId: "outsider" }),
      ],
    });

    assert.equal(result.accepted.length, 1);
    assert.equal(result.rejected.length, 2);
  });

  it("returns nothing for an empty batch", () => {
    const result = validateProposedClaims({
      message: MESSAGE,
      children: CHILDREN,
      claims: [],
    });

    assert.deepEqual(result, { accepted: [], rejected: [] });
  });
});
