import type { FamilyTaskKind } from "../tasks/kinds";
import {
  beginDeliveryAttempt,
  finishDeliveryAttempt,
  openReplyLoop,
  type DeliveryAttempt,
  type FamilyDeliveryRecipient,
} from "./delivery-ledger";
import {
  aggregateDeliveryOutcomes,
  replyContractForTask,
  type DeliveryAggregate,
  type TaskReplyContract,
} from "./delivery-policy";

export interface TaskDeliveryLedger {
  beginAttempt(
    input: Omit<
      DeliveryAttempt,
      "id" | "existingStatus" | "shouldSend"
    >,
  ): Promise<DeliveryAttempt>;
  finishAttempt(
    attempt: DeliveryAttempt,
    outcome:
      | { delivered: true; providerMessageId?: string | null }
      | { delivered: false; error?: string | null; uncertain?: boolean },
  ): Promise<void>;
  openLoop(
    attempt: DeliveryAttempt,
    contract: TaskReplyContract,
  ): Promise<void>;
}

export interface TaskDeliveryTransports {
  sendSms(
    phone: string,
    text: string,
  ): Promise<
    | boolean
    | { status: "submitted"; messageId: string }
    | { status: "rejected" }
    | { status: "unknown" }
  >;
  sendEmail(
    email: string,
    text: string,
    attempt: DeliveryAttempt,
  ): Promise<
    | boolean
    | { status: "submitted"; messageId: string }
    | { status: "rejected" }
    | { status: "unknown" }
  >;
}

export interface DeliverTaskMessageInput {
  familyId: string;
  episodeId: string;
  messageId: string;
  taskRunId: string | null;
  kind: FamilyTaskKind;
  text: string;
  recipients: FamilyDeliveryRecipient[];
  deliveryMode?: "text" | "email" | "none";
}

export interface TaskDeliveryDependencies {
  ledger: TaskDeliveryLedger;
  transports: TaskDeliveryTransports;
  saveOnly?: boolean;
}

export const postgresTaskDeliveryLedger: TaskDeliveryLedger = {
  async beginAttempt(input) {
    return await beginDeliveryAttempt(input);
  },
  async finishAttempt(attempt, outcome) {
    await finishDeliveryAttempt(attempt, outcome);
  },
  async openLoop(attempt, contract) {
    await openReplyLoop({ attempt, contract });
  },
};

async function attemptSms(
  input: DeliverTaskMessageInput,
  recipient: FamilyDeliveryRecipient,
  dependencies: TaskDeliveryDependencies,
  contract: TaskReplyContract | null,
): Promise<DeliveryAttempt | null> {
  for (const phone of recipient.phoneNumbers) {
    const attempt = await dependencies.ledger.beginAttempt({
      familyId: input.familyId,
      episodeId: input.episodeId,
      messageId: input.messageId,
      taskRunId: input.taskRunId,
      memberUserId: recipient.memberUserId,
      channel: "sms",
      destination: phone,
      providerThreadKey: `telnyx:${phone}`,
    });
    if (!attempt.shouldSend) {
      return attempt.existingStatus === "failed" ? null : attempt;
    }
    if (contract) await dependencies.ledger.openLoop(attempt, contract);
    const submission = await dependencies.transports.sendSms(phone, input.text);
    const delivered =
      submission === true ||
      (typeof submission === "object" && submission.status === "submitted");
    const uncertain =
      typeof submission === "object" && submission.status === "unknown";
    await dependencies.ledger.finishAttempt(
      attempt,
      delivered
        ? {
            delivered: true,
            providerMessageId:
              typeof submission === "object" &&
              submission.status === "submitted"
                ? submission.messageId
                : null,
          }
        : {
            delivered: false,
            error: uncertain ? "SMS submission uncertain" : "SMS send rejected",
            uncertain,
          },
    );
    if (delivered) return { ...attempt, existingStatus: "sent" };
    if (uncertain) return { ...attempt, existingStatus: "uncertain" };
  }
  return null;
}

async function attemptEmail(
  input: DeliverTaskMessageInput,
  recipient: FamilyDeliveryRecipient,
  dependencies: TaskDeliveryDependencies,
  contract: TaskReplyContract | null,
): Promise<DeliveryAttempt | null> {
  if (!recipient.email) return null;
  const attempt = await dependencies.ledger.beginAttempt({
    familyId: input.familyId,
    episodeId: input.episodeId,
    messageId: input.messageId,
    taskRunId: input.taskRunId,
    memberUserId: recipient.memberUserId,
    channel: "email",
    destination: recipient.email,
    providerThreadKey: `email:${recipient.email.toLowerCase()}`,
  });
  if (!attempt.shouldSend) {
    return attempt.existingStatus === "failed" ? null : attempt;
  }
  if (contract) await dependencies.ledger.openLoop(attempt, contract);
  const submission = await dependencies.transports.sendEmail(
    recipient.email,
    input.text,
    attempt,
  );
  const delivered =
    submission === true ||
    (typeof submission === "object" && submission.status === "submitted");
  const uncertain =
    typeof submission === "object" && submission.status === "unknown";
  await dependencies.ledger.finishAttempt(
    attempt,
    delivered
      ? {
          delivered: true,
          providerMessageId:
            typeof submission === "object" &&
            submission.status === "submitted"
              ? submission.messageId
              : null,
        }
      : {
          delivered: false,
          error: uncertain
            ? "Email submission uncertain"
            : "Email send rejected",
          uncertain,
        },
  );
  if (delivered) return { ...attempt, existingStatus: "sent" };
  return uncertain ? { ...attempt, existingStatus: "uncertain" } : null;
}

export async function deliverTaskMessage(
  input: DeliverTaskMessageInput,
  dependencies: TaskDeliveryDependencies,
): Promise<DeliveryAggregate> {
  if (dependencies.saveOnly) {
    return {
      status: "done",
      deliveredChannel: "none",
      deliveredCount: 1,
      failedCount: 0,
    };
  }
  if (input.deliveryMode === "none") {
    return {
      status: "done",
      deliveredChannel: "none",
      deliveredCount: 1,
      failedCount: 0,
    };
  }

  const contract = replyContractForTask(input.kind, input.text);
  const recipientOutcomes: Array<{
    channel: "sms" | "email" | "none";
    delivered: boolean;
    uncertain?: boolean;
  }> = [];

  for (const recipient of input.recipients) {
    const smsAttempt =
      input.deliveryMode === "email"
        ? null
        : await attemptSms(input, recipient, dependencies, contract);
    const successfulAttempt =
      smsAttempt ??
      (await attemptEmail(input, recipient, dependencies, contract));
    recipientOutcomes.push({
      channel:
        successfulAttempt?.existingStatus === "sent" &&
        (successfulAttempt.channel === "sms" ||
          successfulAttempt.channel === "email")
          ? successfulAttempt.channel
          : "none",
      delivered: successfulAttempt?.existingStatus === "sent",
      uncertain:
        successfulAttempt?.existingStatus === "uncertain" ||
        successfulAttempt?.existingStatus === "pending",
    });
  }

  return aggregateDeliveryOutcomes(recipientOutcomes);
}
