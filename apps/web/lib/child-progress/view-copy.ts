import type {
  ProgressEvidenceAnswer,
  ProgressSourceKind,
  ProgressSubjectView,
  ProgressTopicView,
} from "./types";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";

export interface ProgressEmptyStateCopy {
  heading: string;
  body: string;
}

export interface ProgressAssessmentCtaCopy {
  heading: string;
  body: string;
  cta: string;
}

function unsupportedProgressCopyState(value: never): never {
  throw new TypeError(`Unsupported live Progress copy state: ${value}`);
}

export function progressSubjectHeadline(
  state: ProgressSubjectView["state"],
): string {
  switch (state) {
    case "conflict":
      return "Please confirm";
    case "updated_recently":
      return "Updated today";
    case "older":
      return "Older information";
    default:
      return unsupportedProgressCopyState(state);
  }
}

export function progressTopicStateLabel(
  state: ProgressTopicView["state"],
): string {
  switch (state) {
    case "observed_today":
      // One verb for the whole chip pair ("Shared today" / "Shared
      // earlier"): the editor gate flagged observed/shared as two names
      // for one fact.
      return "Shared today";
    case "older":
      // "Older" alone read as being about ages (reader gates, Jul 12);
      // "Shared earlier" names what is older, the information.
      return "Shared earlier";
    case "ask_next":
      // Chat's "Ask me later" button is the PARENT deferring; this chip
      // is HOMA owning the follow-up, so it names the actor.
      return "HOMA asks later";
    case "conflict":
      return "Please confirm";
    default:
      return unsupportedProgressCopyState(state);
  }
}

export function progressAnswerLabel(
  answer: ProgressEvidenceAnswer,
): string {
  switch (answer) {
    case "easily":
      return "Easily";
    case "getting_there":
      return "Getting there";
    case "not_yet":
      return "Not yet";
    default:
      return unsupportedProgressCopyState(answer);
  }
}

export function progressSourceLabel(
  source: ProgressSourceKind,
): string {
  switch (source) {
    case "journal":
      return "Journal note";
    case "conversation":
      return "Conversation";
    case "check_in":
      return "Check-in";
    case "checklist":
      return "Progress checklist";
    case "deep_dive":
      return "Focused check-in";
    case "correction":
      return "Correction";
    case "report_correction":
      return "Report correction";
    case "report_probe":
      return "Report follow-up";
    case "recheck":
      return "Follow-up check";
    case "onboarding_walk":
      return "Onboarding";
    case "legacy":
      return "Earlier progress answer";
    case "lesson_listen":
      return "Lesson recording";
    default:
      return unsupportedProgressCopyState(source);
  }
}

export function progressEmptyState(
  childName: string,
): ProgressEmptyStateCopy {
  return {
    heading: `This page is ready for ${childName}.`,
    body:
      `You have not shared any specific skills for ${childName} yet. ` +
      "Journal notes, check-in answers, and corrections will appear here.",
  };
}

/**
 * The never-assessed state: no report and nothing shared yet, so the page
 * offers the first check-in instead of an empty shell. Warm and plain
 * (reassure before inform, offer not command): a short, low-stakes ask
 * that names what it produces.
 */
export function progressAssessmentCta(
  childName: string,
): ProgressAssessmentCtaCopy {
  return {
    heading: `See where ${childName} is today.`,
    body:
      `You have not done a check-in for ${childName} yet. A few quick ` +
      `questions about what ${childName} is doing build their first ` +
      "progress report. It takes about five minutes, and you can add to " +
      "it any time.",
    cta: `Start ${childName}'s check-in`,
  };
}

export function formatProgressDate(
  observedAt: string,
  timeZone: string,
): string {
  parseOffsetIsoTimestampEpochNanoseconds(observedAt);
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
  } catch {
    throw new TypeError(`Invalid IANA time zone "${timeZone}"`);
  }
  return formatter.format(new Date(observedAt));
}

/**
 * The family vocabulary for the countable datum is "answer", one name
 * everywhere (founder ruling 2026-07-14): what an adult said or showed
 * about one skill, whatever the channel. A checklist tap, a deeper
 * question, a chat reply, and a journal note Homa matched to a skill
 * all count the same way; the source label next to it says which.
 * "Observation" stays internal (and in the formal evidence pack).
 */
function progressAnswerCountLabel(count: number): string {
  return `${count} ${count === 1 ? "answer" : "answers"}`;
}

export function progressSubjectSummary(
  subject: ProgressSubjectView,
  timeZone: string,
): string | null {
  if (subject.summary === null) return null;
  const count = progressAnswerCountLabel(
    subject.evidenceCount,
  );
  const date = formatProgressDate(
    subject.summary.observedAt,
    timeZone,
  );
  switch (subject.summary.kind) {
    case "evidence":
      // "latest:" scopes the source and date to the newest answer; the
      // bare triplet read as if every answer came from that one source.
      return `${count} · latest: ${progressSourceLabel(subject.summary.source.kind)} · ${date}`;
    case "conflict": {
      const first =
        subject.summary.adultDisplayNames[0]?.trim() ||
        "Adult 1";
      const second =
        subject.summary.adultDisplayNames[1]?.trim() ||
        "Adult 2";
      return (
        `${count} · ${first} and ${second} shared different ` +
        `answers on ${date}. Both are saved.`
      );
    }
    default:
      return unsupportedProgressCopyState(subject.summary);
  }
}
