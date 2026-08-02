import type {
  OpenProgressConflictView,
  ProgressConflictAdultAnswerView,
  ProgressEvidenceAnswer,
  ProgressSourceKind,
  ProgressSubjectView,
  ProgressTopicView,
} from "../../lib/child-progress";

/**
 * Copy helpers ported from apps/web/lib/child-progress/view-copy.ts.
 * Keep the family vocabulary aligned ("answer", never "observation";
 * "reassure before inform"). Action copy may differ when capability
 * differs: web can resolve a conflict, while native currently shows the
 * two saved answers read-only.
 */

export function progressSubjectHeadline(state: ProgressSubjectView["state"]): string {
  switch (state) {
    case "conflict":
      return "Different answers";
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
      return "Homa will ask";
    case "conflict":
      return "Different answers";
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
      `Tell Homa about a lesson, a worksheet, or something ${childName} tried. ` +
      "Homa will use what you share to start this progress page.",
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

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function progressConflictAnswerLine(
  answer: ProgressConflictAdultAnswerView,
  timeZone: string,
): string {
  const adult = answer.adultDisplayName?.trim() || "an adult";
  return (
    `Answer from ${adult}: ${progressAnswerLabel(answer.answer)} · ` +
    `${formatProgressDate(answer.observedAt, timeZone)}.`
  );
}

export function progressSubjectSummary(
  subject: ProgressSubjectView,
  timeZone: string,
  conflicts: readonly OpenProgressConflictView[] = [],
): string | null {
  if (subject.summary === null) return null;
  const date = formatProgressDate(subject.summary.observedAt, timeZone);
  switch (subject.summary.kind) {
    case "evidence":
      return `Latest evidence: ${progressSourceLabel(subject.summary.source.kind)} · ${date}`;
    case "conflict": {
      const first = subject.summary.adultDisplayNames[0]?.trim() || "Adult 1";
      const second = subject.summary.adultDisplayNames[1]?.trim() || "Adult 2";
      const subjectItemIds = new Set(
        subject.domains.flatMap((domain) => domain.topics.map((topic) => topic.itemId)),
      );
      const conflict = conflicts
        .filter((entry) => subjectItemIds.has(entry.itemId))
        .sort(
          (left, right) =>
            new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime() ||
            right.id.localeCompare(left.id),
        )[0];
      const sourceLabels = conflict
        ? [...new Set(conflict.adultAnswers.map((answer) => progressSourceLabel(answer.source.kind)))]
        : [];
      const source =
        sourceLabels.length === 0
          ? "Latest evidence"
          : `Latest evidence: ${sourceLabels
              .map((label, index) => (index === 0 ? label : lowerFirst(label)))
              .join(" and ")}`;
      return `${source} · ${date}. ${first} and ${second} shared different answers, so Homa saved both.`;
    }
  }
}
