import { z } from "zod";

import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import type {
  ProgressCheckInPrompt,
  ProgressCheckInRecord,
  ProgressCheckInResponseOutcome,
  ProgressConflictCard,
  ProgressConflictResolvedOutcome,
} from "./types";

const identifierSchema = z.string().min(1);
const offsetTimestampSchema = z.string().refine((value) => {
  try {
    parseOffsetIsoTimestampEpochNanoseconds(value);
    return true;
  } catch {
    return false;
  }
});
const purposeSchema = z.enum([
  "whole_map_refresh",
  "subject_deep_dive",
  "age_refresh",
  "journal_followup",
]);
const pauseReasonSchema = z.enum([
  "topic_change",
  "explicit_pause",
  "delivery_uncertain",
  "delivery_failed",
  "conflict",
  "member_removed",
]);
const progressAnswerSchema = z.enum([
  "easily",
  "getting_there",
  "not_yet",
]);
const progressSourceSchema = z.enum([
  "journal",
  "conversation",
  "check_in",
  "checklist",
  "deep_dive",
  "correction",
  "report_correction",
  "report_probe",
  "recheck",
  "onboarding_walk",
  "legacy",
  "lesson_listen",
]);
const scopeSchema = z
  .object({
    subjectIds: z.array(identifierSchema).min(1).optional(),
  })
  .strict();
const recordCommonFields = {
  id: identifierSchema,
  childId: identifierSchema,
  childName: identifierSchema,
  familyId: identifierSchema,
  purpose: purposeSchema,
  scope: scopeSchema,
  ownerMemberUserId: identifierSchema.nullable(),
  ownerDisplayName: z.string().nullable(),
  recipientMemberUserId: identifierSchema.nullable(),
  recipientDisplayName: z.string().nullable(),
  revision: z.number().int().positive(),
  currentDeliveryId: identifierSchema.nullable(),
  episodeId: identifierSchema.nullable(),
  pendingRuntimeSessionId: identifierSchema.nullable(),
  pendingTurnId: identifierSchema.nullable(),
  openedAt: offsetTimestampSchema,
  updatedAt: offsetTimestampSchema,
};

export const progressCheckInRecordSchema = z
  .discriminatedUnion(
    "state",
    [
    z
      .object({
        ...recordCommonFields,
        state: z.literal("active"),
        currentItemId: identifierSchema,
        pauseReason: z.null(),
        pausedAt: z.null(),
        completedAt: z.null(),
        stoppedAt: z.null(),
      })
      .strict(),
    z
      .object({
        ...recordCommonFields,
        state: z.literal("paused"),
        currentItemId: identifierSchema,
        pauseReason: pauseReasonSchema,
        pausedAt: offsetTimestampSchema,
        completedAt: z.null(),
        stoppedAt: z.null(),
      })
      .strict(),
    z
      .object({
        ...recordCommonFields,
        state: z.literal("completed"),
        currentItemId: z.null(),
        pauseReason: z.null(),
        pausedAt: z.null(),
        completedAt: offsetTimestampSchema,
        stoppedAt: z.null(),
      })
      .strict(),
    z
      .object({
        ...recordCommonFields,
        state: z.literal("stopped"),
        currentItemId: z.null(),
        pauseReason: z.null(),
        pausedAt: z.null(),
        completedAt: z.null(),
        stoppedAt: offsetTimestampSchema,
      })
      .strict(),
    ],
  )
  .superRefine((record, context) => {
    const hasMarker =
      record.pendingRuntimeSessionId !== null &&
      record.pendingTurnId !== null;
    const hasPartialMarker =
      (
        record.pendingRuntimeSessionId === null
      ) !== (record.pendingTurnId === null);
    const mustHaveMarker =
      record.state === "active" ||
      (
        record.state === "paused" &&
        record.pauseReason === "conflict"
      );
    if (hasPartialMarker || hasMarker !== mustHaveMarker) {
      context.addIssue({
        code: "custom",
        path: ["pendingRuntimeSessionId"],
        message: "Prompt marker does not match check-in state",
      });
    }
  });

export const progressCheckInPromptSchema = z
  .object({
    checkInId: identifierSchema,
    revision: z.number().int().positive(),
    childId: identifierSchema,
    childName: identifierSchema,
    itemId: identifierSchema,
    personalizedStatement: z.string().min(1),
    subjectDisplayName: z.string().min(1),
    state: z.enum(["active", "paused", "completed", "stopped"]),
    ownerDisplayName: z.string().nullable(),
  })
  .strict();

const conflictCardAnswerSchema = z
  .object({
    evidenceId: identifierSchema,
    answer: progressAnswerSchema,
    adultDisplayName: z.string().nullable(),
    observedAt: offsetTimestampSchema,
    source: progressSourceSchema,
  })
  .strict();

const progressCheckInUpdateSchema = z
  .object({
    operationId: z.string().uuid(),
    affectedItemIds: z.array(identifierSchema).min(1),
    affectedTopics: z.array(z.string().min(1)).min(1),
    undoAvailable: z.literal(true),
  })
  .strict();

export const progressConflictCardSchema = z
  .object({
    id: identifierSchema,
    childId: identifierSchema,
    childName: identifierSchema,
    itemId: identifierSchema,
    skillStatement: z.string().min(1),
    subjectDisplayName: z.string().min(1),
    answers: z.tuple([
      conflictCardAnswerSchema,
      conflictCardAnswerSchema,
    ]),
  })
  .strict();

const advancedOutcomeSchema = z
  .object({
    status: z.literal("advanced"),
    checkIn: progressCheckInRecordSchema,
    prompt: progressCheckInPromptSchema,
    responseId: identifierSchema,
    progressUpdate: progressCheckInUpdateSchema.optional(),
  })
  .strict();
const completedOutcomeSchema = z
  .object({
    status: z.literal("completed"),
    checkIn: progressCheckInRecordSchema,
    responseId: identifierSchema,
    progressUpdate: progressCheckInUpdateSchema.optional(),
  })
  .strict();
const conflictOpenOutcomeSchema = z
  .object({
    status: z.literal("conflict_open"),
    checkIn: progressCheckInRecordSchema,
    conflict: progressConflictCardSchema,
    responseId: identifierSchema,
  })
  .strict();

export const storedProgressCheckInResponseOutcomeSchema =
  z.discriminatedUnion("status", [
    advancedOutcomeSchema,
    completedOutcomeSchema,
    conflictOpenOutcomeSchema,
  ]);

export const progressConflictResolvedOutcomeSchema = z
  .object({
    status: z.literal("conflict_resolved"),
    conflictId: identifierSchema,
    selectedEvidenceId: identifierSchema,
    checkIn: progressCheckInRecordSchema.nullable(),
    prompt: progressCheckInPromptSchema.nullable(),
  })
  .strict();

export function parseProgressCheckInRecord(
  value: unknown,
): ProgressCheckInRecord {
  return progressCheckInRecordSchema.parse(value);
}

export function parseProgressCheckInPrompt(
  value: unknown,
): ProgressCheckInPrompt {
  return progressCheckInPromptSchema.parse(value);
}

export function parseProgressConflictCard(
  value: unknown,
): ProgressConflictCard {
  return progressConflictCardSchema.parse(value);
}

export function parseStoredProgressCheckInResponseOutcome(
  value: unknown,
): ProgressCheckInResponseOutcome {
  return storedProgressCheckInResponseOutcomeSchema.parse(value);
}

export function parseProgressConflictResolvedOutcome(
  value: unknown,
): ProgressConflictResolvedOutcome {
  return progressConflictResolvedOutcomeSchema.parse(value);
}
