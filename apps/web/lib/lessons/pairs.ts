import { createHash } from "node:crypto";

import { normalizeMeaningfulTokens } from "../child-progress/journal-matcher";

/**
 * The lesson listen trust boundary (plan 2026-07-13-lesson-listen.md
 * §4.5, unknowns landmine 1). The synthesis model emits PAIRS: a
 * normalized child-attributed clause in parent-report style (matcher
 * input) plus the verbatim transcript excerpt and segment it came from
 * (provenance). The model has no scoring authority; this module is the
 * gate that keeps invented claims from laundering through
 * normalization:
 *
 *   1. The excerpt must appear verbatim in the segment it claims
 *      (whitespace-insensitive substring, nothing else forgiven).
 *      Checking the claimed segment, not the whole transcript, also
 *      keeps a mislabeled segmentSeq from slipping through.
 *   2. The clause must share enough meaningful tokens with that
 *      segment's transcript, using the SAME tokenizer the journal
 *      matcher scores with. The child's name is exempt: the clause
 *      names the child, dialogue rarely does.
 *
 * Check 2 grounds the clause in the segment, not the excerpt alone,
 * because lesson dialogue splits meaning across speakers: the child's
 * audible utterance is a bare fragment ("four, five.") while the
 * clause describes what it demonstrated. The 2026-07-21 replay of a
 * real lesson showed excerpt-only overlap rejecting 100% of honest
 * pairs (ratios 0.00 to 0.20); against their own segment the same
 * clauses land 0.29 to 0.75 while invented claims still land at 0.
 *
 * Only pairs that survive both checks reach
 * recordJournalProgressEvidence, where the 0.85 matcher still decides
 * whether anything scores.
 */

export interface LessonClausePair {
  /** Parent-report style, child as subject ("Emma read the page"). */
  clause: string;
  /** Verbatim words from the transcript that back the clause. */
  excerpt: string;
  /** Which ~3-minute segment the excerpt came from. */
  segmentSeq: number;
}

/** The per-segment transcripts the gate verifies against. */
export interface LessonSegmentText {
  seq: number;
  transcript: string | null;
}

export type LessonClauseRejection =
  | "empty"
  | "unknown_segment"
  | "excerpt_not_in_segment"
  | "clause_strays_from_segment";

export type LessonClauseVerdict =
  | { ok: true }
  | { ok: false; reason: LessonClauseRejection };

/** One hallucinating pass cannot spray operations (plan §4.5). */
export const MAX_LESSON_CLAUSES = 12;

/**
 * At least this share of the clause's meaningful tokens must appear in
 * the claimed segment's transcript. Calibrated against the 2026-07-21
 * real-lesson replay: honest descriptive clauses score 0.29 to 0.75
 * against their segment; invented claims score 0. Raising it rejects
 * honest description of fragmentary dialogue (numeric utterances share
 * almost no tokens with the words that describe them); lowering it
 * admits clauses the segment does not support.
 */
export const LESSON_SEGMENT_OVERLAP_FLOOR = 0.25;

/**
 * The ratio alone lets one incidental word carry a short clause
 * ("pedaled a two wheeler" passing on a stray "two" in a counting
 * segment), so a claim also needs at least this many shared meaningful
 * tokens, unless at least one shared token comes from the excerpt
 * itself: the excerpt is verbatim-verified provenance, so a token it
 * anchors is evidence, not coincidence ("counted to forty" against the
 * child's own "one, two, three... forty!"). The 2026-07-21 replay's
 * honest clauses share 2 to 3 tokens; invented controls share 0 to 1,
 * never excerpt-anchored.
 */
export const LESSON_SEGMENT_MIN_SHARED_TOKENS = 2;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * verifyLessonClausePair(pair, segments, childName): the two-check
 * gate above. Pure and deterministic so the tests can pin it.
 */
export function verifyLessonClausePair(
  pair: LessonClausePair,
  segments: readonly LessonSegmentText[],
  childName: string,
): LessonClauseVerdict {
  const clause = collapseWhitespace(pair.clause);
  const excerpt = collapseWhitespace(pair.excerpt);
  if (clause.length === 0 || excerpt.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const segmentTranscript = segments.find(
    (segment) => segment.seq === pair.segmentSeq,
  )?.transcript;
  if (!segmentTranscript || segmentTranscript.trim().length === 0) {
    return { ok: false, reason: "unknown_segment" };
  }
  const haystack = collapseWhitespace(segmentTranscript)
    .toLocaleLowerCase("en-US");
  if (!haystack.includes(excerpt.toLocaleLowerCase("en-US"))) {
    return { ok: false, reason: "excerpt_not_in_segment" };
  }
  const childNameTokens = normalizeMeaningfulTokens(childName);
  const clauseTokens = [...normalizeMeaningfulTokens(clause)].filter(
    (token) => !childNameTokens.has(token),
  );
  if (clauseTokens.length === 0) {
    return { ok: false, reason: "clause_strays_from_segment" };
  }
  const segmentTokens = normalizeMeaningfulTokens(segmentTranscript);
  const excerptTokens = normalizeMeaningfulTokens(excerpt);
  const shared = clauseTokens.filter((token) =>
    segmentTokens.has(token),
  ).length;
  const sharedWithExcerpt = clauseTokens.filter((token) =>
    excerptTokens.has(token),
  ).length;
  if (
    (shared < LESSON_SEGMENT_MIN_SHARED_TOKENS &&
      sharedWithExcerpt === 0) ||
    shared / clauseTokens.length < LESSON_SEGMENT_OVERLAP_FLOOR
  ) {
    return { ok: false, reason: "clause_strays_from_segment" };
  }
  return { ok: true };
}

/**
 * lessonClauseIdempotencyKey(lessonId, clause): stable across retried
 * analysis passes regardless of clause order or count (unknowns
 * landmine 3). Hashing the normalized clause means the same finding
 * re-emitted by a retry replays instead of double-writing.
 */
export function lessonClauseIdempotencyKey(
  lessonId: string,
  clause: string,
): string {
  const normalized = collapseWhitespace(clause).toLocaleLowerCase("en-US");
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `lesson:${lessonId}:${digest}`;
}
