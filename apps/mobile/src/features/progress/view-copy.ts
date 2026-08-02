import { parseOffsetIsoTimestampEpochNanoseconds } from "@homa/core";

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
      return "Two answers saved";
    case "updated_recently":
      return "Updated today";
    case "older":
      return "Older information";
  }
}

export function progressTopicStateLabel(state: ProgressTopicView["state"]): string {
  switch (state) {
    case "observed_today":
      return "Answer saved";
    case "older":
      return "Earlier answer";
    case "ask_next":
      return "Not shared yet";
    case "conflict":
      return "Two answers saved";
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
    heading: `Start ${childName}’s progress`,
    body:
      `Tell Homa about a lesson, a worksheet, or something ${childName} tried. ` +
      "One sentence is enough to begin.",
  };
}

export function progressAssessmentDraft(childName: string): string {
  return `I want to tell you something ${childName} tried: `;
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
    `${adult}: ${progressAnswerLabel(answer.answer)} · ` +
    `${progressSourceLabel(answer.source.kind)} · ` +
    `${formatProgressDate(answer.observedAt, timeZone)}.`
  );
}

export interface ProgressSubjectTakeaway {
  statement: string;
  stateLabel: string;
}

export interface ProgressSubjectSummary {
  sourceLabel: string;
  dateLabel: string;
  note: string | null;
  accessibilityLabel: string;
}

function compareAsciiDescending(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

function compareObservedAtDescending(left: string, right: string): number {
  const leftNanoseconds = parseOffsetIsoTimestampEpochNanoseconds(left);
  const rightNanoseconds = parseOffsetIsoTimestampEpochNanoseconds(right);
  if (leftNanoseconds === rightNanoseconds) return 0;
  return leftNanoseconds > rightNanoseconds ? -1 : 1;
}

function selectedSubjectConflict(
  subject: ProgressSubjectView,
  conflicts: readonly OpenProgressConflictView[],
): OpenProgressConflictView | null {
  const subjectItemIds = new Set(
    subject.domains.flatMap((domain) =>
      domain.topics.map((topic) => topic.itemId),
    ),
  );
  return (
    conflicts
      .filter((entry) => subjectItemIds.has(entry.itemId))
      .sort(
        (left, right) =>
          compareObservedAtDescending(left.observedAt, right.observedAt) ||
          compareAsciiDescending(left.itemId, right.itemId) ||
          compareAsciiDescending(left.id, right.id),
      )[0] ?? null
  );
}

/** One concrete skill for a collapsed card, newest evidence first. */
export function progressSubjectTakeaway(
  subject: ProgressSubjectView,
  conflicts: readonly OpenProgressConflictView[] = [],
): ProgressSubjectTakeaway | null {
  const topics = subject.domains.flatMap((domain) => domain.topics);
  const selectedConflict =
    subject.state === "conflict"
      ? selectedSubjectConflict(subject, conflicts)
      : null;
  const headlineTopics =
    selectedConflict !== null
      ? topics.filter((topic) => topic.itemId === selectedConflict.itemId)
      : subject.state === "conflict"
      ? topics.filter((topic) => topic.state === "conflict")
      : topics;
  const dated = headlineTopics
    .filter((topic) => topic.observedAt !== null)
    .sort(
      (left, right) =>
        compareObservedAtDescending(
          left.observedAt as string,
          right.observedAt as string,
        ) || compareAsciiDescending(left.itemId, right.itemId),
    );
  const topic = dated[0] ?? headlineTopics[0] ?? topics[0];
  if (!topic) return null;
  return {
    statement: topic.statement,
    stateLabel:
      topic.answer !== null
        ? progressAnswerLabel(topic.answer)
        : progressTopicStateLabel(topic.state),
  };
}

export function progressSubjectSummary(
  subject: ProgressSubjectView,
  timeZone: string,
  conflicts: readonly OpenProgressConflictView[] = [],
): ProgressSubjectSummary | null {
  if (subject.summary === null) return null;
  const date = formatProgressDate(subject.summary.observedAt, timeZone);
  switch (subject.summary.kind) {
    case "evidence": {
      const sourceLabel = progressSourceLabel(subject.summary.source.kind);
      return {
        sourceLabel,
        dateLabel: date,
        note: null,
        accessibilityLabel: `${sourceLabel} · ${date}`,
      };
    }
    case "conflict": {
      const conflict = selectedSubjectConflict(subject, conflicts);
      const sourceLabels = conflict
        ? [...new Set(conflict.adultAnswers.map((answer) => progressSourceLabel(answer.source.kind)))]
        : [];
      const source =
        sourceLabels.length === 0
          ? "Progress answer"
          : sourceLabels
              .map((label, index) => (index === 0 ? label : lowerFirst(label)))
              .join(" and ");
      const conflictDate = conflict
        ? formatProgressDate(conflict.observedAt, timeZone)
        : date;
      const note = "Homa kept both answers.";
      return {
        sourceLabel: source,
        dateLabel: conflictDate,
        note,
        accessibilityLabel: `${source} · ${conflictDate}. ${note}`,
      };
    }
  }
}
