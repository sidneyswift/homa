import { MAX_SMS_SEGMENTS, smsSegmentCount } from "../sms-segments";

const EXACT_LINE_COUNT = 7;
const HEADLINE =
  /^(Last night|This morning) I researched (\S(?:.*\S)?)$/u;
const LEARNED_BLOCK = /^What I learned: (\S(?:.*\S)?)$/u;
const INTERESTING_BLOCK = /^Why it's interesting: (\S(?:.*\S)?)$/u;
const CTA_BLOCK = /^Want me to (\S(?:.*\S)?)\?$/u;
const CREATIVE_ACTIVITY_CTA =
  /^(?:make|design|create|build|write)\s+(?:\p{Lu}[\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*){0,2}\s+)?(?:a|an)\s+(?:(?!for\b|with\b)[\p{L}0-9'-]+\s+)*(?:game|activity|printable|worksheet|word strip|practice sheet)(?:\s+with\s+[\p{L}0-9'",-]+(?:\s+[\p{L}0-9'",-]+)*)?\s+for\s+([\p{L}0-9'"-]+(?:\s+[\p{L}0-9'"-]+)+)$/u;
const REMINDER_OR_TASK_CTA =
  /^(?:set|create|make|schedule)\s+(?:\p{Lu}[\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*){0,2}\s+)?(?:a\s+)?(?:(?!for\b)[\p{L}0-9'-]+\s+)*(?:reminder|task)\s+for\s+([\p{L}0-9'"-]+(?:\s+[\p{L}0-9'"-]+)+)$/u;
const FORBIDDEN_CTA_PURPOSE =
  /\b(?:game|activity|printable|worksheet|word strip|practice sheet|reminder|task|make|design|create|build|write|turn|set|schedule|add|put|buy|send|email|text|order|purchase|rent|teach)\b|\s(?:and|or|then)\s/iu;
const COMPOUND_CTA =
  /\s(?:and|or|then)\s+(?:(?:make|design|create|build|write|turn|set|schedule|add|put|buy|send|email|text|order|purchase|rent|teach)\s+)?(?:a|an)\s+(?:game|activity|printable|worksheet|word strip|practice sheet|reminder|task)\b|\s(?:and|or|then)\s+(?:make|design|create|build|write|turn|set|schedule|add|put|buy|send|email|text|order|purchase|rent|teach)\b/iu;
const TIMING_LEAD =
  /^(?:after|before|at|on|in|around|by|during|today|tomorrow|tonight|this|next|morning|afternoon|evening|breakfast|lunch|dinner|bedtime|monday|tuesday|wednesday|thursday|friday|saturday|sunday|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2}(?::\d{2})?)\b/iu;
const CALENDAR_REFERENCE =
  /\b(?:cal(?:endar|andar|ander|ender|dav)|ical|gcal|google calendar|apple calendar|outlook calendar)\b/iu;
