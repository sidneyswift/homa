import type { FamilyTaskKind } from "../tasks/kinds";

export interface DeliveryOutcome {
  channel: "sms" | "email" | "none";
  delivered: boolean;
  uncertain?: boolean;
}

export interface DeliveryAggregate {
  status:
    | "done"
    | "partial"
    | "partial_uncertain"
    | "uncertain"
    | "failed";
  deliveredChannel: "sms" | "email" | "none" | null;
  deliveredCount: number;
  failedCount: number;
}

export interface DurableDeliveryAttempt {
  recipientKey: string;
  channel: "sms" | "email";
  status: "pending" | "sent" | "failed" | "uncertain";
}

export function aggregateDurableDeliveryAttempts(
  attempts: readonly DurableDeliveryAttempt[],
): DeliveryAggregate {
  const attemptsByRecipient = new Map<string, DurableDeliveryAttempt[]>();
  for (const attempt of attempts) {
    const recipientAttempts = attemptsByRecipient.get(attempt.recipientKey) ?? [];
    recipientAttempts.push(attempt);
    attemptsByRecipient.set(attempt.recipientKey, recipientAttempts);
  }
  return aggregateDeliveryOutcomes(
    [...attemptsByRecipient.values()].map((recipientAttempts) => {
      const sent = recipientAttempts.find((attempt) => attempt.status === "sent");
      if (sent) {
        return { channel: sent.channel, delivered: true };
      }
      return {
        channel: "none",
        delivered: false,
        uncertain: recipientAttempts.some(
          (attempt) =>
            attempt.status === "pending" || attempt.status === "uncertain",
        ),
      };
    }),
  );
}

export function aggregateDeliveryOutcomes(
  outcomes: DeliveryOutcome[],
): DeliveryAggregate {
  const delivered = outcomes.filter((outcome) => outcome.delivered);
  const uncertainCount = outcomes.filter(
    (outcome) => !outcome.delivered && outcome.uncertain,
  ).length;
  const failedCount = outcomes.length - delivered.length - uncertainCount;
  return {
    status:
      delivered.length === 0
        ? uncertainCount > 0
          ? "uncertain"
          : "failed"
        : failedCount > 0 || uncertainCount > 0
          ? uncertainCount > 0 && failedCount === 0
            ? "partial_uncertain"
            : "partial"
          : "done",
    deliveredChannel: delivered[0]?.channel ?? null,
    deliveredCount: delivered.length,
    failedCount,
  };
}

export interface TaskReplyContract {
  kind: "yes_no" | "free_text" | "choice" | "approval";
  promptKey: string;
  expiresAfterMs: number;
}

export function replyContractForReactiveMessage(
  text: string,
): TaskReplyContract | null {
  return /\?\s*$/u.test(text)
    ? {
        kind: "free_text",
        promptKey: "reactive-question",
        expiresAfterMs: 24 * 60 * 60_000,
      }
    : null;
}

/**
 * Pins a reply loop to the exact durable progress prompt that was delivered.
 * The workflow's revision check still decides whether a later answer is current.
 */
export function replyContractForProgressCheckIn(
  checkInId: string,
  revision: number,
): TaskReplyContract {
  if (checkInId.trim().length === 0 || !Number.isInteger(revision) || revision < 1) {
    throw new TypeError("Progress reply contract requires a current prompt");
  }
  return {
    kind: "choice",
    promptKey: `progress-check-in:${checkInId}:revision:${revision}`,
    expiresAfterMs: 24 * 60 * 60_000,
  };
}

export function replyContractForTask(
  kind: FamilyTaskKind,
  text: string,
  taskRunId: string | null = null,
): TaskReplyContract | null {
  switch (kind) {
    case "morning_brief":
      if (!/\?\s*$/u.test(text)) return null;
      return {
        kind: "yes_no",
        promptKey: `morning-brief:${taskRunId ?? "legacy"}`,
        expiresAfterMs: 24 * 60 * 60_000,
      };
    case "journal_prompt":
      if (!/\?\s*$/u.test(text)) return null;
      return {
        kind: "free_text",
        promptKey: "evening-check-in",
        expiresAfterMs: 24 * 60 * 60_000,
      };
    case "custom":
      return null;
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled task reply contract: ${String(exhaustive)}`);
    }
  }
}
