import type {
  ProgressEvidenceAnswer,
  ProgressSourceKind,
  ProgressSubjectView,
  ProgressTopicView,
} from "./types";

/**
 * Live Progress copy, ported from apps/web/lib/child-progress/view-copy.ts.
 * Every string here passed the web copy gates (reassure before inform,
 * one verb per fact, offers not commands), so mobile reuses them verbatim
 * rather than rewording. Keep in sync with the web twin.
 */

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
  throw new TypeError(`Unsupported live Progress copy state: ${String(value)}`);
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
      return "Shared today";
    case "older":
      return "Shared earlier";
    case "ask_next":
      // Chat's "Ask me later" button is the PARENT deferring; this chip
      // is HOMA owning the follow-up, so it names the actor (web twin).
      return "HOMA asks later";
    case "conflict":
      return "Please confirm";
    default:
      return unsupportedProgressCopyState(state);
  }
}

export function progressAnswerLabel(answer: ProgressEvidenceAnswer): string {
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

export function progressSourceLabel(source: ProgressSourceKind): string {
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

export function progressEmptyState(childName: string): ProgressEmptyStateCopy {
  return {
    heading: `This page is ready for ${childName}.`,
    body:
      `You have not shared any specific skills for ${childName} yet. ` +
      "Journal notes, check-in answers, and corrections will appear here.",
  };
}

/**
 * The never-assessed state: no report and nothing shared yet, so the page
 * offers the first check-in instead of an empty shell (web twin's copy,
 * unchanged).
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

/**
 * "Jul 12, 2026" in the family's zone. The web twin insists on the
 * projector's exact offset timestamp format; mobile also receives
 * PostgREST-native ISO strings (the evidence read), so this version
 * accepts any parseable timestamp and falls back to the device zone if
 * the stored zone name is somehow invalid, rather than blanking a date
 * the parent shared.
 */
export function formatProgressDate(
  observedAt: string,
  timeZone: string,
): string {
  const date = new Date(observedAt);
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("en-US", options).format(date);
  }
}

/**
 * The family vocabulary for the countable datum is "answer", one name
 * everywhere (founder ruling 2026-07-14, carried over from the web twin).
 */
function progressAnswerCountLabel(count: number): string {
  return `${count} ${count === 1 ? "answer" : "answers"}`;
}

export function progressSubjectSummary(
  subject: ProgressSubjectView,
  timeZone: string,
): string | null {
  if (subject.summary === null) return null;
  const count = progressAnswerCountLabel(subject.evidenceCount);
  const date = formatProgressDate(subject.summary.observedAt, timeZone);
  switch (subject.summary.kind) {
    case "evidence":
      // "latest:" scopes the source and date to the newest answer (web
      // twin: the bare triplet read as one source for every answer).
      return `${count} · latest: ${progressSourceLabel(subject.summary.source.kind)} · ${date}`;
    case "conflict": {
      const first = subject.summary.adultDisplayNames[0]?.trim() || "Adult 1";
      const second = subject.summary.adultDisplayNames[1]?.trim() || "Adult 2";
      return (
        `${count} · ${first} and ${second} shared different ` +
        `answers on ${date}. Both are saved.`
      );
    }
    default:
      return unsupportedProgressCopyState(subject.summary);
  }
}
