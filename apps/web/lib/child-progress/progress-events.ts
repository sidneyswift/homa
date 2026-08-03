import {
  domainForBankItem,
  getMapItem,
  getMapSubject,
  type EventName,
  type EventProps,
  type MapAnswer,
} from "@homa/core";
import {
  getProgressTaxonomyDomain,
  getProgressTaxonomyTopic,
} from "@homa/taxonomy/progress";

import { emitMapEvent } from "../map/events";
import type {
  CorrectProgressAnswersResult,
  RecordJournalProgressEvidenceResult,
  RecordProgressEvidenceResult,
  UndoProgressOperationResult,
} from "./progress-service";
import type {
  ProgressCheckInPauseReason,
  ProgressCheckInResult,
  ProgressEvidence,
  ProgressSourceKind,
} from "./types";

type ProgressEventName = Extract<EventName, `progress.${string}`>;

export type ProgressEvent = {
  [N in ProgressEventName]: {
    name: N;
    props: EventProps<N>;
  };
}[ProgressEventName];

export type ProgressEventEmitter = <N extends EventName>(
  name: N,
  props: EventProps<N>,
) => Promise<void>;

interface ProgressItemEventLocation {
  subject: string;
  domain: string;
}

type RuntimeProgressCheckInPauseReason = Exclude<
  ProgressCheckInPauseReason,
  "member_removed"
>;

function progressItemEventLocation(
  itemId: string,
): ProgressItemEventLocation | null {
  const located = getMapItem(itemId);
  const domain = domainForBankItem(itemId);
  if (located !== undefined && domain !== null) {
    return {
      subject: located.subject.id,
      domain,
    };
  }
  const taxonomyTopic = getProgressTaxonomyTopic(itemId);
  if (taxonomyTopic === undefined) return null;
  const taxonomyDomain =
    getProgressTaxonomyDomain(taxonomyTopic.domain);
  if (
    taxonomyDomain === undefined ||
    taxonomyDomain.kind !== "assessment" ||
    taxonomyDomain.subject !== taxonomyTopic.subject
  ) {
    return null;
  }
  return {
    subject: taxonomyTopic.subject,
    domain: taxonomyTopic.domain,
  };
}

function subjectsTouched(itemIds: readonly string[]): number {
  return new Set(
    itemIds.flatMap((itemId) => {
      const location = progressItemEventLocation(itemId);
      return location === null ? [] : [location.subject];
    }),
  ).size;
}

function evidenceRecordedEvents(
  evidence: readonly ProgressEvidence[],
  supersedesOverride?: boolean,
): ProgressEvent[] {
  const bySource = new Map<
    ProgressSourceKind,
    ProgressEvidence[]
  >();
  for (const row of evidence) {
    const rows = bySource.get(row.source) ?? [];
    rows.push(row);
    bySource.set(row.source, rows);
  }
  return [...bySource.entries()].map(([source, rows]) => ({
    name: "progress.evidence_recorded",
    props: {
      family_id: rows[0].familyId,
      child_id: rows[0].childId,
      source,
      items: rows.length,
      supersedes:
        supersedesOverride ??
        rows.some((row) => row.supersedesId !== null),
    },
  }));
}

function conflictOpenedEvents(
  familyId: string,
  childId: string,
  itemIds: readonly string[],
): ProgressEvent[] {
  return itemIds.flatMap((itemId) => {
    const location = progressItemEventLocation(itemId);
    return location === null
      ? []
      : [{
          name: "progress.conflict_opened" as const,
          props: {
            family_id: familyId,
            child_id: childId,
            ...location,
          },
        }];
  });
}

function projectionUpdatedEvents(input: {
  familyId: string;
  childId: string;
  itemIds: readonly string[];
  hadConflict: boolean;
}): ProgressEvent[] {
  const touchedSubjectCount = subjectsTouched(input.itemIds);
  if (touchedSubjectCount === 0) return [];
  return [{
    name: "progress.projection_updated",
    props: {
      family_id: input.familyId,
      child_id: input.childId,
      subjects_touched: touchedSubjectCount,
      had_conflict: input.hadConflict,
    },
  }];
}

export function progressEventsForEvidenceResult(
  result:
    | RecordProgressEvidenceResult
    | RecordJournalProgressEvidenceResult,
  conflictItemIds: readonly string[] = [],
): ProgressEvent[] {
  if (
    result.status !== "recorded" &&
    result.status !== "conflict_open"
  ) {
    return [];
  }
  const firstEvidence = result.evidence[0];
  if (firstEvidence === undefined) return [];
  const hadConflict = result.status === "conflict_open";
  return [
    ...evidenceRecordedEvents(result.evidence),
    ...(hadConflict
      ? conflictOpenedEvents(
          firstEvidence.familyId,
          firstEvidence.childId,
          conflictItemIds,
        )
      : []),
    ...projectionUpdatedEvents({
      familyId: firstEvidence.familyId,
      childId: firstEvidence.childId,
      itemIds: result.affectedItemIds,
      hadConflict,
    }),
  ];
}

