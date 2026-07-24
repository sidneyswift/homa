import {
  postgresSmsSuppressionStore,
  type SmsSuppressionStore,
} from "../sms-suppression";
import type { FamilyTaskKind } from "../tasks/kinds";
import {
  beginDeliveryAttempt,
  enrichDeliveryAttemptProviderMessageId,
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
      | {
          delivered: true;
          providerSubmissionId?: string | null;
          providerMessageId?: string | null;
        }
      | { delivered: false; error?: string | null; uncertain?: boolean },
  ): Promise<void>;
  enrichProviderMessageId?(
    attempt: DeliveryAttempt,
    providerSubmissionId: string,
    providerMessageId: string,
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
    | {
        status: "rejected";
        reason?: string;
        permanentCode?: string;
        unsupportedRegion?: boolean;
      }
    | { status: "unknown" }
  >;
  sendEmail(
    email: string,
    text: string,
    attempt: DeliveryAttempt,
  ): Promise<
    | boolean
    | {
        status: "submitted";
        providerSubmissionId: string;
        retrieveProviderMessageId(): Promise<string | null>;
      }
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
  onTransportAccepted?(channel: "sms" | "email" | "none"): void;
  /** Defaults to the postgres sms_suppressions store; tests inject. */
  smsSuppression?: SmsSuppressionStore;
  /** Fired when the provider rejects an SMS because it cannot reach the
   * destination's region (Telnyx 40309). The current message still falls
   * back to email in this same pass; this signal lets the caller stop
   * texting that family on FUTURE runs (email-only), so an un-textable
   * number is not retried and re-logged every day. `destination` is the
   * rejected phone, for the caller's audit; the switch itself is
   * family-scoped by the caller. */
  onUnsupportedRegion?(destination: string): void | Promise<void>;
}

export const postgresTaskDeliveryLedger: TaskDeliveryLedger = {
  async beginAttempt(input) {
    return await beginDeliveryAttempt(input);
  },
  async finishAttempt(attempt, outcome) {
    await finishDeliveryAttempt(attempt, outcome);
  },
  async enrichProviderMessageId(
    attempt,
    providerSubmissionId,
    providerMessageId,
  ) {
    await enrichDeliveryAttemptProviderMessageId(
      attempt,
      providerSubmissionId,
      providerMessageId,
    );
  },
  async openLoop(attempt, contract) {
    await openReplyLoop({ attempt, contract });
  },
};

interface SmsAttemptOutcome {
  attempt: DeliveryAttempt | null;
  /** A suppressed number or a provider-permanent rejection (STOP,
   * invalid destination). The failed ledger attempt IS the record;
   * email must not silently replace it (escalation ruling 2026-07-23:
   * a hard-failed SMS is a failed delivery, not an invisible email). */
  hardFailed: boolean;
}