const URL_OR_DOMAIN =
  /(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/iu;
const SAVED_NOTE_CLAIM =
  /\bsaved it\b|\b(?:save|saved|saving|store|stored|storing|file|filed)\b.{0,40}\b(?:this|note|research|finding|homa)\b/iu;
const INTERNAL_VOCABULARY =
  /\b(?:at_age|below_age|12mo_ahead|24mo_ahead|not_mapped|beyondscale|monthsdelta|kidphrase|c[\s._-]*v[\s._-]*c|subject_?id|domain_?id|topic_?id|family_?id|child_?id|member_?user_?id)\b/iu;
const MARKDOWN =
  /[*_`~]|!\[|\[[^\]\n]+\]\([^)]+\)|<[^>\n]+>|(?:^|\n)\s*(?:[-•]|\d+\.|#{1,6})\s+/mu;
const EMOJI =
  /(?:\p{Regional_Indicator}{1,2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)/gu;
const TERMINAL_PUNCTUATION = /[.!?](?:["')\]])?$/u;
const SENTENCE_SEGMENTER = new Intl.Segmenter("en", {
  granularity: "sentence",
});

function hasOneOrTwoCompleteSentences(value: string): boolean {
  if (!TERMINAL_PUNCTUATION.test(value)) return false;
  const words = value.match(/\p{L}[\p{L}'-]*/gu) ?? [];
  if (words.length < 3) return false;
  const sentences = Array.from(
    SENTENCE_SEGMENTER.segment(value),
    ({ segment }) => segment.trim(),
  ).filter(Boolean);
  return sentences.length >= 1 && sentences.length <= 2;
}

function hasOneApprovedCapability(ctaBody: string): boolean {
  const creativePurpose = CREATIVE_ACTIVITY_CTA.exec(ctaBody)?.[1];
  const reminderPurpose = REMINDER_OR_TASK_CTA.exec(ctaBody)?.[1];
  const purpose = creativePurpose ?? reminderPurpose;
  if (
    !purpose ||
    (ctaBody.match(/\bfor\b/giu) ?? []).length !== 1 ||
    COMPOUND_CTA.test(ctaBody) ||
    FORBIDDEN_CTA_PURPOSE.test(purpose)
  ) {
    return false;
  }
  if (reminderPurpose && TIMING_LEAD.test(reminderPurpose)) {
    return false;
  }
  return Boolean(creativePurpose || reminderPurpose);
}

export const RESEARCH_BRIEF_MAX_VISIBLE_CHARS = 900;

export type ResearchBriefValidation =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateResearchBriefFormat(
  text: string,
): ResearchBriefValidation {
  const errors: string[] = [];
  const normalized = text.replace(/\r\n/gu, "\n");
  const lines = normalized.split("\n");
  const hasExactLayout =
    normalized === normalized.trim() &&
    lines.length === EXACT_LINE_COUNT &&
    lines[1] === "" &&
    lines[3] === "" &&
    lines[5] === "";
  if (!hasExactLayout) errors.push("expected exact seven-line layout");

  const headlineMatch = HEADLINE.exec(lines[0] ?? "");
  if (!headlineMatch) errors.push("headline");
  if (!(headlineMatch?.[2] ?? "").match(/\p{L}/u)) {
    errors.push("headline topic");
  }
  if (headlineMatch && headlineMatch[1] !== "Last night") {
    errors.push("headline tense");
  }

  const learnedMatch = LEARNED_BLOCK.exec(lines[2] ?? "");
  const interestingMatch = INTERESTING_BLOCK.exec(lines[4] ?? "");
  if (!learnedMatch) errors.push("learned label");
  if (!interestingMatch) errors.push("interesting label");

  const learned = learnedMatch?.[1] ?? "";
  const interesting = interestingMatch?.[1] ?? "";
  if (!hasOneOrTwoCompleteSentences(learned)) {
    errors.push("learned sentence count");
  }
  if (!hasOneOrTwoCompleteSentences(interesting)) {
    errors.push("interesting sentence count");
  }

  const cta = lines[6] ?? "";
  const ctaMatch = CTA_BLOCK.exec(cta);
  if (!ctaMatch) errors.push("CTA");
  if ((cta.match(/\?/gu) ?? []).length !== 1) errors.push("one CTA");
  if (!hasOneApprovedCapability(ctaMatch?.[1] ?? "")) {
    errors.push("unsupported CTA");
  }
  if (URL_OR_DOMAIN.test(text) || SAVED_NOTE_CLAIM.test(text)) {
    errors.push("saved link");
  }
  if (MARKDOWN.test(text)) errors.push("markdown");
  if ((text.match(EMOJI) ?? []).length > 0) errors.push("emoji");
  if (CALENDAR_REFERENCE.test(cta)) errors.push("calendar promise");
  if (INTERNAL_VOCABULARY.test(text)) errors.push("internal vocabulary");
  if (text.includes("\u2014")) errors.push("em dash");
  if (Array.from(text).length > RESEARCH_BRIEF_MAX_VISIBLE_CHARS) {
    errors.push("visible characters");
  }
  if (smsSegmentCount(text) > MAX_SMS_SEGMENTS) errors.push("SMS segments");

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