/**
 * Observation-ledger events (plan 2026-07-13-observation-ledger.md).
 * The journal service writes the observation row inside the committed
 * transaction for exactly these three statuses, so the status alone is
 * the emission signal. Replays surface as "duplicate" and never re-emit.
 */
export function progressEventsForJournalObservation(
  input: { familyId: string; childId: string },
  result: RecordJournalProgressEvidenceResult,
): ProgressEvent[] {
  if (
    result.status !== "no_match" &&
    result.status !== "activity_only" &&
    result.status !== "ambiguous"
  ) {
    return [];
  }
  return [{
    name: "progress.observation_saved",
    props: {
      family_id: input.familyId,
      child_id: input.childId,
      classification: result.status,
    },
  }];
}

export function progressEventsForObservationUsed(input: {
  familyId: string;
  childId: string;
}): ProgressEvent[] {
  return [{
    name: "progress.observation_used",
    props: {
      family_id: input.familyId,
      child_id: input.childId,
    },
  }];
}

export function progressEventsForCorrectionResult(
  familyId: string,
  result: CorrectProgressAnswersResult,
): ProgressEvent[] {
  if (result.status !== "answers_corrected") return [];
  return [
    ...evidenceRecordedEvents(result.evidence, true),
    ...projectionUpdatedEvents({
      familyId,
      childId: result.childId,
      itemIds: result.affectedItemIds,
      hadConflict: false,
    }),
  ];
}

export function progressEventsForUndoResult(
  familyId: string,
  result: UndoProgressOperationResult,
): ProgressEvent[] {
  if (result.status !== "undone") return [];
  return projectionUpdatedEvents({
    familyId,
    childId: result.childId,
    itemIds: result.affectedItemIds,
    hadConflict: false,
  });
}

export function progressEventsForCheckInStart(
  result: ProgressCheckInResult,
): ProgressEvent[] {
  if (result.status !== "started") return [];
  const subjectIds = result.checkIn.scope.subjectIds;
  const subject =
    subjectIds?.length === 1 &&
      getMapSubject(subjectIds[0]) !== undefined
      ? subjectIds[0]
      : undefined;
  return [{
    name: "progress.checkin_started",
    props: {
      family_id: result.checkIn.familyId,
      child_id: result.checkIn.childId,
      scope: subjectIds === undefined ? "whole" : "subject",
      ...(subject === undefined ? {} : { subject }),
    },
  }];
}

