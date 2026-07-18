export type ReplyKind = "yes_no" | "free_text" | "choice" | "approval";
export type ReplyOutcome = "accepted" | "declined" | "answered";

export const REPLY_CLASSIFIER_VERSION = "reply-intent-v2";

const MAX_POLARITY_REPLY_CHARS = 160;
const AFFIRMATIVE_EMOJI = /^👍[\u{1F3FB}-\u{1F3FF}]?$/u;
const NEGATIVE_EMOJI = /^👎[\u{1F3FB}-\u{1F3FF}]?$/u;

const AFFIRMATIVE_PHRASES = new Set([
  "yes",
  "yes please",
  "yes, please",
  "yep",
  "yeah",
  "yup",
  "sure",
  "okay",
  "ok",
  "absolutely",
  "definitely",
  "please do",
  "go ahead",
  "do it",
  "send it",
  "make it",
  "create it",
  "set it up",
  "schedule it",
  "sounds good",
  "that sounds good",
  "sounds great",
  "that sounds great",
  "i'd love that",
  "i would love that",
  "that would be great",
  "perfect",
  "no problem",
  "why not",
]);

const DECLINE_PHRASES = new Set([
  "no",
  "no thanks",
  "no, thanks",
  "nope",
  "nah",
  "not now",
  "not today",
  "not this time",
  "maybe later",
  "later",
  "we're good",
  "we are good",
  "no need",
  "skip it",
  "pass",
]);

function normalizeReplyText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("’", "'")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\s*,\s*/gu, ", ");
}

function classifyBoundedPolarity(text: string): ReplyOutcome {
  const normalized = normalizeReplyText(text);
  const phrase = normalized.replace(/[.!?]+$/gu, "");

  if (AFFIRMATIVE_EMOJI.test(normalized) || AFFIRMATIVE_PHRASES.has(phrase)) {
    return "accepted";
  }
  if (NEGATIVE_EMOJI.test(normalized) || DECLINE_PHRASES.has(phrase)) {
    return "declined";
  }
  if (
    normalized.length === 0 ||
    normalized.length > MAX_POLARITY_REPLY_CHARS ||
    normalized.includes("?")
  ) {
    return "answered";
  }

  const affirmativeAction =
    /^(?:yes|yep|yeah|yup|sure|okay|ok|absolutely|definitely)(?:,?\s+please)?(?:,?\s+(?:do|make|send|create|set|schedule|go\s+ahead)\b.*)$/u.test(
      phrase,
    );
  const hasNegative =
    /\b(?:no|nope|nah|not|never|don't|do not)\b/u.test(phrase);
  const hasMixedIntent =
    /\b(?:but|however|instead|maybe|unless|not sure)\b/u.test(phrase);

  if (affirmativeAction && !hasNegative && !hasMixedIntent) {
    return "accepted";
  }
  if (
    /^(?:no|nope|nah)\b/u.test(phrase) ||
    /^(?:not (?:now|today|this time)|maybe later|skip it|pass)\b/u.test(phrase)
  ) {
    return "declined";
  }
  return "answered";
}

export function classifyReplyOutcome(
  replyKind: ReplyKind,
  text: string,
): ReplyOutcome {
  switch (replyKind) {
    case "yes_no":
    case "approval":
      return classifyBoundedPolarity(text);
    case "free_text":
    case "choice":
      return "answered";
    default: {
      const exhaustive: never = replyKind;
      return exhaustive;
    }
  }
}
