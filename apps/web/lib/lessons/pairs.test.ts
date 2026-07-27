import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LESSON_SEGMENT_MIN_SHARED_TOKENS,
  LESSON_SEGMENT_OVERLAP_FLOOR,
  lessonClauseIdempotencyKey,
  verifyLessonClausePair,
} from "./pairs";

/**
 * The lesson trust boundary's teeth (plan 2026-07-13-lesson-listen.md
 * §4.5, recalibrated 2026-07-21): a model-emitted clause reaches the
 * progress ledger only when its excerpt really appears verbatim in the
 * segment it claims AND the clause stays lexically grounded in that
 * segment's dialogue. The dialogue fixtures mirror the shapes from the
 * 2026-07-21 real-lesson replay (letter sounds, sounding out, counting
 * runs, coin counting) where the old excerpt-only floor rejected every
 * honest pair.
 */

const SEGMENTS = [
  {
    seq: 1,
    transcript:
      "Ok, try the next page. One, two, three... forty! " +
      "You read the whole page out loud, no help at all.",
  },
  {
    seq: 2,
    transcript:
      "What sound does this letter make? Look at the letter. " +
      "What sound does this letter make? Um, N. N. " +
      "Let's put it all together. The man. That's it. " +
      "I don't want to do subtraction. Two more, then beads.",
  },
  {
    seq: 3,
    transcript:
      "We're not guessing. We have to read the word. " +
      "What word is this? It's a dog. It's not a dog. " +
      "Look at the word. Sound it out. I fed the... I fed the... " +
      "How many coins do you have? Count properly please. " +
      "18 19 20 11 12 14 16 17 18 19 20 11 and 12. " +
      "Try again. One, two, three, four, five. Very good. " +
      "Can you color five boxes?",
  },
] as const;

describe("verifyLessonClausePair", () => {
  it("accepts a clause grounded in its segment's dialogue", () => {
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma read the whole page out loud with no help",
        excerpt: "you read the whole page out loud, no help at all",
        segmentSeq: 1,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, { ok: true });
  });

  it("accepts a fragment-answer pair because the segment carries the meaning", () => {
    // The 2026-07-21 failure shape: the child's audible utterance is a
    // bare fragment, the clause describes what it demonstrated, and the
    // surrounding dialogue holds the describing words.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma identified the letter sound for n after a few tries",
        excerpt: "Um, N. N.",
        segmentSeq: 2,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, { ok: true });
  });

  it("accepts a numeric counting clause against its counting segment", () => {
    // Number utterances share no tokens with the words that describe
    // them; number-word aliases plus segment grounding carry it.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma counted successfully up to five coins",
        excerpt: "One, two, three, four, five.",
        segmentSeq: 3,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, { ok: true });
  });

  it("rejects an excerpt that never happened", () => {
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma solved every subtraction problem easily",
        excerpt: "she solved every subtraction problem easily",
        segmentSeq: 2,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, {
      ok: false,
      reason: "excerpt_not_in_segment",
    });
  });

  it("rejects a real excerpt claimed for the wrong segment", () => {
    // The verbatim check runs against the CLAIMED segment, so a
    // mislabeled segmentSeq no longer slips through on a whole-
    // transcript match.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma read the whole page out loud with no help",
        excerpt: "you read the whole page out loud, no help at all",
        segmentSeq: 2,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, {
      ok: false,
      reason: "excerpt_not_in_segment",
    });
  });

  it("rejects a segment number that does not exist", () => {
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma read the whole page",
        excerpt: "you read the whole page",
        segmentSeq: 9,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, { ok: false, reason: "unknown_segment" });
  });

  it("rejects a clause laundered onto an unrelated real excerpt", () => {
    // The excerpt is genuinely in the segment, but nothing in that
    // segment's dialogue supports the claim: invention still scores 0.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma multiplied fractions confidently",
        excerpt: "ok, try the next page",
        segmentSeq: 1,
      },
      SEGMENTS,
      "Emma",
    );
    assert.deepEqual(verdict, {
      ok: false,
      reason: "clause_strays_from_segment",
    });
  });

  it("survives whitespace and case differences in the excerpt", () => {
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma counted to forty",
        excerpt: "One,  two, three... FORTY!",
        segmentSeq: 1,
      },
      SEGMENTS,
      "Emma",
    );
    assert.equal(verdict.ok, true);
  });

  it("does not let the child's name carry the overlap", () => {
    // Every clause names the child; the name is excluded from overlap
    // math so "Emma <invented thing>" cannot pass on the name alone.
    // The minimum-shared-tokens rule also keeps the stray "two" in
    // segment 1's counting from carrying the whole claim.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma pedaled a two wheeler",
        excerpt: "try the next page",
        segmentSeq: 1,
      },
      SEGMENTS,
      "Emma",
    );
    assert.equal(verdict.ok, false);
  });

  it("rejects empty pieces", () => {
    assert.deepEqual(
      verifyLessonClausePair(
        { clause: "  ", excerpt: "try the next page", segmentSeq: 1 },
        SEGMENTS,
        "Emma",
      ),
      { ok: false, reason: "empty" },
    );
  });

  it("keeps the pinned overlap floor and minimum shared tokens", () => {
    // Both are product policy (§4.5, recalibrated 2026-07-21 from the
    // real-lesson replay: honest clauses land 0.29 to 0.75 and share 2
    // to 3 tokens against their segment, invention lands 0 to 1);
    // moving either is a decision, not a drive-by. This assertion
    // makes the change loud.
    assert.equal(LESSON_SEGMENT_OVERLAP_FLOOR, 0.25);
    assert.equal(LESSON_SEGMENT_MIN_SHARED_TOKENS, 2);
  });
});

describe("lessonClauseIdempotencyKey", () => {
  it("is stable across whitespace and case variants of the clause", () => {
    const first = lessonClauseIdempotencyKey(
      "lesson-1",
      "Emma read the  whole page",
    );
    const second = lessonClauseIdempotencyKey(
      "lesson-1",
      "emma read the whole page",
    );
    assert.equal(first, second);
  });

  it("differs across lessons and across clauses", () => {
    const base = lessonClauseIdempotencyKey("lesson-1", "Emma counted");
    assert.notEqual(
      base,
      lessonClauseIdempotencyKey("lesson-2", "Emma counted"),
    );
    assert.notEqual(
      base,
      lessonClauseIdempotencyKey("lesson-1", "Emma wrote her name"),
    );
  });

  it("names the lesson so replays are auditable", () => {
    assert.match(
      lessonClauseIdempotencyKey("lesson-1", "Emma counted"),
      /^lesson:lesson-1:[a-f0-9]{64}$/,
    );
  });
});
