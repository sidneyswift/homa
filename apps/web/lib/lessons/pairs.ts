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
 *   1. The excerpt must appear verbatim in the assembled transcript
 *      (whitespace-insensitive substring, nothing else forgiven).
 *   2. The clause must share enough meaningful tokens with its own
 *      excerpt, using the SAME tokenizer the journal matcher scores
 *      with. The child's name is exempt: the clause names the child,
 *      dialogue rarely does.
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

export type LessonClauseRejection =
  | "empty"
  | "excerpt_not_in_transcript"
  | "clause_strays_from_excerpt";

export type LessonClauseVerdict =
  | { ok: true }
  | { ok: false; reason: LessonClauseRejection };

/** One hallucinating pass cannot spray operations (plan §4.5). */
export const MAX_LESSON_CLAUSES = 12;

/**
 * The clause may rephrase the excerpt into parent-report grammar, but
 * at least this share of its meaningful tokens must come from the
 * excerpt itself. Pinned by tests; raising it rejects more paraphrase,
 * lowering it admits more invention.
 */
export const CLAUSE_TOKEN_OVERLAP_FLOOR = 0.5;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * verifyLessonClausePair(pair, transcript, childName): the two-check
 * gate above. Pure and deterministic so the tests can pin it.
 */
export function verifyLessonClausePair(
  pair: LessonClausePair,
  transcript: string,
  childName: string,
): LessonClauseVerdict {
  const clause = collapseWhitespace(pair.clause);
  const excerpt = collapseWhitespace(pair.excerpt);
  if (clause.length === 0 || excerpt.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const haystack = collapseWhitespace(transcript).toLocaleLowerCase("en-US");
  if (!haystack.includes(excerpt.toLocaleLowerCase("en-US"))) {
    return { ok: false, reason: "excerpt_not_in_transcript" };
  }
  const childNameTokens = normalizeMeaningfulTokens(childName);
  const clauseTokens = [...normalizeMeaningfulTokens(clause)].filter(
    (token) => !childNameTokens.has(token),
  );
  if (clauseTokens.length === 0) {
    return { ok: false, reason: "clause_strays_from_excerpt" };
  }
  const excerptTokens = normalizeMeaningfulTokens(excerpt);
  const shared = clauseTokens.filter((token) =>
    excerptTokens.has(token),
  ).length;
  if (shared / clauseTokens.length < CLAUSE_TOKEN_OVERLAP_FLOOR) {
    return { ok: false, reason: "clause_strays_from_excerpt" };
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