async function attemptSms(
  input: DeliverTaskMessageInput,
  recipient: FamilyDeliveryRecipient,
  dependencies: TaskDeliveryDependencies,
  contract: TaskReplyContract | null,
): Promise<SmsAttemptOutcome> {
  const suppressionStore =
    dependencies.smsSuppression ?? postgresSmsSuppressionStore;
  let hardFailed = false;
  for (const phone of recipient.phoneNumbers) {
    const suppression = await suppressionStore.find(phone);
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
      if (attempt.existingStatus === "sent") {
        dependencies.onTransportAccepted?.("sms");
      }
      return attempt.existingStatus === "failed"
        ? { attempt: null, hardFailed: false }
        : { attempt, hardFailed: false };
    }
    if (suppression) {
      // The recorded skip: this number opted out or is invalid, so the
      // attempt exists in the ledger and fails with its reason instead
      // of burning a send into a guaranteed provider rejection.
      await dependencies.ledger.finishAttempt(attempt, {
        delivered: false,
        error: `SMS suppressed (${suppression.reason})`,
      });
      hardFailed = true;
      continue;
    }
    if (contract) await dependencies.ledger.openLoop(attempt, contract);
    const submission = await dependencies.transports.sendSms(phone, input.text);
    const delivered =
      submission === true ||
      (typeof submission === "object" && submission.status === "submitted");
    const uncertain =
      typeof submission === "object" && submission.status === "unknown";
    // A transport that knows WHY it refused (segment cap, provider
    // error code) puts that reason on the founder's alert instead of
    // the generic line.
    const rejectionReason =
      typeof submission === "object" && submission.status === "rejected"
        ? submission.reason
        : undefined;
    // The provider says this destination's region is unreachable from our
    // profile: not a transient failure, so tell the caller to stop texting
    // this family going forward (email-only). Email fallback below still
    // delivers today's message.
    if (
      typeof submission === "object" &&
      submission.status === "rejected" &&
      submission.unsupportedRegion
    ) {
      await dependencies.onUnsupportedRegion?.(phone);
    }
    if (delivered) dependencies.onTransportAccepted?.("sms");
    await dependencies.ledger.finishAttempt(
      attempt,
      delivered
        ? {
            delivered: true,
            providerMessageId:
              typeof submission === "object" &&
              submission.status === "submitted"
                ? (submission.messageId ?? null)
                : null,
          }
        : {
            delivered: false,
            error: uncertain
              ? "SMS submission uncertain"
              : (rejectionReason ?? "SMS send rejected"),
            uncertain,
          },
    );
    if (delivered) return { attempt: { ...attempt, existingStatus: "sent" }, hardFailed: false };
    if (uncertain) return { attempt: { ...attempt, existingStatus: "uncertain" }, hardFailed: false };
    const permanentCode =
      typeof submission === "object" && submission.status === "rejected"
        ? submission.permanentCode
        : undefined;
    if (permanentCode) {
      await suppressionStore.suppress(phone, `telnyx-${permanentCode}`);
      hardFailed = true;
    }
  }
  return { attempt: null, hardFailed };
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
    if (attempt.existingStatus === "sent") {
      dependencies.onTransportAccepted?.("email");
    }
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
  if (delivered) dependencies.onTransportAccepted?.("email");
  await dependencies.ledger.finishAttempt(
    attempt,
    delivered
      ? {
          delivered: true,
          providerSubmissionId:
            typeof submission === "object" &&
            submission.status === "submitted"
              ? submission.providerSubmissionId
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
  if (
    delivered &&
    typeof submission === "object" &&
    submission.status === "submitted"
  ) {
    try {
      const providerMessageId =
        await submission.retrieveProviderMessageId();
      if (providerMessageId) {
        await dependencies.ledger.enrichProviderMessageId?.(
          attempt,
          submission.providerSubmissionId,
          providerMessageId,
        );
      }
    } catch {
      console.error("task email RFC Message-ID enrichment failed");
    }
  }
  if (delivered) return { ...attempt, existingStatus: "sent" };
  return uncertain ? { ...attempt, existingStatus: "uncertain" } : null;
}

export async function deliverTaskMessage(
  input: DeliverTaskMessageInput,
  dependencies: TaskDeliveryDependencies,
): Promise<DeliveryAggregate> {
  if (dependencies.saveOnly) {
    dependencies.onTransportAccepted?.("none");
    return {
      status: "done",
      deliveredChannel: "none",
      deliveredCount: 1,
      failedCount: 0,
    };
  }
  if (input.deliveryMode === "none") {
    dependencies.onTransportAccepted?.("none");
    return {
      status: "done",
      deliveredChannel: "none",
      deliveredCount: 1,
      failedCount: 0,
    };
  }

  const contract = replyContractForTask(
    input.kind,
    input.text,
    input.taskRunId,
  );
  const recipientOutcomes: Array<{
    channel: "sms" | "email" | "none";
    delivered: boolean;
    uncertain?: boolean;
  }> = [];

  for (const recipient of input.recipients) {
    const smsOutcome =
      input.deliveryMode === "email"
        ? null
        : await attemptSms(input, recipient, dependencies, contract);
    const successfulAttempt =
      smsOutcome?.attempt ??
      (smsOutcome?.hardFailed
        ? null
        : await attemptEmail(input, recipient, dependencies, contract));
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
