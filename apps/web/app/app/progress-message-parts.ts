import type { ProgressSourceKind } from "../../lib/child-progress/types";
import {
  manageChildProgressResultSchema,
  type ManageChildProgressResult,
} from "../../lib/child-progress/tool-result-contract";

type RenderableProgressResult = Extract<
  ManageChildProgressResult,
  {
    kind:
      | "progress_update"
      | "progress_question"
      | "progress_conflict"
      | "progress_workflow";
  }
>;

type ProgressAnswer =
  | "easily"
  | "getting_there"
  | "not_yet"
  | "not_sure"
  | "skip";
type ConflictOption =
  | "easily"
  | "getting_there"
  | "not_yet"
  | "ask_later";
type ProgressQuestionResult = Extract<
  ManageChildProgressResult,
  { kind: "progress_question" }
>;
type NestedProgressUpdate = NonNullable<
  ProgressQuestionResult["update"]
>;

export interface ProgressUpdateCardData {
  label: "Progress updated";
  childName?: string;
  affectedTopics: string[];
  undoAvailable: boolean;
}

export interface ProgressQuestionCardData {
  acceptedResponseCount?: number;
  responseLimit?: number;
  childName: string;
  subjectDisplayName: string;
  statement: string;
  answerLabels: string[];
  update?: ProgressUpdateCardData;
}

export interface ProgressConflictCardData {
  label: "Please confirm";
  question: string;
  childName: string;
  subjectDisplayName: string;
  skillStatement: string;
  answers: [
    {
      answerLabel: string;
      adultDisplayName: string | null;
      observedAt: string;
      source: ProgressSourceKind;
    },
    {
      answerLabel: string;
      adultDisplayName: string | null;
      observedAt: string;
      source: ProgressSourceKind;
    },
  ];
  optionLabels: string[];
}

export type ProgressAssistantItem =
  | { kind: "progress_update"; update: ProgressUpdateCardData }
  | { kind: "progress_question"; card: ProgressQuestionCardData }
  | { kind: "progress_conflict"; card: ProgressConflictCardData }
  | {
      kind: "progress_workflow";
      label: Extract<ManageChildProgressResult, {kind: "progress_workflow"}>["label"];
      scope?: Extract<ManageChildProgressResult, {kind: "progress_workflow"}>["scope"];
      completion?: Extract<ManageChildProgressResult, {kind: "progress_workflow"}>["completion"];
      activeCheckIn?: Extract<ManageChildProgressResult, {kind: "progress_workflow"}>["activeCheckIn"];
      update?: ProgressUpdateCardData;
    };

function unsupportedProgressChoice(value: never): never {
  throw new TypeError(`Unsupported progress choice: ${value}`);
}

export function progressChoiceLabel(
  answer: ProgressAnswer | ConflictOption,
): string {
  switch (answer) {
    case "easily":
      return "Easily";
    case "getting_there":
      return "Getting there";
    case "not_yet":
      return "Not yet";
    case "not_sure":
      return "Not sure";
    case "skip":
      return "Skip";
    case "ask_later":
      return "Ask me later";
    default:
      return unsupportedProgressChoice(answer);
  }
}

const MAX_VISIBLE_TOPIC_CHARACTERS = 120;
const MAX_VISIBLE_TOPICS = 3;

/**
 * Topic details are supporting copy, so keep them compact even when a
 * historical server result contains more detail than the current card needs.
 */
function boundedAffectedTopics(topics: readonly string[]): string[] {
  return topics.slice(0, MAX_VISIBLE_TOPICS).map((topic) => {
    const characters = Array.from(topic.trim());
    if (characters.length <= MAX_VISIBLE_TOPIC_CHARACTERS) return topic.trim();
    return `${characters.slice(0, MAX_VISIBLE_TOPIC_CHARACTERS - 1).join("")}…`;
  });
}

function nestedUpdateData(
  update: NestedProgressUpdate,
): ProgressUpdateCardData {
  return {
    label: update.label,
    affectedTopics: boundedAffectedTopics(update.affectedTopics),
    undoAvailable: true,
  };
}

function progressItemFromResult(
  result: RenderableProgressResult,
): ProgressAssistantItem {
  switch (result.kind) {
    case "progress_update":
      return {
        kind: "progress_update",
        update: {
          label: result.label,
          childName: result.childName,
          affectedTopics: boundedAffectedTopics(result.affectedTopics),
          undoAvailable:
            result.undoAvailable && result.undoToken !== null,
        },
      };
    case "progress_question":
      return {
        kind: "progress_question",
        card: {
          childName: result.prompt.childName,
          subjectDisplayName: result.prompt.subjectDisplayName,
          statement: result.prompt.statement,
          ...(result.prompt.acceptedResponseCount !== undefined ? {acceptedResponseCount: result.prompt.acceptedResponseCount} : {}),
          ...(result.prompt.responseLimit !== undefined ? {responseLimit: result.prompt.responseLimit} : {}),
          answerLabels: result.prompt.answerOptions.map(progressChoiceLabel),
          ...(result.update
            ? { update: nestedUpdateData(result.update) }
            : {}),
        },
      };
    case "progress_conflict": {
      const [first, second] = result.conflict.answers;
      return {
        kind: "progress_conflict",
        card: {
          label: result.conflict.label,
          question: result.conflict.question,
          childName: result.conflict.childName,
          subjectDisplayName: result.conflict.subjectDisplayName,
          skillStatement: result.conflict.skillStatement,
          answers: [
            {
              answerLabel: progressChoiceLabel(first.answer),
              adultDisplayName: first.adultDisplayName,
              observedAt: first.observedAt,
              source: first.source,
            },
            {
              answerLabel: progressChoiceLabel(second.answer),
              adultDisplayName: second.adultDisplayName,
              observedAt: second.observedAt,
              source: second.source,
            },
          ],
          optionLabels: result.conflict.options.map(progressChoiceLabel),
        },
      };
    }
    case "progress_workflow":
      return {
        kind: "progress_workflow",
        label: result.label,
        ...(result.scope ? {scope: result.scope} : {}),
        ...(result.completion ? {completion: result.completion} : {}),
        ...(result.activeCheckIn ? {activeCheckIn: result.activeCheckIn} : {}),
        ...(result.update
          ? { update: nestedUpdateData(result.update) }
          : {}),
      };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

/**
 * Converts only a completed manage_child_progress tool part into safe display
 * data. Unknown historical payloads fail closed so one bad part cannot hide
 * the rest of the transcript.
 */
export function parseProgressMessagePart(
  part: unknown,
): ProgressAssistantItem | null {
  if (typeof part !== "object" || part === null) return null;
  const candidate = part as Record<string, unknown>;
  if (
    candidate.type !== "dynamic-tool" ||
    candidate.state !== "output-available" ||
    candidate.toolName !== "manage_child_progress"
  ) {
    return null;
  }
  const parsed = manageChildProgressResultSchema.safeParse(candidate.output);
  if (!parsed.success) return null;
  switch (parsed.data.kind) {
    case "progress_update":
    case "progress_question":
    case "progress_conflict":
    case "progress_workflow":
      return progressItemFromResult(parsed.data);
    case "activity_only":
    case "no_match":
    case "ambiguous":
    case "observation_used":
    case "refused":
    case "disabled":
      return null;
    default: {
      const exhaustive: never = parsed.data;
      return exhaustive;
    }
  }
}
