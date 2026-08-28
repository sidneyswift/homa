/**
 * The shared tokenizer for journal-adjacent text (AGENTS.md "Models
 * judge, code verifies": the scoring matcher this file used to contain
 * has been retired, since token-overlap scoring is exactly the pattern
 * matching that law forbids for deciding what a sentence means).
 *
 * `JournalEvidenceMatch` and `normalizeMeaningfulTokens` survive because
 * two things still need them, neither of which is judgment:
 *   - the observation-ledger result types still describe a shape a
 *     historical matcher-classified row can carry
 *     (progress-service.ts's JournalNonWriteResult)
 *   - lesson listen's provenance gate (lessons/pairs.ts) reuses the
 *     same normalization to check that a proposed clause stays close to
 *     its verbatim transcript excerpt, which is exact-string
 *     verification, not interpretation
 */

export interface JournalEvidenceMatch {
  itemId: string;
  score: number;
  answer: "easily" | "getting_there" | "not_yet";
  clause: string;
  span: { start: number; end: number };
}

const MEANINGLESS_TOKENS = new Set([
  "a",
  "about",
  "after",
  "an",
  "and",
  "as",
  "at",
  "by",
  "can",
  "cannot",
  "could",
  "for",
  "from",
  "help",
  "her",
  "his",
  "how",
  "in",
  "into",
  "it",
  "not",
  "of",
  "on",
  "or",
  "out",
  "still",
  "the",
  "their",
  "them",
  "they",
  "to",
  "very",
  "what",
  "with",
  "without",
  "you",
  "your",
]);

const TOKEN_ALIASES: Readonly<Record<string, string>> = {
  aloud: "loud",
  books: "book",
  counted: "count",
  counting: "count",
  counts: "count",
  ended: "end",
  objects: "object",
  pedal: "pedal",
  pedaled: "pedal",
  pedalled: "pedal",
  pedals: "pedal",
  happened: "happen",
  reading: "read",
  reads: "read",
  retells: "retell",
  retold: "retell",
  stories: "story",
  tells: "tell",
  writes: "write",
  wrote: "write",
  // Parents write number words; bank statements and transcripts carry
  // digits ("counted five objects" must meet "Counts ... to 5").
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  hundred: "100",
};

/**
 * The matcher's tokenizer, exported for lesson listen's clause guard
 * (plan 2026-07-13-lesson-listen.md §4.5): the same normalization that
 * used to score bank items also checks that a normalized clause stays
 * close to its verbatim transcript excerpt.
 */
export function normalizeMeaningfulTokens(value: string): Set<string> {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US");
  const words = normalized.match(/[\p{Letter}\p{Number}]+/gu) ?? [];
  return new Set(
    words
      .map((word) => TOKEN_ALIASES[word] ?? word)
      .filter((word) => !MEANINGLESS_TOKENS.has(word)),
  );
}
