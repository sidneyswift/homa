import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLAUSE_TOKEN_OVERLAP_FLOOR,
  lessonClauseIdempotencyKey,
  verifyLessonClausePair,
} from "./pairs";

/**
 * The lesson trust boundary's teeth (plan 2026-07-13-lesson-listen.md
 * §4.5): a model-emitted clause reaches the progress ledger only when
 * its excerpt really appears in the transcript AND the clause stays
 * lexically anchored to that excerpt.
 */

const TRANSCRIPT = [
  "[Segment 1, about minute 0]",
  "Mom: ok, try the next page. Kid: one, two, three... forty!",
  "Mom: you read the whole page out loud, no help at all.",
  "[Segment 2, about minute 3]",
  "Kid: I don't want to do subtraction. Mom: two more, then beads.",
].join("\n");

describe("verifyLessonClausePair", () => {
  it("accepts a clause grounded in a verbatim excerpt", () => {
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma read the whole page out loud with no help",
        excerpt: "you read the whole page out loud, no help at all",
        segmentSeq: 1,
      },
      TRANSCRIPT,
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
      TRANSCRIPT,
      "Emma",
    );
    assert.deepEqual(verdict, {
      ok: false,
      reason: "excerpt_not_in_transcript",
    });
  });

  it("rejects a clause laundered onto an unrelated real excerpt", () => {
    // The excerpt is genuinely in the transcript, but the clause claims
    // something the excerpt does not say: the overlap floor catches it.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma multiplied fractions confidently",
        excerpt: "ok, try the next page",
        segmentSeq: 1,
      },
      TRANSCRIPT,
      "Emma",
    );
    assert.deepEqual(verdict, {
      ok: false,
      reason: "clause_strays_from_excerpt",
    });
  });

  it("survives whitespace and case differences in the excerpt", () => {
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma counted to forty",
        excerpt: "One,  two, three... FORTY!",
        segmentSeq: 1,
      },
      TRANSCRIPT,
      "Emma",
    );
    assert.equal(verdict.ok, true);
  });

  it("does not let the child's name carry the overlap", () => {
    // Every clause names the child; the name is excluded from overlap
    // math so "Emma <invented thing>" cannot pass on the name alone.
    const verdict = verifyLessonClausePair(
      {
        clause: "Emma pedaled a two wheeler",
        excerpt: "try the next page",
        segmentSeq: 1,
      },
      TRANSCRIPT,
      "Emma",
    );
    assert.equal(verdict.ok, false);
  });

  it("rejects empty pieces", () => {
    assert.deepEqual(
      verifyLessonClausePair(
        { clause: "  ", excerpt: "try the next page", segmentSeq: 1 },
        TRANSCRIPT,
        "Emma",
      ),
      { ok: false, reason: "empty" },
    );
  });

  it("keeps the pinned overlap floor", () => {
    // The floor is product policy (§4.5); moving it is a decision, not
    // a drive-by. This assertion makes the change loud.
    assert.equal(CLAUSE_TOKEN_OVERLAP_FLOOR, 0.5);
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
