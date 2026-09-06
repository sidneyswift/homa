import { getMapSubject } from "@homa/core";

import { progressSubjectHref } from "./assessment-intent";

import type {
  ChildProgressView,
  ProgressCheckInContext,
  ProgressCheckInPrompt,
  ProgressCheckInRecord,
  ProgressCheckInUpdate,
  ProgressConflictCard,
} from "./types";
import type {
  ChildProgressToolOperations,
} from "./tool-operations";
import {
  DISABLED_PROGRESS_NOTE,
  JOURNAL_HOURS_PROGRESS_NOTE,
  manageChildProgressResultSchema,
  OBSERVATION_ALREADY_USED_PROGRESS_NOTE,
  OBSERVATION_USED_PROGRESS_NOTE,
  REFUSED_PROGRESS_NOTE,
  REISSUE_PROGRESS_NOTE,
  type ManageChildProgressResult,
} from "./tool-result-contract";

const ANSWER_OPTIONS: [
  "easily",
  "getting_there",
  "not_yet",
  "not_sure",
  "skip",
] = [
  "easily",
  "getting_there",
  "not_yet",
  "not_sure",
  "skip",
];

function parsed(
  result: ManageChildProgressResult,
): ManageChildProgressResult {
  return manageChildProgressResultSchema.parse(result);
}

export function refusedProgressResult(): ManageChildProgressResult {
  return parsed({ kind: "refused", note: REFUSED_PROGRESS_NOTE });
}

/**
 * The refusal for a workflow desync the model can repair itself: the
 * check-in exists but this reply is not bound to its delivered question.
 * Identity and contract violations keep the generic refusal instead.
 */
export function reissueProgressResult(): ManageChildProgressResult {
  return parsed({ kind: "refused", note: REISSUE_PROGRESS_NOTE });
}

export function disabledProgressResult(): ManageChildProgressResult {
  return parsed({ kind: "disabled", note: DISABLED_PROGRESS_NOTE });
}

export function observationUsedResult(
  alreadyUsed: boolean,
): ManageChildProgressResult {
  return parsed({
    kind: "observation_used",
    note: alreadyUsed
      ? OBSERVATION_ALREADY_USED_PROGRESS_NOTE
      : OBSERVATION_USED_PROGRESS_NOTE,
  });
}

export function progressQuestionResult(
  prompt: ProgressCheckInPrompt,
  update?: ProgressCheckInUpdate,
): ManageChildProgressResult {
  return parsed({
    kind: "progress_question",
    prompt: {
      checkInId: prompt.checkInId,
      revision: prompt.revision,
      childName: prompt.childName,
      subjectDisplayName: prompt.subjectDisplayName,
      statement: prompt.personalizedStatement,
      ...(prompt.subjectId ? {childId: prompt.childId, subjectId: prompt.subjectId, acceptedResponseCount: prompt.acceptedResponseCount ?? 0, ...(prompt.responseLimit === 8 ? {responseLimit: 8 as const} : {})} : {}),
      answerOptions: ANSWER_OPTIONS,
    },
    ...(update
      ? {
          update: {
            label: "Progress updated" as const,
            undoToken: update.operationId,
            affectedTopics: update.affectedTopics.slice(0, 12),
          },
        }
      : {}),
  });
}

export function progressConflictCardResult(
  conflict: ProgressConflictCard,
): ManageChildProgressResult {
  const [first, second] = conflict.answers;
  return parsed({
    kind: "progress_conflict",
    conflict: {
      conflictId: conflict.id,
      label: "Please confirm",
      question: `Which answer fits ${conflict.childName} today?`,
      childName: conflict.childName,
      subjectDisplayName: conflict.subjectDisplayName,
      skillStatement: conflict.skillStatement,
      answers: [
        {
          answer: first.answer,
          adultDisplayName: first.adultDisplayName,
          observedAt: first.observedAt,
          source: first.source,
        },
        {
          answer: second.answer,
          adultDisplayName: second.adultDisplayName,
          observedAt: second.observedAt,
          source: second.source,
        },
      ],
      options: [first.answer, second.answer, "ask_later"],
    },
  });
}

