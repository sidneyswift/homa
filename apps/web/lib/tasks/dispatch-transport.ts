import {
  listFamilyDeliveryRecipients,
  type FamilyDeliveryRecipient,
} from "../conversation-continuity/delivery-ledger";
import { buildSignedReplyAddress } from "../conversation-continuity/email-reply-auth";
import { findCurrentOfferRecoveryRecipient } from "../conversation-continuity/offer-recovery";
import { selectTaskDeliveryRecipients } from "../conversation-continuity/task-recipients";
import {
  deliverTaskMessage,
  postgresTaskDeliveryLedger,
  type TaskDeliveryLedger,
  type TaskDeliveryTransports,
} from "../conversation-continuity/task-delivery";
import {
  submitAgentComposedEmail,
  submitJournalAgentEmail,
  submitResearchBriefEmail,
  type HomaEmailSubmission,
} from "../map/email";
import { submitHomaSms } from "../voice/telnyx-api";
import type { TaskDeliveryVersion } from "./delivery-version";
import type { FamilyTaskKind } from "./kinds";
import { markFamilyTextSchedulesEmailOnly } from "./store";

export interface LiveDispatchTransportInput {
  familyId: string;
  episodeId: string;
  messageId: string;
  taskRunId: string | null;
  kind: FamilyTaskKind;
  text: string;
  deliveryMode: "text" | "email" | "none";
  recipientMemberUserId: string | null;
  requireExactRecipient?: boolean;
  sourceOfferDeliveryId?: string | null;
  label: string | null;
  deliveryVersion: TaskDeliveryVersion;
}

export interface DispatchEmailSubmissionInput {
  kind: FamilyTaskKind;
  label: string | null;
  email: string;
  body: string;
  replyTo: string | undefined;
  deliveryVersion: TaskDeliveryVersion;
}

export interface LiveDispatchTransportDependencies {
  listRecipients(familyId: string): Promise<FamilyDeliveryRecipient[]>;
  ledger: TaskDeliveryLedger;
  sendSms: TaskDeliveryTransports["sendSms"];
  sendEmail(
    input: DispatchEmailSubmissionInput,
  ): ReturnType<TaskDeliveryTransports["sendEmail"]>;
  inboundSecret: string | undefined;
  /** Switches the family to email-only when the provider says the SMS
   * destination region is unreachable (Telnyx 40309), so an un-textable
   * number is not retried every day. Returns how many schedules moved. */
  markSmsRegionUnsupported(familyId: string): Promise<number>;
  resolveRecoveryRecipient?(input: {
    familyId: string;
    sourceDeliveryId: string;
  }): Promise<string | null>;
}

export async function submitDispatchTaskEmail(
  input: DispatchEmailSubmissionInput,
): Promise<HomaEmailSubmission> {
  switch (input.kind) {
    case "journal_prompt":
      return await submitJournalAgentEmail(
        input.email,
        input.body,
        input.replyTo,
      );
    case "morning_brief":
      return await submitResearchBriefEmail(
        input.email,
        input.body,
        input.replyTo,
        input.deliveryVersion,
      );
    case "custom":
      return await submitAgentComposedEmail(
        input.email,
        input.label ?? "From Homa",
        [input.body],
        input.replyTo,
      );
    default: {
      const exhaustive: never = input.kind;
      throw new Error(`unhandled task email kind: ${String(exhaustive)}`);
    }
  }
}

export async function deliverLiveDispatchTask(
  input: LiveDispatchTransportInput,
  dependencies: LiveDispatchTransportDependencies = {
    listRecipients: listFamilyDeliveryRecipients,
    ledger: postgresTaskDeliveryLedger,
    sendSms: submitHomaSms,
    sendEmail: submitDispatchTaskEmail,
    inboundSecret: process.env.RESEND_INBOUND_SECRET,
    markSmsRegionUnsupported: markFamilyTextSchedulesEmailOnly,
  },
  onTransportAccepted?: (channel: "sms" | "email" | "none") => void,
) {
  const recoveryRecipient = input.sourceOfferDeliveryId
    ? await (
        dependencies.resolveRecoveryRecipient ??
        findCurrentOfferRecoveryRecipient
      )({
        familyId: input.familyId,
        sourceDeliveryId: input.sourceOfferDeliveryId,
      })
    : null;
  const recipientMemberUserId = input.sourceOfferDeliveryId
    ? recoveryRecipient
    : input.recipientMemberUserId;
  const recipients = selectTaskDeliveryRecipients(
    await dependencies.listRecipients(input.familyId),
    recipientMemberUserId,
    input.sourceOfferDeliveryId ? true : input.requireExactRecipient,
  );
  if (
    (input.sourceOfferDeliveryId || input.requireExactRecipient) &&
    recipients.length === 0
  ) {
    return {
      status: "failed" as const,
      deliveredChannel: null,
      deliveredCount: 0,
      failedCount: 1,
    };
  }
  return await deliverTaskMessage(
    {
      familyId: input.familyId,
      episodeId: input.episodeId,
      messageId: input.messageId,
      taskRunId: input.taskRunId,
      kind: input.kind,
      text: input.text,
      recipients,
      deliveryMode: input.deliveryMode,
    },
    {
      ledger: dependencies.ledger,
      transports: {
        sendSms: dependencies.sendSms,
        sendEmail: async (email, body, attempt) => {
          const replyTo = dependencies.inboundSecret
            ? buildSignedReplyAddress(attempt.id, dependencies.inboundSecret)
            : undefined;
          return await dependencies.sendEmail({
            kind: input.kind,
            label: input.label,
            email,
            body,
            replyTo,
            deliveryVersion: input.deliveryVersion,
          });
        },
      },
      onTransportAccepted,
      // The switch is family-scoped, so the rejected phone (passed by the
      // delivery layer for its own audit) is not needed here; the family id
      // is the key. Best-effort: a failed switch never sinks this delivery,
      // it just means the next run tries SMS once more.
      onUnsupportedRegion: async () => {
        try {
          await dependencies.markSmsRegionUnsupported(input.familyId);
        } catch (error) {
          console.error(
            "dispatch: email-only switch after unsupported SMS region failed:",
            error instanceof Error ? error.message : "unknown",
          );
        }
      },
    },
  );
}
