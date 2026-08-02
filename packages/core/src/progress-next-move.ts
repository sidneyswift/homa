import { z } from "zod";

import {
  childProgressViewSchema,
  progressEvidenceAnswerSchema,
  progressEvidenceDerivationSchema,
  progressSourceKindSchema,
} from "./child-progress-view";

export const PROGRESS_NEXT_MOVE_CHAT_CHILD_HEADER =
  "x-homa-progress-next-move-child";
export const PROGRESS_NEXT_MOVE_CHAT_FINGERPRINT_HEADER =
  "x-homa-progress-next-move-fingerprint";

const parentCopySchema = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => Array.from(value).length <= maximum,
      `must contain at most ${maximum} characters`,
    )
    .refine((value) => !value.includes("\u2014"), "em dash is not allowed");

export const progressNextMoveEvidenceSchema = z
  .object({
    evidenceId: z.string().uuid(),
    itemId: z.string().min(1).max(160),
    statement: parentCopySchema(240),
    answer: progressEvidenceAnswerSchema,
    derivation: progressEvidenceDerivationSchema.exclude(["unknown"]),
    sourceKind: progressSourceKindSchema,
    adultDisplayName: parentCopySchema(80).nullable(),
    observedAt: z.string().min(1).max(80),
    receipt: parentCopySchema(180),
  })
  .strict();

const progressNextMoveFields = {
  childId: z.string().uuid(),
  sourceRevision: z.string().regex(/^\d+$/u).max(40),
};

export const progressNextMoveSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...progressNextMoveFields,
      kind: z.literal("move"),
      targetItemId: z.string().min(1).max(160),
      targetStatement: parentCopySchema(240),
      minutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
      activity: parentCopySchema(320),
      why: parentCopySchema(240),
      evidence: z.array(progressNextMoveEvidenceSchema).min(1).max(3),
      chatDraft: parentCopySchema(500),
    })
    .strict(),
  z
    .object({
      ...progressNextMoveFields,
      kind: z.literal("clarify"),
      reason: z.enum([
        "conflict",
        "stale",
        "sparse",
        "unknown_provenance",
      ]),
      title: parentCopySchema(80),
      question: parentCopySchema(240),
      why: parentCopySchema(240),
      chatDraft: parentCopySchema(500),
    })
    .strict(),
  z
    .object({
      ...progressNextMoveFields,
      kind: z.literal("none"),
      reason: z.enum(["producer_stopped", "unavailable", "dismissed"]),
    })
    .strict(),
]);

export const progressNextMoveContextFingerprintSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u);

export const progressNextMoveDismissRequestSchema = z
  .object({
    contextFingerprint: progressNextMoveContextFingerprintSchema,
  })
  .strict();

export const progressNextMoveResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      ok: z.literal(true),
      status: z.literal("pending"),
      contextFingerprint: progressNextMoveContextFingerprintSchema,
      sourceRevision: progressNextMoveFields.sourceRevision,
      view: childProgressViewSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(true),
      status: z.literal("settled"),
      contextFingerprint: progressNextMoveContextFingerprintSchema,
      sourceRevision: progressNextMoveFields.sourceRevision,
      view: childProgressViewSchema,
      nextMove: progressNextMoveSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(true),
      status: z.literal("failed"),
      contextFingerprint: progressNextMoveContextFingerprintSchema,
      sourceRevision: progressNextMoveFields.sourceRevision,
      view: childProgressViewSchema,
      reason: z.literal("producer_unavailable"),
    })
    .strict(),
]);

export type ProgressNextMoveEvidence = z.infer<
  typeof progressNextMoveEvidenceSchema
>;
export type ProgressNextMove = z.infer<typeof progressNextMoveSchema>;
export type ProgressNextMoveResponse = z.infer<
  typeof progressNextMoveResponseSchema
>;
export type ProgressNextMoveDismissRequest = z.infer<
  typeof progressNextMoveDismissRequestSchema
>;

export function parseProgressNextMoveResponse(
  value: unknown,
): ProgressNextMoveResponse {
  return progressNextMoveResponseSchema.parse(value);
}
