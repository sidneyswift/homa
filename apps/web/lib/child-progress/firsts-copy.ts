import type { ProgressCheckInChannel, ProgressSourceKind } from "./types";

/**
 * Every parent-facing string for the firsts page and the provenance
 * body. Nothing here promises what the derivation cannot keep.
 *
 * The receipt law: every string names something that already happened
 * and carries its date. Nothing counts, nothing compares, nothing looks
 * forward. "finally" and "at last" are banned here specifically because
 * both say the day should have come sooner.
 *
 * The permanence rule: no string may promise that a line never leaves,
 * because two things do remove a line (a parent taking an answer back,
 * and a row that lost a resolved conflict), and the page has to say
 * which. progressSourceLabel from view-copy.ts is deliberately NOT
 * imported: it returns check-in vocabulary ("Onboarding",
 * "Correction"), which is right on a Progress card and wrong on a
 * keepsake. This module defines its own adult-neutral nouns, because the
 * reporting adult may not be the reader.
 */

export const FIRSTS_TITLE = "Firsts";

export function firstsHeading(childName: string): string {
  return `${childName}'s firsts`;
}

export function firstsIntro(childName: string): string {
  return (
    `Every line here is something ${childName} did, with the day it ` +
    "was reported. A later answer never rewrites a day that already " +
    "happened. If someone takes an answer back, its line comes off, " +
    "and that is the only way a line leaves."
  );
}

/**
 * firstsSourceNoun(source): an adult-neutral noun for where a row came
 * from. Exhaustive over every ProgressSourceKind with a `never` default,
 * so a new source cannot silently render as an empty string. The last
 * two stay defined even though the derivation keeps them off the page,
 * so the switch cannot rot.
 */
export function firstsSourceNoun(source: ProgressSourceKind): string {
  switch (source) {
    case "journal":
      return "a note";
    case "conversation":
      return "a conversation with me";
    case "check_in":
      return "a check-in";
    case "checklist":
      return "the progress checklist";
    case "deep_dive":
      return "a focused check-in";
    case "correction":
      return "a correction";
    case "report_correction":
      return "a correction on the report";
    case "report_probe":
      return "a report follow-up";
    case "recheck":
      return "a follow-up check";
    case "onboarding_walk":
      return "the first set of questions";
    case "legacy":
      return "an earlier answer";
    case "lesson_listen":
      return "a lesson recording";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

export function firstsSubjectMarker(subjectDisplayName: string): string {
  return `The first thing you told me about ${subjectDisplayName}.`;
}

export function firstsSubjectMarkerBody(source: ProgressSourceKind): string {
  return (
    `This one came from ${firstsSourceNoun(source)}. It counts the ` +
    "same as anything else here."
  );
}

export const FIRSTS_CONTESTED_LINE =
  "Two adults in your family remember this one differently. Both " +
  "answers are saved, and this day stays here.";

/**
 * firstsMeta(adult, source, date): adult, source and date on one line,
 * or source and date alone when no adult is attributed. No "Adult 1"
 * fallback: the conflict card numbers adults to distinguish two of them,
 * but a receipt with no attributed adult should say less, not invent a
 * label. The mid dot is the house separator, never an em dash.
 */
export function firstsMeta(
  adultDisplayName: string | null,
  source: ProgressSourceKind,
  dateLabel: string,
): string {
  const trimmed = adultDisplayName?.trim() ?? "";
  const parts =
    trimmed === ""
      ? [firstsSourceNoun(source), dateLabel]
      : [trimmed, firstsSourceNoun(source), dateLabel];
  return parts.join(" · ");
}

/**
 * firstsQuoteLabel(adult): whose words these are. Never "Your own words"
 * when the adult is unknown, because two adults report in the same
 * family and guessing which one is a fabrication.
 */
export function firstsQuoteLabel(adultDisplayName: string | null): string {
  const trimmed = adultDisplayName?.trim() ?? "";
  return trimmed === ""
    ? "The note this came from"
    : `${trimmed}'s own words`;
}

export function firstsNoQuote(source: ProgressSourceKind): string {
  return (
    `This came from ${firstsSourceNoun(source)}. There are no words ` +
    "saved with it."
  );
}

export function firstsMatchedAbility(statement: string): string {
  return `Homa matched this to: ${statement}`;
}

/**
 * provenanceChannelLine(channel): how the row arrived, or null so the
 * line is omitted rather than rendered blank. Exhaustive over every
 * ProgressCheckInChannel. The evidence table constrains the channel to
 * web/sms/email/lesson today, so voice and dispatch are unreachable, but
 * the switch stays exhaustive because a silently wrong channel label on
 * a receipt is worse than a compile error.
 */
export function provenanceChannelLine(
  channel: ProgressCheckInChannel | null,
): string | null {
  switch (channel) {
    case "web":
      return "In the app";
    case "sms":
      return "By text";
    case "email":
      return "By email";
    case "lesson":
      return "In a lesson you recorded";
    case "voice":
      return "On a call";
    case "dispatch":
      return "In a message Homa started";
    case null:
      return null;
    default: {
      const exhaustive: never = channel;
      return exhaustive;
    }
  }
}

export function firstsEmptyHeading(childName: string): string {
  return `${childName}'s firsts will land here.`;
}

export function firstsEmptyBody(childName: string): string {
  return (
    `The first time you tell me about something ${childName} did, it ` +
    "lands here with the day you told me and, when you wrote them, " +
    "your own words. The signup questions do not land here: those " +
    "were about what was already true."
  );
}

export const FIRSTS_DOOR = "See the firsts";
export const FIRSTS_PROVENANCE_SUMMARY = "Where this came from";
export const FIRSTS_JUMP_RECENT = "Jump to the most recent";
