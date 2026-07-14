import { createHash } from "node:crypto";

import { z } from "zod";

import { progressConflictResolvedOutcomeSchema } from "./check-in-schema";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";

const offsetTimestampSchema = z.string().refine((value) => {
  try {
    parseOffsetIsoTimestampEpochNanoseconds(value);
    return true;
  } catch {
    return false;
  }
});
const evidenceSchema = z
  .object({
    id: z.string(),
    childId: z.string(),
    familyId: z.string(),
    itemId: z.string(),
    answer: z.enum(["easily", "getting_there", "not_yet"]),
    source: z.enum([
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
    ]),
    memberUserId: z.string().nullable(),
    adultDisplayName: z.string().nullable(),
    quote: z.string().nullable(),
    channel: z
      .enum(["web", "sms", "email", "dispatch", "voice", "lesson"])
      .nullable(),
    messageId: z.string().uuid().nullable(),
    checkInId: z.string().nullable(),
    supersedesId: z.string().nullable(),
    supersededAt: offsetTimestampSchema.nullable(),
    observedAt: offsetTimestampSchema,
    createdAt: offsetTimestampSchema,
  })
  .strict();

const journalMatchSchema = z
  .object({
    itemId: z.string(),
    score: z.number().finite(),
    answer: z.enum(["easily", "getting_there", "not_yet"]),
    clause: z.string(),
    span: z
      .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const storedChildProgressOperationResultSchema =
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("activity_only") }).strict(),
    z.object({ status: z.literal("no_match") }).strict(),
    z
      .object({
        status: z.literal("ambiguous"),
        candidates: z.array(journalMatchSchema),
      })
      .strict(),
    z
      .object({
        status: z.literal("recorded"),
        evidence: z.array(evidenceSchema),
        affectedItemIds: z.array(z.string()),
        conflictIds: z.array(z.string()),
      })
      .strict(),
    z
      .object({
        status: z.literal("conflict_open"),
        evidence: z.array(evidenceSchema),
        affectedItemIds: z.array(z.string()),
        conflictIds: z.array(z.string()),
      })
      .strict(),
    z
      .object({
        status: z.literal("conflict_pending"),
        conflictId: z.string(),
        itemId: z.string(),
      })
      .strict(),
    z
      .object({
        status: z.literal("answers_corrected"),
        childId: z.string(),
        childName: z.string(),
        evidence: z.array(evidenceSchema),
        affectedItemIds: z.array(z.string()),
      })
      .strict(),
    z
      .object({
        status: z.literal("undone"),
        childId: z.string(),
        childName: z.string(),
        evidenceId: z.string().optional(),
        operationId: z.string().uuid().optional(),
        evidenceIds: z.array(z.string()).optional(),
        affectedItemIds: z.array(z.string()),
      })
      .strict(),
    progressConflictResolvedOutcomeSchema,
  ]);

export type StoredChildProgressOperationResult = z.infer<
  typeof storedChildProgressOperationResultSchema
>;

function canonicalizePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizePayload);
  }
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizePayload(entry)]),
  );
}

export function hashChildProgressOperationPayload(
  payload: unknown,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizePayload(payload)))
    .digest("hex");
}