function findTopic(view: ChildProgressView, itemId: string) {
  for (const subject of view.subjects) {
    for (const domain of subject.domains) {
      const topic = domain.topics.find(
        (candidate) => candidate.itemId === itemId,
      );
      if (topic) return { subject, topic };
    }
  }
  return null;
}

export async function progressConflictViewResult(input: {
  context: ProgressCheckInContext;
  childId: string;
  conflictId: string;
  operations: ChildProgressToolOperations;
}): Promise<ManageChildProgressResult> {
  const view = await input.operations.getChildProgressView(
    input.context.familyId,
    input.childId,
  );
  const conflict = view?.conflicts.find(
    (candidate) => candidate.id === input.conflictId,
  );
  if (!view || !conflict) return refusedProgressResult();
  const located = findTopic(view, conflict.itemId);
  if (!located) return refusedProgressResult();
  const [first, second] = conflict.adultAnswers;
  return parsed({
    kind: "progress_conflict",
    conflict: {
      conflictId: conflict.id,
      label: "Please confirm",
      question: `Which answer fits ${view.childName} today?`,
      childName: view.childName,
      subjectDisplayName: located.subject.displayName,
      skillStatement: located.topic.statement,
      answers: [
        {
          answer: first.answer,
          adultDisplayName: first.adultDisplayName,
          observedAt: first.observedAt,
          source: first.source.kind,
        },
        {
          answer: second.answer,
          adultDisplayName: second.adultDisplayName,
          observedAt: second.observedAt,
          source: second.source.kind,
        },
      ],
      options: [first.answer, second.answer, "ask_later"],
    },
  });
}

export async function progressUpdateResult(input: {
  context: ProgressCheckInContext;
  childId: string;
  affectedItemIds: readonly string[];
  undoToken: string | null;
  operations: ChildProgressToolOperations;
  note?: typeof JOURNAL_HOURS_PROGRESS_NOTE;
}): Promise<ManageChildProgressResult> {
  const view = await input.operations.getChildProgressView(
    input.context.familyId,
    input.childId,
  );
  if (!view) return refusedProgressResult();
  const affected = new Set(input.affectedItemIds);
  const affectedTopics = view.subjects
    .flatMap((subject) => subject.domains)
    .flatMap((domain) => domain.topics)
    .filter((topic) => affected.has(topic.itemId))
    .map((topic) => topic.statement)
    .filter((statement, index, all) => all.indexOf(statement) === index)
    .slice(0, 12);
  return parsed({
    kind: "progress_update",
    label: "Progress updated",
    childName: view.childName,
    affectedTopics,
    undoAvailable: input.undoToken !== null,
    undoToken: input.undoToken,
    ...(input.note ? { note: input.note } : {}),
  });
}

export function progressWorkflowDetails(checkIn: ProgressCheckInRecord) {
  const subject = getMapSubject(checkIn.scope.subjectIds?.[0] ?? "");
  return {
    ...(subject ? { scope: {childId: checkIn.childId, childName: checkIn.childName, subjectId: subject.id, subjectDisplayName: subject.displayName, progressHref: progressSubjectHref(checkIn.childId, subject.id)} } : {}),
    ...((checkIn.state === "completed" || checkIn.state === "stopped") ? {completion: {
      reason: checkIn.terminalReason ?? null,
      acceptedResponseCount: checkIn.acceptedResponseCount ?? null,
      uncertainResponseCount: checkIn.uncertainResponseCount ?? null,
      mixedEvidence: checkIn.terminalMixedEvidence ?? false,
    }} : {}),
  };
}

export function progressWorkflowResult(
  label: Extract<ManageChildProgressResult, {kind: "progress_workflow"}>["label"],
  update?: ProgressCheckInUpdate,
  details: Pick<Extract<ManageChildProgressResult, {kind: "progress_workflow"}>, "scope" | "completion" | "activeCheckIn"> = {},
): ManageChildProgressResult {
  return parsed({
    kind: "progress_workflow",
    ...details,
    label,
    ...(update
      ? {
          update: {
            label: "Progress updated" as const,
            undoToken: update.operationId,
            affectedTopics: update.affectedTopics.slice(0, 12),
          },
        }
      : {}),
  });
}
