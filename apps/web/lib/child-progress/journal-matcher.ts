import {
  MAP_SUBJECTS,
  type MapItem,
} from "@homa/core";

import { AGENT_CHECK_IN_EXCLUDED_ITEM_IDS } from "./check-in-selection";
import { classifyJournalEvidence } from "./evidence-policy";

export const JOURNAL_MATCH_HIGH_CONFIDENCE_SCORE = 0.85;
export const JOURNAL_MATCH_AMBIGUOUS_SCORE = 0.45;
export const JOURNAL_MATCH_NEAR_TIE_DELTA = 0.08;

export interface JournalEvidenceMatch {
  itemId: string;
  score: number;
  answer: "easily" | "getting_there" | "not_yet";
  clause: string;
  span: { start: number; end: number };
}

interface JournalAliasRule {
  itemId: string;
  requiredTokens: readonly string[];
  score: number;
}

type ScoredJournalCandidate = JournalEvidenceMatch;

interface ChildAttributedPredicate {
  clause: string;
  content: string;
  span: { start: number; end: number };
  answer: JournalEvidenceMatch["answer"];
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

const JOURNAL_ALIAS_RULES: readonly JournalAliasRule[] = [
  {
    itemId: "literacy.emergent-reader",
    requiredTokens: ["read", "book"],
    score: 0.96,
  },
  {
    itemId: "literacy.retells-story",
    requiredTokens: ["retell", "plot"],
    score: 0.9,
  },
  {
    itemId: "literacy.retells-story",
    requiredTokens: ["retell", "story"],
    score: 0.9,
  },
  {
    itemId: "gross_motor.pedals",
    requiredTokens: ["pedal"],
    score: 0.98,
  },
  {
    itemId: "math.how-many-5",
    requiredTokens: ["count", "5", "object"],
    score: 0.97,
  },
  {
    itemId: "writing.writes-name",
    requiredTokens: ["write", "name"],
    score: 0.97,
  },
];

export const JOURNAL_NO_MATCH_CANDIDATE_LIMIT = 3;

export type JournalEvidenceMatchResult =
  | { classification: "activity_only"; matches: [] }
  | {
      classification: "no_match";
      matches: [];
      /**
       * The nearest bank items even though none crossed the match
       * threshold. The observation ledger keeps them as tags
       * (plan 2026-07-13-observation-ledger.md); they never score.
       */
      candidates: JournalEvidenceMatch[];
    }
  | {
      classification: "matched";
      matches: [JournalEvidenceMatch];
    }
  | {
      classification: "matched_many";
      matches: [JournalEvidenceMatch, ...JournalEvidenceMatch[]];
    }
  | {
      classification: "ambiguous";
      matches: JournalEvidenceMatch[];
    };

function compareAsciiIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * The matcher's tokenizer, exported for lesson listen's clause guard
 * (plan 2026-07-13-lesson-listen.md §4.5): the same normalization that
 * scores bank items also checks that a normalized clause stays close
 * to its verbatim transcript excerpt.
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

const PREDICATE_SEPARATOR_PATTERN =
  /[.!?;]+|,\s*(?:(?:and|but|while|whereas|because)\s+)?|\s+\b(?:and|but|while|whereas|because)\b\s+/giu;
const OTHER_ACTOR_PATTERN =
  /^([\p{Lu}][\p{L}\p{M}'’-]*)\s+(?=(?:still\s+)?(?:can|cannot|can't|could|couldn't|read|reads|retell|retold|write|wrote|count|counted|pedal|pedaled|solve|solved|swim|swam)\b)/u;
const EMBEDDED_ACTOR_TOKEN_PATTERN =
  /\b(?:[\p{Lu}][\p{L}\p{M}'’-]*|mom|dad|mother|father|parent|teacher|tutor|coach|grandma|grandpa)\b/gu;
const ADULT_ROLE_TOKENS = new Set([
  "mom",
  "dad",
  "mother",
  "father",
  "parent",
  "teacher",
  "tutor",
  "coach",
  "grandma",
  "grandpa",
]);
const NEGATIVE_PREDICATE_PATTERN =
  /\b(?:cannot|can't|could\s+not|couldn't|did\s+not|does\s+not|not\s+yet|not\s+(?:read|retell|write|count|pedal|solve|swim)|needs?\s+help)\b/iu;
const EMERGING_PREDICATE_PATTERN =
  /\b(?:almost|starting\s+to|with\s+(?:(?:some|lots\s+of|a\s+lot\s+of)\s+)?help)\b/iu;

function inferPredicateAnswer(
  predicate: string,
): JournalEvidenceMatch["answer"] {
  if (NEGATIVE_PREDICATE_PATTERN.test(predicate)) return "not_yet";
  if (EMERGING_PREDICATE_PATTERN.test(predicate)) {
    return "getting_there";
  }
  return "easily";
}

function trimPredicateSpan(
  quote: string,
  start: number,
  end: number,
): { start: number; end: number } | null {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (
    trimmedStart < trimmedEnd &&
    /\s/u.test(quote[trimmedStart])
  ) {
    trimmedStart += 1;
  }
  while (
    trimmedEnd > trimmedStart &&
    /\s/u.test(quote[trimmedEnd - 1])
  ) {
    trimmedEnd -= 1;
  }
  return trimmedStart === trimmedEnd
    ? null
    : { start: trimmedStart, end: trimmedEnd };
}

function childAttributedPredicates(
  quote: string,
  childName: string,
): ChildAttributedPredicate[] {
  const trimmedName = childName.trim();
  if (trimmedName.length === 0) return [];
  const escapedName = escapeRegularExpression(trimmedName);
  const childActorPattern = new RegExp(
    `^${escapedName}(?![\\p{L}\\p{N}_])\\s+`,
    "iu",
  );
  const childNameTokens = new Set(
    trimmedName
      .toLocaleLowerCase("en-US")
      .match(/[\p{Letter}\p{Number}]+/gu) ?? [],
  );
  const predicates: ChildAttributedPredicate[] = [];
  let inheritedActor: "child" | "other" | null = null;
  let cursor = 0;

  const addSegment = (segmentStart: number, segmentEnd: number) => {
    let span = trimPredicateSpan(quote, segmentStart, segmentEnd);
    if (span === null) return;
    let clause = quote.slice(span.start, span.end);
    const childActor = childActorPattern.exec(clause);
    const otherActor = OTHER_ACTOR_PATTERN.exec(clause);
    let actor = inheritedActor;
    let content = clause;
    if (childActor !== null) {
      actor = "child";
      content = clause.slice(childActor[0].length);
    } else if (otherActor !== null) {
      actor = "other";
      content = clause.slice(otherActor[0].length);
    }
    inheritedActor = actor;
    if (actor !== "child") return;
    const embeddedActor = Array.from(
      content.matchAll(EMBEDDED_ACTOR_TOKEN_PATTERN),
    ).find((match) => {
      const token = match[0].toLocaleLowerCase("en-US");
      return (
        ADULT_ROLE_TOKENS.has(token) ||
        !childNameTokens.has(token)
      );
    });
    if (embeddedActor !== undefined) {
      const contentOffset = clause.length - content.length;
      const cutoff =
        span.start + contentOffset + embeddedActor.index;
      const childOnlySpan = trimPredicateSpan(
        quote,
        span.start,
        cutoff,
      );
      if (childOnlySpan === null) return;
      span = childOnlySpan;
      clause = quote.slice(span.start, span.end);
      content = content.slice(0, embeddedActor.index).trimEnd();
    }
    predicates.push({
      clause,
      content,
      span,
      answer: inferPredicateAnswer(content),
    });
  };

  for (const separator of quote.matchAll(PREDICATE_SEPARATOR_PATTERN)) {
    const separatorStart = separator.index;
    addSegment(cursor, separatorStart);
    if (
      /[.!?;]/u.test(separator[0]) ||
      /\b(?:while|whereas|because)\b/iu.test(separator[0])
    ) {
      inheritedActor = null;
    }
    cursor = separatorStart + separator[0].length;
  }
  addSegment(cursor, quote.length);
  return predicates;
}

function aliasScoreForItem(
  itemId: string,
  quoteTokens: ReadonlySet<string>,
): number {
  let score = 0;
  for (const rule of JOURNAL_ALIAS_RULES) {
    if (
      rule.itemId === itemId &&
      rule.requiredTokens.every((token) => quoteTokens.has(token))
    ) {
      score = Math.max(score, rule.score);
    }
  }
  return score;
}

function overlapScore(
  item: MapItem,
  quoteTokens: ReadonlySet<string>,
): number {
  const statementTokens = normalizeMeaningfulTokens(item.statement);
  if (statementTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of statementTokens) {
    if (quoteTokens.has(token)) overlap += 1;
  }
  return overlap / statementTokens.size;
}

function scoreCandidates(input: {
  predicate: ChildAttributedPredicate;
  subjectId?: string;
}): ScoredJournalCandidate[] {
  const quoteTokens = normalizeMeaningfulTokens(input.predicate.content);
  return MAP_SUBJECTS
    .filter(
      (subject) =>
        input.subjectId === undefined ||
        subject.id === input.subjectId,
    )
    .flatMap((subject) => subject.items)
    .filter(
      (item) => !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id),
    )
    .map((item) => {
      const aliasScore = aliasScoreForItem(item.id, quoteTokens);
      return {
        itemId: item.id,
        score: Math.max(
          overlapScore(item, quoteTokens),
          aliasScore,
        ),
        answer: input.predicate.answer,
        clause: input.predicate.clause,
        span: input.predicate.span,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareAsciiIds(left.itemId, right.itemId),
    );
}

function publicMatch(
  candidate: ScoredJournalCandidate,
): JournalEvidenceMatch {
  return {
    itemId: candidate.itemId,
    score: candidate.score,
    answer: candidate.answer,
    clause: candidate.clause,
    span: candidate.span,
  };
}

function topScoredCandidates(
  candidates: readonly ScoredJournalCandidate[],
  limit: number,
): JournalEvidenceMatch[] {
  const bestByItem = new Map<string, ScoredJournalCandidate>();
  for (const candidate of candidates) {
    const existing = bestByItem.get(candidate.itemId);
    if (existing === undefined || candidate.score > existing.score) {
      bestByItem.set(candidate.itemId, candidate);
    }
  }
  return [...bestByItem.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareAsciiIds(left.itemId, right.itemId),
    )
    .slice(0, limit)
    .map(publicMatch);
}

/**
 * Matches a named child's concrete journal clause to reviewed bank items.
 * Activity-only text exits before any bank matching work.
 */
export function matchJournalEvidence(input: {
  quote: string;
  childName: string;
  subjectId?: string;
}): JournalEvidenceMatchResult {
  const classification = classifyJournalEvidence({
    quote: input.quote,
    childName: input.childName,
  });
  if (classification === "activity_only") {
    return { classification, matches: [] };
  }
  const predicates = childAttributedPredicates(
    input.quote,
    input.childName,
  );
  const selected: JournalEvidenceMatch[] = [];
  const ambiguous: JournalEvidenceMatch[] = [];
  const allScored: ScoredJournalCandidate[] = [];

  for (const predicate of predicates) {
    const candidates = scoreCandidates({
      predicate,
      subjectId: input.subjectId,
    });
    allScored.push(...candidates);
    const strong = candidates.filter(
      (candidate) =>
        candidate.score >= JOURNAL_MATCH_HIGH_CONFIDENCE_SCORE,
    );
    if (strong.length > 1) {
      ambiguous.push(...strong.map(publicMatch));
      continue;
    }
    if (strong.length === 1) {
      const second = candidates[1];
      if (
        second !== undefined &&
        second.score >= JOURNAL_MATCH_AMBIGUOUS_SCORE &&
        strong[0].score - second.score <=
          JOURNAL_MATCH_NEAR_TIE_DELTA
      ) {
        ambiguous.push(
          ...candidates
            .filter(
              (candidate) =>
                candidate.score >= JOURNAL_MATCH_AMBIGUOUS_SCORE,
            )
            .map(publicMatch),
        );
      } else {
        selected.push(publicMatch(strong[0]));
      }
      continue;
    }
    ambiguous.push(
      ...candidates
        .filter(
          (candidate) =>
            candidate.score >= JOURNAL_MATCH_AMBIGUOUS_SCORE,
        )
        .map(publicMatch),
    );
  }

  const selectedByItem = new Map<string, JournalEvidenceMatch>();
  for (const match of selected) {
    const existing = selectedByItem.get(match.itemId);
    if (existing !== undefined && existing.answer !== match.answer) {
      ambiguous.push(existing, match);
      selectedByItem.delete(match.itemId);
    } else if (
      existing === undefined ||
      match.score > existing.score
    ) {
      selectedByItem.set(match.itemId, match);
    }
  }
  const matches = [...selectedByItem.values()];
  if (ambiguous.length > 0) {
    return {
      classification: "ambiguous",
      matches: [...matches, ...ambiguous],
    };
  }
  if (matches.length === 0) {
    return {
      classification: "no_match",
      matches: [],
      candidates: topScoredCandidates(
        allScored,
        JOURNAL_NO_MATCH_CANDIDATE_LIMIT,
      ),
    };
  }
  if (matches.length === 1) {
    return { classification: "matched", matches: [matches[0]] };
  }
  return {
    classification: "matched_many",
    matches: matches as [
      JournalEvidenceMatch,
      ...JournalEvidenceMatch[],
    ],
  };
}
