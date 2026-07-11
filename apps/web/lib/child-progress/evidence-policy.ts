import type { MapAnswer } from "@homa/core";

import type { ProgressEvidenceAnswer } from "./types";

const TIMED_ACTIVITY_PATTERN =
  /(?=.*\b\d+\s*(?:minutes?|hours?)\b)(?=.*\b(?:read|math|science|school)\b)/iu;
const GENERAL_ACTIVITY_PATTERN =
  /\bwe (?:did|read|worked on|practiced|studied)\b/iu;
const PASSIVE_ACTIVITY_PATTERN =
  /\b(?:watched|listened to)\b.*\b(?:video|lesson|podcast)\b/iu;
const CONCRETE_SKILL_PATTERNS = [
  /\bread\b[^.!?]*\b(?:retold|explained)\b/iu,
  /\b(?:can|cannot|can't|could)\s+(?:still\s+)?(?:read|write|count|solve|retell|explain|build|pedal|swim)\w*\b/iu,
  /\b(?:read|write|count|solve|retell|retold|explain|build|pedal|swim)\w*\b[^.!?]*\b(?:without help|by themself|on their own)\b/iu,
] as const;
const CONCRETE_SKILL_SOURCE = CONCRETE_SKILL_PATTERNS
  .map((pattern) => pattern.source)
  .join("|");

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function hasDirectChildPerformance(
  quote: string,
  escapedChildName: string,
): boolean {
  const childSubject =
    `(?:^|[.!?;,]\\s*|\\b(?:and|but)\\s+)${escapedChildName}` +
    `(?![\\p{L}\\p{N}_])\\s+`;
  return new RegExp(
    `${childSubject}(?:${CONCRETE_SKILL_SOURCE})`,
    "iu",
  ).test(quote);
}

function hasChildAttributedConcreteSkill(
  quote: string,
  childName: string,
): boolean {
  const trimmedChildName = childName.trim();
  if (trimmedChildName.length === 0) return false;
  const escapedChildName = escapeRegularExpression(trimmedChildName);
  return hasDirectChildPerformance(quote, escapedChildName);
}

export function isProgressEvidenceAnswer(
  answer: MapAnswer,
): answer is ProgressEvidenceAnswer {
  return (
    answer === "easily" ||
    answer === "getting_there" ||
    answer === "not_yet"
  );
}

export function classifyJournalEvidence(
  input: { quote: string; childName: string },
): "activity_only" | "concrete_skill" | "unclear" {
  const { quote, childName } = input;
  if (hasChildAttributedConcreteSkill(quote, childName)) {
    return "concrete_skill";
  }
  if (
    TIMED_ACTIVITY_PATTERN.test(quote) ||
    GENERAL_ACTIVITY_PATTERN.test(quote) ||
    PASSIVE_ACTIVITY_PATTERN.test(quote)
  ) {
    return "activity_only";
  }
  return "unclear";
}
