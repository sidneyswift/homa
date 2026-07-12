import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  JOURNAL_MATCH_HIGH_CONFIDENCE_SCORE,
  matchJournalEvidence,
} from "./journal-matcher";

describe("journal evidence matcher", () => {
  it("classifies activity-only text before attempting a bank match", () => {
    assert.deepEqual(
      matchJournalEvidence({
        quote: "We read for 30 minutes",
        childName: "Maya",
      }),
      {
        classification: "activity_only",
        matches: [],
      },
    );
  });

  it("matches independent reading and comprehension skills deterministically", () => {
    type MatcherInput = Parameters<typeof matchJournalEvidence>[0];
    const acceptsModelItemId: "itemId" extends keyof MatcherInput
      ? true
      : false = false;

    const result = matchJournalEvidence({
      quote: "Maya read a short chapter book aloud and retold the plot",
      childName: "Maya",
    });

    assert.equal(acceptsModelItemId, false);
    assert.equal(result.classification, "matched_many");
    assert.deepEqual(
      result.matches.map((match) => match.itemId),
      ["literacy.emergent-reader", "literacy.retells-story"],
    );
    assert.deepEqual(
      result.matches.map((match) => match.answer),
      ["easily", "easily"],
    );
    assert.ok(
      result.matches.every(
        (match) =>
          match.score >= JOURNAL_MATCH_HIGH_CONFIDENCE_SCORE &&
          result.matches.length > 0 &&
          match.clause ===
            "Maya read a short chapter book aloud and retold the plot".slice(
              match.span.start,
              match.span.end,
            ),
      ),
    );
  });

  it("infers polarity separately for each child-attributed predicate", () => {
    const result = matchJournalEvidence({
      quote:
        "Maya can read an early chapter book but could not retell the plot",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched_many");
    assert.deepEqual(
      result.matches.map((match) => ({
        itemId: match.itemId,
        answer: match.answer,
      })),
      [
        {
          itemId: "literacy.emergent-reader",
          answer: "easily",
        },
        {
          itemId: "literacy.retells-story",
          answer: "not_yet",
        },
      ],
    );
  });

  it("does not inherit an explicitly named other actor's predicate", () => {
    const result = matchJournalEvidence({
      quote:
        "Maya can read an early chapter book, but Jordan could not retell the plot",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched");
    assert.deepEqual(
      result.matches.map((match) => match.itemId),
      ["literacy.emergent-reader"],
    );
  });

  it("does not cross a while-boundary into another actor", () => {
    const result = matchJournalEvidence({
      quote:
        "Maya read a simple book while Jordan retold the plot",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched");
    assert.deepEqual(
      result.matches.map((match) => match.itemId),
      ["literacy.emergent-reader"],
    );
  });

  it("does not attribute an embedded named actor's skill", () => {
    for (const quote of [
      "Maya watched Jordan retell the story",
      "Maya listened because Jordan retold the story",
      "Maya watched Jordan carefully retell the story",
      "Maya listened as Jordan successfully retold the story",
    ]) {
      assert.deepEqual(
        matchJournalEvidence({ quote, childName: "Maya" }),
        { classification: "no_match", matches: [] },
      );
    }
  });

  it("treats omitted-subject not-retell as negative child evidence", () => {
    const result = matchJournalEvidence({
      quote:
        "Maya can read a simple book but not retell the plot",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched_many");
    assert.deepEqual(
      result.matches.map((match) => ({
        itemId: match.itemId,
        answer: match.answer,
      })),
      [
        {
          itemId: "literacy.emergent-reader",
          answer: "easily",
        },
        {
          itemId: "literacy.retells-story",
          answer: "not_yet",
        },
      ],
    );
  });

  it("treats lots of help as emerging rather than easy", () => {
    const result = matchJournalEvidence({
      quote: "Maya can pedal with lots of help",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched");
    assert.equal(result.matches[0].itemId, "gross_motor.pedals");
    assert.equal(result.matches[0].answer, "getting_there");
  });

  it("matches the reviewed pedal alias with negative polarity", () => {
    const result = matchJournalEvidence({
      quote: "Maya still cannot pedal without help",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched");
    assert.deepEqual(result.matches[0], {
      itemId: "gross_motor.pedals",
      score: 0.98,
      answer: "not_yet",
      clause: "Maya still cannot pedal without help",
      span: { start: 0, end: 36 },
    });
  });

  it("keeps bundled and other-actor skills out across subjects", () => {
    const result = matchJournalEvidence({
      quote:
        "Maya counted 5 objects and wrote her name, but Jordan can pedal a bike",
      childName: "Maya",
    });

    assert.equal(result.classification, "matched_many");
    assert.deepEqual(
      result.matches.map((match) => match.itemId),
      ["math.how-many-5", "writing.writes-name"],
    );
    assert.equal(
      result.matches.some(
        (match) =>
          match.itemId === "literacy.chapter-books" ||
          match.itemId === "literacy.reads-short-book" ||
          match.itemId === "gross_motor.pedals",
      ),
      false,
    );
  });
});
