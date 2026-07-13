import { z } from "zod";

import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import type { ChildProgressView } from "./types";

export const CHILD_PROGRESS_PROJECTION_VERSION = "2";

const offsetTimestampSchema = z.string().refine((value) => {
  try {
    parseOffsetIsoTimestampEpochNanoseconds(value);
    return true;
  } catch {
    return false;
  }
});
const ianaTimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
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
]);
const evidenceSourceViewSchema = z
  .object({
    kind: progressSourceSchema,
    adultDisplayName: z.string().nullable(),
    checkInId: z.string().nullable(),
  })
  .strict();
const evidenceTopicFields = {
  itemId: z.string(),
  statement: z.string(),
  detail: z.string(),
  answer: progressAnswerSchema,
  source: evidenceSourceViewSchema,
  observedAt: offsetTimestampSchema,
};
const progressTopicSchema = z.discriminatedUnion("state", [
  z
    .object({
      ...evidenceTopicFields,
      state: z.literal("observed_today"),
    })
    .strict(),
  z
    .object({
      ...evidenceTopicFields,
      state: z.literal("older"),
    })
    .strict(),
  z
    .object({
      itemId: z.string(),
      statement: z.string(),
      detail: z.string(),
      state: z.literal("ask_next"),
      answer: z.null(),
      source: z.null(),
      observedAt: z.null(),
    })
    .strict(),
  z
    .object({
      itemId: z.string(),
      statement: z.string(),
      detail: z.string(),
      state: z.literal("conflict"),
      answer: z.null(),
      source: z.null(),
      observedAt: offsetTimestampSchema,
    })
    .strict(),
]);
const progressDomainSchema = z
  .object({
    domainId: z.string(),
    displayName: z.string(),
    topics: z.array(progressTopicSchema),
  })
  .strict();
const progressSubjectSummarySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("evidence"),
      observedAt: offsetTimestampSchema,
      source: evidenceSourceViewSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("conflict"),
      observedAt: offsetTimestampSchema,
      adultDisplayNames: z.tuple([
        z.string().nullable(),
        z.string().nullable(),
      ]),
    })
    .strict(),
]);
const progressSubjectSchema = z
  .object({
    subjectId: z.string(),
    displayName: z.string(),
    evidenceCount: z.number().int().nonnegative(),
    latestObservedAt: offsetTimestampSchema.nullable(),
    state: z.enum(["updated_recently", "older", "conflict"]),
    summary: progressSubjectSummarySchema.nullable(),
    domains: z.array(progressDomainSchema),
  })
  .strict();
const conflictAdultAnswerSchema = z
  .object({
    evidenceId: z.string(),
    adultDisplayName: z.string().nullable(),
    answer: progressAnswerSchema,
    observedAt: offsetTimestampSchema,
    source: evidenceSourceViewSchema,
  })
  .strict();
const openConflictViewSchema = z
  .object({
    id: z.string(),
    childId: z.string(),
    familyId: z.string(),
    itemId: z.string(),
    adultAnswers: z.tuple([
      conflictAdultAnswerSchema,
      conflictAdultAnswerSchema,
    ]),
    observedAt: offsetTimestampSchema,
    state: z.literal("open"),
    resolvedAnswer: z.null(),
    resolvedEvidenceId: z.null(),
    resolvedAt: z.null(),
  })
  .strict();
const subjectScoreSchema = z
  .object({
    subjectId: z.string(),
    position: z.enum([
      "ahead",
      "on_track",
      "growing",
      "not_mapped",
    ]),
    monthsAhead: z.number().int().nullable(),
    frontierDeltaMonths: z.number().int().nullable(),
    beyondScale: z.boolean(),
    highConfidence: z.boolean(),
    observations: z.number().int().nonnegative(),
    strongestObservedStatement: z.string().nullable(),
    strongestObservedMonths: z.number().int().nullable(),
    frontierStatement: z.string().nullable(),
    exposureBased: z.boolean(),
  })
  .strict();
const mapScoresSchema = z
  .object({
    subjects: z.array(subjectScoreSchema),
    strengthOrder: z.array(z.string()),
    mappedCount: z.number().int().nonnegative(),
    totalSubjects: z.number().int().nonnegative(),
    observationCount: z.number().int().nonnegative(),
  })
  .strict();

export const childProgressViewSchema = z
  .object({
    childId: z.string(),
    childName: z.string(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    timeZone: ianaTimeZoneSchema,
    projectedAt: offsetTimestampSchema,
    scores: mapScoresSchema,
    subjects: z.array(progressSubjectSchema),
    conflicts: z.array(openConflictViewSchema),
  })
  .strict();

export function parseChildProgressView(
  value: unknown,
): ChildProgressView {
  return childProgressViewSchema.parse(value);
}
