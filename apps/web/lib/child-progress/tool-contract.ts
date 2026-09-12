import { createHash } from "node:crypto";

import { z } from "zod";

import { assessmentActionFromHeader } from "./assessment-intent";

import type {
  ProgressCheckInChannel,
  ProgressCheckInContext,
} from "./types";
export {
  ACTIVITY_ONLY_PROGRESS_NOTE,
  AMBIGUOUS_PROGRESS_NOTE,
  DISABLED_PROGRESS_NOTE,
  JOURNAL_HOURS_PROGRESS_NOTE,
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
 * Eve publishes this single object schema to model providers. Anthropic
 * requires a top-level `type: object`, which union-root JSON schemas omit.
 * The stricter discriminated command schema below validates execution.
 */
export const manageChildProgressToolInputSchema = z
  .object({
    action: z
      .enum([
        "start_check_in",
        "respond_check_in",
        "pause_check_in",
        "resume_check_in",
        "stop_check_in",
        "takeover_check_in",
        "record_journal_evidence",
        "resolve_conflict",
        "undo_progress_update",
        "mark_observation_used",
      ])
      .describe(
        "start_check_in needs childId + purpose (+ subjectId for subject_deep_dive). respond_check_in needs checkInId + answer. pause_check_in needs checkInId + reason; resume_check_in, stop_check_in, and takeover_check_in need checkInId. record_journal_evidence needs childId. resolve_conflict needs conflictId. undo_progress_update needs operationId. mark_observation_used needs observationId.",
      ),
    childId: childIdSchema
      .optional()
      .describe("A child id from the family context block."),
    purpose: z
      .enum([
        "whole_map_refresh",
        "subject_deep_dive",
        "age_refresh",
      ])
      .optional()
      .describe("Why this check-in is starting; subject_deep_dive also takes subjectId."),
    subjectId: subjectIdSchema.optional(),
    checkInId: uuidSchema
      .optional()
      .describe("A saved check-in UUID from trusted context or a prior tool result."),
    answer: progressResponseAnswerSchema
      .optional()
      .describe("The parent's reply to the current check-in question, translated faithfully."),
    reason: z.enum(["topic_change", "explicit_stop"]).optional()
      .describe("Only for pause_check_in. Omit reason for stop_check_in and every other action; stop_check_in needs only action and checkInId."),
    conflictId: uuidSchema.optional(),
    operationId: uuidSchema
      .optional()
      .describe("The operation UUID to undo, from the tool result that reported it."),
    observationId: uuidSchema
      .optional()
      .describe("A saved observation UUID that appears in trusted context."),
  })
  .strict();

/**
 * The execution command schema. Strict action objects prevent
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
    z
      .object({
        action: z.literal("mark_observation_used"),
        observationId: uuidSchema,
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

/** Providers can retain declared optional keys with undefined values. Remove
 * only those absent transport fields before strict action validation (#1169).
 * Unknown keys and supplied values still reach the validator and fail closed. */
export function parseManageChildProgressCommand(input: unknown): ManageChildProgressInput {
  const normalized = input !== null && typeof input === "object" && !Array.isArray(input)
    ? Object.fromEntries(Object.entries(input).filter(([key, value]) =>
      value !== undefined || !Object.hasOwn(manageChildProgressToolInputSchema.shape, key)))
    : input;
  return manageChildProgressInputSchema.parse(normalized);
}

interface ProgressToolAuthAttributes {
  selectedAssessment?: unknown;
  memberUserId?: unknown;
  channel?: unknown;
  providerMessageId?: unknown;
  repliedDeliveryId?: unknown;
  activeProgressCheckInId?: unknown;
  activeProgressDeliveryId?: unknown;
  episodeId?: unknown;
  canonicalInboundText?: unknown;
  canonicalInboundMessageId?: unknown;
  taskRunId?: unknown;
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
    // The native app is an authenticated screen surface. Progress evidence
    // stores it as web, matching the canonical conversation row and every
    // existing screen-origin provenance rule.
    case "mobile":
      return "web";
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
  const channel = progressChannelFromAttributes(attributes.channel);
  const activeProgressCheckInId = optionalUuidAttribute(
    attributes.activeProgressCheckInId,
  );
  const activeProgressDeliveryId = optionalUuidAttribute(
    attributes.activeProgressDeliveryId,
  );
  const hasActiveProgressPair =
    channel === "sms" &&
    activeProgressCheckInId !== null &&
    activeProgressDeliveryId !== null;
  return {
    selectedAssessment: channel === "web" ? assessmentActionFromHeader(typeof attributes.selectedAssessment === "string" ? attributes.selectedAssessment : null) : null,
    familyId: input.access.familyId,
    memberUserId: optionalAttribute(attributes.memberUserId),
    channel,
    providerMessageId: optionalAttribute(attributes.providerMessageId),
    repliedDeliveryId:
      channel === "sms"
        ? hasActiveProgressPair
          ? activeProgressDeliveryId
          : null
        : optionalAttribute(attributes.repliedDeliveryId),
    activeProgressCheckInId: hasActiveProgressPair
      ? activeProgressCheckInId
      : null,
    episodeId: optionalAttribute(attributes.episodeId),
    runtimeSessionId: input.sessionId,
    turnId: input.turnId,
    canonicalInboundText: boundedInboundText(
      attributes.canonicalInboundText,
    ),
    inboundMessageId: optionalUuidAttribute(
      attributes.canonicalInboundMessageId,
    ),
    taskRunId: optionalUuidAttribute(attributes.taskRunId),
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
