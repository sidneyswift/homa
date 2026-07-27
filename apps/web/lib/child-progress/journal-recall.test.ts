import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  JOURNAL_RECALL_CORPUS,
  type JournalRecallCase,
  type JournalRecallWant,
} from "./journal-recall-corpus";
import { matchJournalEvidence } from "./journal-matcher";

/**
 * The journal matcher's recall ratchet (signal-capture audit §4.4).
 *
 * Two numbers, both measured against realistic parent phrasing:
 *   RECALL    the share of should-score cases that actually score.
 *   PRECISION the share of must-never-record cases the matcher leaves
 *             alone.
 *
 * The floors below are the MEASURED state, not the target. Recall is
 * catastrophically low on purpose: that is the finding the audit
 * shipped, and pinning it here means the number can only move up.
 * Raise a floor in the same change that earns it, and never lower one
 * without a founder ruling: a drop means real families stopped being
 * heard, which is exactly the failure that ran unnoticed in production
 * from launch until 2026-07-21.
 *
 * Precision is the safety side of the ratchet. It is at 1.0 and must
 * stay there: recall work that starts crediting children for a
 * sibling's milestone, a worksheet request, or a hard morning is worse
 * than the silence it replaced.
 */

/**
 * Measured 2026-07-21 on the shipped matcher: 4 of 14. Only ever raise
 * this. The four that pass all ride hand-written alias rules, which is
 * the audit's point: recall is alias coverage, not language
 * understanding, until the D3 matcher work lands.
 */
const RECALL_FLOOR = 0.28;
/** Never lower. Recall work must not cost the record its trust. */
const PRECISION_FLOOR = 1;

function observedOutcome(recallCase: JournalRecallCase): JournalRecallWant {
  const result = matchJournalEvidence({
    quote: recallCase.quote,
    childName: recallCase.childName,
  });
  switch (result.classification) {
    case "matched":
    case "matched_many":
      return "scores";
    case "activity_only":
      return "observes";
    case "ambiguous":
      // Ambiguous stores an observation and asks a question; it is not
      // a score, so it counts as "observes" for measurement.
      return "observes";
    case "no_match":
      // A no_match with nearest-skill candidates is a tagged
      // observation; a bare one recorded nothing useful.
      return result.candidates.length > 0 ? "observes" : "ignores";
  }
}

function rate(matching: number, total: number): number {
  return total === 0 ? 1 : matching / total;
}

describe("journal matcher recall against real parent phrasing", () => {
  const scored = JOURNAL_RECALL_CORPUS.filter((c) => c.want === "scores");
  const ignored = JOURNAL_RECALL_CORPUS.filter((c) => c.want === "ignores");

  it("keeps the corpus honest about where each case came from", () => {
    assert.ok(
      JOURNAL_RECALL_CORPUS.length >= 25,
      "the corpus should keep growing as real phrasings arrive",
    );
    for (const recallCase of JOURNAL_RECALL_CORPUS) {
      assert.ok(recallCase.note.length > 0, recallCase.quote);
    }
    // The product's own trigger examples must be represented: if Homa
    // is told to journal a sentence, that sentence is a fair test.
    assert.ok(
      JOURNAL_RECALL_CORPUS.some((c) => c.source === "instructions"),
      "instructions.md's own examples belong in the corpus",
    );
    assert.ok(
      JOURNAL_RECALL_CORPUS.some((c) => c.source === "prod_lesson"),
      "real lesson clauses belong in the corpus",
    );
  });

  it("meets the pinned recall floor on capability reports", () => {
    const hits = scored.filter(
      (recallCase) => observedOutcome(recallCase) === "scores",
    );
    const recall = rate(hits.length, scored.length);
    const misses = scored
      .filter((recallCase) => observedOutcome(recallCase) !== "scores")
      .map((recallCase) => `  ${recallCase.source}: "${recallCase.quote}"`)
      .join("\n");
    assert.ok(
      recall >= RECALL_FLOOR,
      `recall ${recall.toFixed(2)} fell below the pinned floor ` +
        `${RECALL_FLOOR}. Capability reports that stopped scoring:\n${misses}`,
    );
  });

  it("never records anything from messages that are not about a child's ability", () => {
    const respected = ignored.filter(
      (recallCase) => observedOutcome(recallCase) === "ignores",
    );
    const precision = rate(respected.length, ignored.length);
    const leaks = ignored
      .filter((recallCase) => observedOutcome(recallCase) !== "ignores")
      .map(
        (recallCase) =>
          `  "${recallCase.quote}" -> ${observedOutcome(recallCase)}`,
      )
      .join("\n");
    assert.ok(
      precision >= PRECISION_FLOOR,
      `precision ${precision.toFixed(2)} fell below ${PRECISION_FLOOR}. ` +
        `Messages that should never touch the record:\n${leaks}`,
    );
  });

  it("never records a stronger answer than the parent's words support", () => {
    // Polarity, not recall: a matched sentence that records the wrong
    // tier puts a claim on the child's record the mother never made.
    // Before 2026-07-21 any match without a negative word recorded
    // "easily", so "struggled to read" asserted mastery.
    const wrong: string[] = [];
    for (const recallCase of JOURNAL_RECALL_CORPUS) {
      if (!recallCase.wantAnswer) continue;
      const result = matchJournalEvidence({
        quote: recallCase.quote,
        childName: recallCase.childName,
      });
      if (
        result.classification !== "matched" &&
        result.classification !== "matched_many"
      ) {
        continue; // a miss is a recall problem, measured separately
      }
      for (const match of result.matches) {
        if (match.answer !== recallCase.wantAnswer) {
          wrong.push(
            `  "${recallCase.quote}" recorded ${match.answer} on ` +
              `${match.itemId}, expected ${recallCase.wantAnswer}`,
          );
        }
      }
    }
    assert.deepEqual(wrong, [], `\n${wrong.join("\n")}`);
  });

  it("never credits one child for another child's milestone", () => {
    // The sibling-comparison law's data-side twin: the strongest
    // possible precision case, called out on its own so a recall
    // change can never quietly break it.
    const result = matchJournalEvidence({
      quote: "Her cousin Ellie read a whole chapter book at six",
      childName: "Emma",
    });
    assert.notEqual(result.classification, "matched");
    assert.notEqual(result.classification, "matched_many");
  });

  it("reports the current numbers so a reader sees the gap", () => {
    // Not an assertion, a receipt: the audit's headline finding is that
    // this number is near zero, and it should be visible in test output
    // every time the suite runs.
    const hits = scored.filter(
      (recallCase) => observedOutcome(recallCase) === "scores",
    ).length;
    const respected = ignored.filter(
      (recallCase) => observedOutcome(recallCase) === "ignores",
    ).length;
    console.log(
      `  journal matcher: recall ${hits}/${scored.length}` +
        ` (${(rate(hits, scored.length) * 100).toFixed(0)}%),` +
        ` precision ${respected}/${ignored.length}` +
        ` (${(rate(respected, ignored.length) * 100).toFixed(0)}%)`,
    );
  });
});
