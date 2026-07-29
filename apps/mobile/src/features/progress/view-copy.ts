import type {
  ProgressEvidenceAnswer,
  ProgressSourceKind,
  ProgressSubjectView,
  ProgressTopicView,
} from "../../lib/child-progress";

/**
 * Copy helpers ported from apps/web/lib/child-progress/view-copy.ts.
 * Keep strings identical to that file: this is the one family
 * vocabulary for progress ("answer", never "observation"; state chip
 * wording; "reassure before inform") and it should read the same on
 * mobile as on web.
 */

export function progressSubjectHeadline(state: ProgressSubjectView["state"]): string {
  switch (state) {
    case "conflict":
      return "Please confirm";
    case "updated_recently":
      return "Updated today";
    case "older":
      return "Older information";
  }
}

export function progressTopicStateLabel(state: ProgressTopicView["state"]): string {
  switch (state) {
    case "observed_today":
      return "Shared today";
    case "older":
      return "Shared earlier";
    case "ask_next":
      return "HOMA asks later";
    case "conflict":
      return "Please confirm";
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
  }
}

export function progressAssessmentCta(childName: string): {
  heading: string;
  body: string;
} {
  return {
    heading: `See where ${childName} is today.`,
    body:
      `You have not done a check-in for ${childName} yet. Tell Homa about ` +
      `a lesson, a worksheet, or something ${childName} tried, and it will ` +
      "start building their first progress report.",
  };
}

export function formatProgressDate(observedAt: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  return formatter.format(new Date(observedAt));
}

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
      return `${count} · latest: ${progressSourceLabel(subject.summary.source.kind)} · ${date}`;
    case "conflict": {
      const first = subject.summary.adultDisplayNames[0]?.trim() || "Adult 1";
      const second = subject.summary.adultDisplayNames[1]?.trim() || "Adult 2";
      return `${count} · ${first} and ${second} shared different answers on ${date}. Both are saved.`;
    }
  }
}
