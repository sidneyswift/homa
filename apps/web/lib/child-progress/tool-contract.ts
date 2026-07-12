import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  ProgressCheckInChannel,
  ProgressCheckInContext,
} from "./types";
export {
  ACTIVITY_ONLY_PROGRESS_NOTE,
  AMBIGUOUS_PROGRESS_NOTE,
  DISABLED_PROGRESS_NOTE,
  manageChildProgressResultSchema,
  NO_MATCH_PROGRESS_NOTE,
  REFUSED_PROGRESS_NOTE,
} from "./tool-result-contract";
export type { ManageChildProgressResult } from "./tool-result-contract";

const uuidSchema = z.string().uuid();
const childIdSchema = uuidSchema;
const subjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/u);
const progressEvidenceAnswerSchema = z.enum([
  "easily",
  "getting_there",
  "not_yet",
]);
const progressResponseAnswerSchema = z.enum([
  "easily",
  "getting_there",
  "not_yet",
  "not_sure",
  "skip",
]);

/**
 * The one model-facing command schema. Strict action objects prevent
 * authenticated identity and server-selected item fields from crossing the
 * tool boundary as model input.
 */
export const manageChildProgressInputSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("start_check_in"),
        childId: childIdSchema,
        purpose: z.enum([
          "whole_map_refresh",
          "subject_deep_dive",
          "age_refresh",
        ]),
        subjectId: subjectIdSchema.optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal("respond_check_in"),
        checkInId: uuidSchema,
        answer: progressResponseAnswerSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("pause_check_in"),
        checkInId: uuidSchema,
        reason: z.enum(["topic_change", "explicit_stop"]),
      })
      .strict(),
    z
      .object({
        action: z.literal("resume_check_in"),
        checkInId: uuidSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("stop_check_in"),
        checkInId: uuidSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("takeover_check_in"),
        checkInId: uuidSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("record_journal_evidence"),
        childId: childIdSchema,
        subjectId: subjectIdSchema.optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal("resolve_conflict"),
        conflictId: uuidSchema,
        answer: progressEvidenceAnswerSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("undo_progress_update"),
        operationId: uuidSchema,
      })
      .strict(),
  ])
  .superRefine((input, context) => {
    if (
      input.action === "start_check_in" &&
      input.purpose === "subject_deep_dive" &&
      input.subjectId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["subjectId"],
        message: "A subject deep dive requires a subjectId",
      });
    }
  });

export type ManageChildProgressInput = z.infer<
  typeof manageChildProgressInputSchema
>;

interface ProgressToolAuthAttributes {
  memberUserId?: unknown;
  channel?: unknown;
  providerMessageId?: unknown;
  repliedDeliveryId?: unknown;
  episodeId?: unknown;
  canonicalInboundText?: unknown;
  canonicalInboundMessageId?: unknown;
}

function optionalAttribute(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function optionalUuidAttribute(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function boundedInboundText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return Array.from(trimmed).slice(0, 8_000).join("");
}

function progressChannelFromAttributes(
  value: unknown,
): ProgressCheckInChannel {
  if (value === undefined || value === null || value === "") return "web";
  if (typeof value !== "string") {
    throw new TypeError("Unsupported progress tool channel");
  }
  switch (value) {
    case "web":
    case "sms":
    case "email":
    case "dispatch":
    case "voice":
      return value;
    default:
      throw new TypeError("Unsupported progress tool channel");
  }
}

/**
 * Builds trusted service context from resolved access plus channel-stamped
 * attributes. The model command is deliberately not an input to this helper.
 */
export function createProgressToolContext(input: {
  access: { familyId: string };
  attributes: unknown;
  sessionId: string;
  turnId: string;
  now?: Date;
}): ProgressCheckInContext {
  const attributes = (input.attributes ?? {}) as ProgressToolAuthAttributes;
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("Progress tool requires a valid server time");
  }
  if (
    input.sessionId.trim().length === 0 ||
    input.turnId.trim().length === 0
  ) {
    throw new TypeError(
      "Progress tool requires trusted session and turn identity",
    );
  }
  return {
    familyId: input.access.familyId,
    memberUserId: optionalAttribute(attributes.memberUserId),
    channel: progressChannelFromAttributes(attributes.channel),
    providerMessageId: optionalAttribute(attributes.providerMessageId),
    repliedDeliveryId: optionalAttribute(attributes.repliedDeliveryId),
    episodeId: optionalAttribute(attributes.episodeId),
    runtimeSessionId: input.sessionId,
    turnId: input.turnId,
    canonicalInboundText: boundedInboundText(
      attributes.canonicalInboundText,
    ),
    inboundMessageId: optionalUuidAttribute(
      attributes.canonicalInboundMessageId,
    ),
    now: now.toISOString(),
  };
}

/**
 * Derives operation idempotency from trusted transport or runtime identity.
 */
export function progressOperationIdempotencyKey(
  context: ProgressCheckInContext,
  action: ManageChildProgressInput["action"],
): string {
  const source =
    context.providerMessageId === null
      ? [
          "runtime",
          context.runtimeSessionId,
          context.turnId,
        ]
      : [
          "provider",
          context.channel,
          context.providerMessageId,
        ];
  const digest = createHash("sha256")
    .update([action, ...source].join("\u0000"))
    .digest("hex");
  return `agent-progress:${action}:${digest}`;
}