function progressPauseEventReason(
  reason: RuntimeProgressCheckInPauseReason,
): EventProps<"progress.checkin_paused">["reason"] {
  switch (reason) {
    case "explicit_pause":
      return "explicit_stop";
    case "topic_change":
    case "delivery_uncertain":
    case "delivery_failed":
    case "conflict":
      return reason;
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
}

export function progressEventsForCheckInPause(
  reason: RuntimeProgressCheckInPauseReason,
  result: ProgressCheckInResult,
): ProgressEvent[] {
  // The private membership-removal trigger emits member_removed inside the
  // transaction that pauses each affected check-in.
  if (result.status !== "paused") return [];
  return [{
    name: "progress.checkin_paused",
    props: {
      family_id: result.checkIn.familyId,
      child_id: result.checkIn.childId,
      reason: progressPauseEventReason(reason),
    },
  }];
}

export function progressEventsForCheckInResume(
  result: ProgressCheckInResult,
): ProgressEvent[] {
  if (result.status !== "resumed") return [];
  return [{
    name: "progress.checkin_resumed",
    props: {
      family_id: result.checkIn.familyId,
      child_id: result.checkIn.childId,
      takeover: false,
    },
  }];
}

export function progressEventsForCheckInTakeover(
  result: ProgressCheckInResult,
): ProgressEvent[] {
  if (result.status !== "takeover_accepted") return [];
  return [{
    name: "progress.checkin_resumed",
    props: {
      family_id: result.checkIn.familyId,
      child_id: result.checkIn.childId,
      takeover: true,
    },
  }];
}

export function progressEventsForCheckInStop(
  result: ProgressCheckInResult,
): ProgressEvent[] {
  if (result.status !== "stopped") return [];
  return [{
    name: "progress.checkin_ended",
    props: {
      family_id: result.checkIn.familyId,
      child_id: result.checkIn.childId,
      outcome: "stopped",
    },
  }];
}

function isProgressEvidenceAnswer(
  answer: MapAnswer,
): boolean {
  return (
    answer === "easily" ||
    answer === "getting_there" ||
    answer === "not_yet"
  );
}

export interface CommittedProgressCheckInAnswer {
  familyId: string;
  childId: string;
  itemId: string;
  answer: MapAnswer;
  outcome: "advanced" | "completed" | "conflict_open";
}

export function progressEventsForCheckInAnswer(
  input: CommittedProgressCheckInAnswer,
): ProgressEvent[] {
  const location = progressItemEventLocation(input.itemId);
  if (location === null) return [];
  const evidenceRecorded = isProgressEvidenceAnswer(input.answer);
  const hadConflict = input.outcome === "conflict_open";
  return [
    {
      name: "progress.checkin_answered",
      props: {
        family_id: input.familyId,
        child_id: input.childId,
        ...location,
        answer: input.answer,
      },
    },
    ...(evidenceRecorded
      ? [{
          name: "progress.evidence_recorded" as const,
          props: {
            family_id: input.familyId,
            child_id: input.childId,
            source: "check_in" as const,
            items: 1,
            supersedes: false,
          },
        }]
      : []),
    ...(hadConflict
      ? [
          {
            name: "progress.conflict_opened" as const,
            props: {
              family_id: input.familyId,
              child_id: input.childId,
              ...location,
            },
          },
          {
            name: "progress.checkin_paused" as const,
            props: {
              family_id: input.familyId,
              child_id: input.childId,
              reason: "conflict" as const,
            },
          },
        ]
      : []),
    ...(evidenceRecorded
      ? projectionUpdatedEvents({
          familyId: input.familyId,
          childId: input.childId,
          itemIds: [input.itemId],
          hadConflict,
        })
      : []),
    ...(input.outcome === "completed"
      ? [{
          name: "progress.checkin_ended" as const,
          props: {
            family_id: input.familyId,
            child_id: input.childId,
            outcome: "completed" as const,
          },
        }]
      : []),
  ];
}

export interface CommittedProgressConflictResolution {
  familyId: string;
  childId: string;
  itemId: string;
  checkInState: "active" | "completed" | null;
}

export function progressEventsForCheckInResolution(
  input: CommittedProgressConflictResolution,
): ProgressEvent[] {
  const location = progressItemEventLocation(input.itemId);
  if (location === null) return [];
  const events: ProgressEvent[] = [
    {
      name: "progress.conflict_resolved",
      props: {
        family_id: input.familyId,
        child_id: input.childId,
        ...location,
        resolution: "confirmed",
      },
    },
    ...projectionUpdatedEvents({
      familyId: input.familyId,
      childId: input.childId,
      itemIds: [input.itemId],
      hadConflict: false,
    }),
  ];
  switch (input.checkInState) {
    case "active":
      events.push({
        name: "progress.checkin_resumed",
        props: {
          family_id: input.familyId,
          child_id: input.childId,
          takeover: false,
        },
      });
      break;
    case "completed":
      events.push({
        name: "progress.checkin_ended",
        props: {
          family_id: input.familyId,
          child_id: input.childId,
          outcome: "completed",
        },
      });
      break;
    case null:
      break;
    default: {
      const exhaustiveState: never = input.checkInState;
      return exhaustiveState;
    }
  }
  return events;
}

export function progressEventsForWalkAnswer(input: {
  familyId: string;
  childId: string;
  subject: string;
  domain: string;
  answer: MapAnswer;
  evidenceRecorded: boolean;
  projectionUpdated: boolean;
  hadConflict: boolean;
}): ProgressEvent[] {
  return [
    ...(input.evidenceRecorded &&
        isProgressEvidenceAnswer(input.answer)
      ? [{
          name: "progress.evidence_recorded" as const,
          props: {
            family_id: input.familyId,
            child_id: input.childId,
            source: "onboarding_walk" as const,
            items: 1,
            supersedes: false,
          },
        }]
      : []),
    ...(input.hadConflict
      ? [{
          name: "progress.conflict_opened" as const,
          props: {
            family_id: input.familyId,
            child_id: input.childId,
            subject: input.subject,
            domain: input.domain,
          },
        }]
      : []),
    ...(input.projectionUpdated
      ? [{
          name: "progress.projection_updated" as const,
          props: {
            family_id: input.familyId,
            child_id: input.childId,
            subjects_touched: 1,
            had_conflict: input.hadConflict,
          },
        }]
      : []),
  ];
}

async function emitProgressEvent(
  event: ProgressEvent,
  emitter: ProgressEventEmitter | undefined,
): Promise<void> {
  switch (event.name) {
    case "progress.evidence_recorded":
      if (emitter) {
        await emitter("progress.evidence_recorded", event.props);
      } else {
        await emitMapEvent("progress.evidence_recorded", event.props);
      }
      break;
    case "progress.checkin_started":
      if (emitter) {
        await emitter("progress.checkin_started", event.props);
      } else {
        await emitMapEvent("progress.checkin_started", event.props);
      }
      break;
    case "progress.checkin_answered":
      if (emitter) {
        await emitter("progress.checkin_answered", event.props);
      } else {
        await emitMapEvent("progress.checkin_answered", event.props);
      }
      break;
    case "progress.checkin_paused":
      if (emitter) {
        await emitter("progress.checkin_paused", event.props);
      } else {
        await emitMapEvent("progress.checkin_paused", event.props);
      }
      break;
    case "progress.checkin_resumed":
      if (emitter) {
        await emitter("progress.checkin_resumed", event.props);
      } else {
        await emitMapEvent("progress.checkin_resumed", event.props);
      }
      break;
    case "progress.checkin_ended":
      if (emitter) {
        await emitter("progress.checkin_ended", event.props);
      } else {
        await emitMapEvent("progress.checkin_ended", event.props);
      }
      break;
    case "progress.conflict_opened":
      if (emitter) {
        await emitter("progress.conflict_opened", event.props);
      } else {
        await emitMapEvent("progress.conflict_opened", event.props);
      }
      break;
    case "progress.conflict_resolved":
      if (emitter) {
        await emitter("progress.conflict_resolved", event.props);
      } else {
        await emitMapEvent("progress.conflict_resolved", event.props);
      }
      break;
    case "progress.projection_updated":
      if (emitter) {
        await emitter("progress.projection_updated", event.props);
      } else {
        await emitMapEvent("progress.projection_updated", event.props);
      }
      break;
    case "progress.observation_saved":
      if (emitter) {
        await emitter("progress.observation_saved", event.props);
      } else {
        await emitMapEvent("progress.observation_saved", event.props);
      }
      break;
    case "progress.observation_used":
      if (emitter) {
        await emitter("progress.observation_used", event.props);
      } else {
        await emitMapEvent("progress.observation_used", event.props);
      }
      break;
    case "progress.explorer_opened":
      if (emitter) {
        await emitter("progress.explorer_opened", event.props);
      } else {
        await emitMapEvent("progress.explorer_opened", event.props);
      }
      break;
    case "progress.explorer_subject_selected":
      if (emitter) {
        await emitter("progress.explorer_subject_selected", event.props);
      } else {
        await emitMapEvent("progress.explorer_subject_selected", event.props);
      }
      break;
    case "progress.explorer_ability_detail_opened":
      if (emitter) {
        await emitter("progress.explorer_ability_detail_opened", event.props);
      } else {
        await emitMapEvent("progress.explorer_ability_detail_opened", event.props);
      }
      break;
    case "progress.explorer_find_opened":
      if (emitter) {
        await emitter("progress.explorer_find_opened", event.props);
      } else {
        await emitMapEvent("progress.explorer_find_opened", event.props);
      }
      break;
    case "progress.explorer_connected_ability_opened":
      if (emitter) {
        await emitter("progress.explorer_connected_ability_opened", event.props);
      } else {
        await emitMapEvent("progress.explorer_connected_ability_opened", event.props);
      }
      break;
    case "progress.explorer_ask_homa_opened":
      if (emitter) {
        await emitter("progress.explorer_ask_homa_opened", event.props);
      } else {
        await emitMapEvent("progress.explorer_ask_homa_opened", event.props);
      }
      break;
    default: {
      const exhaustiveEvent: never = event;
      return exhaustiveEvent;
    }
  }
}

export async function emitProgressEvents(
  events: readonly ProgressEvent[],
  emitter?: ProgressEventEmitter,
): Promise<void> {
  for (const event of events) {
    try {
      await emitProgressEvent(event, emitter);
    } catch {
      console.error(`Progress event "${event.name}" failed`);
    }
  }
}

export async function withCommittedProgressEvents<T>(
  operation: Promise<T>,
  eventsForResult: (result: T) => Promise<void>,
): Promise<T> {
  const result = await operation;
  try {
    await eventsForResult(result);
  } catch {
    console.error("Committed progress event emission failed");
  }
  return result;
}
