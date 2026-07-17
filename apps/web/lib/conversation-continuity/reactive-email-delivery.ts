import type { HomaEmailSubmission } from "../map/email";
import { operationalDiagnostic } from "../operational-diagnostics";
import type { DeliveryAttempt } from "./delivery-ledger";

type ReactiveEmailOutcome = "sent" | "uncertain" | "failed";

type DeliveryAttemptOutcome =
  | {
      delivered: true;
      providerSubmissionId?: string | null;
      providerMessageId?: string | null;
    }
  | { delivered: false; error?: string | null; uncertain?: boolean };

export interface ReactiveEmailDeliveryDependencies {
  beginAttempt(): Promise<DeliveryAttempt>;
  sendEmail(attempt: DeliveryAttempt): Promise<HomaEmailSubmission>;
  finishAttempt(
    attempt: DeliveryAttempt,
    outcome: DeliveryAttemptOutcome,
  ): Promise<void>;
  enrichProviderMessageId(
    attempt: DeliveryAttempt,
    providerSubmissionId: string,
    providerMessageId: string,
  ): Promise<void>;
  retrieveProviderMessageId(
    providerSubmissionId: string,
  ): Promise<string | null>;
  finalizeOutcome(
    attempt: DeliveryAttempt,
    outcome: ReactiveEmailOutcome,
  ): Promise<void>;
  completeInboundReceipt(): Promise<void>;
}

function retryableReactiveEmailPostprocessError(): Error {
  return new Error(
    operationalDiagnostic(
      "email_channel",
      "reactive_email_postprocess",
      "retry_pending",
    ),
  );
}

async function ensureProviderMessageId(
  attempt: DeliveryAttempt,
  dependencies: ReactiveEmailDeliveryDependencies,
): Promise<void> {
  if (attempt.providerMessageId) return;
  if (!attempt.providerSubmissionId) {
    throw retryableReactiveEmailPostprocessError();
  }
  const providerMessageId = await dependencies.retrieveProviderMessageId(
    attempt.providerSubmissionId,
  );
  if (!providerMessageId) {
    throw retryableReactiveEmailPostprocessError();
  }
  await dependencies.enrichProviderMessageId(
    attempt,
    attempt.providerSubmissionId,
    providerMessageId,
  );
}

async function finalizeRetryableOutcome(
  attempt: DeliveryAttempt,
  outcome: ReactiveEmailOutcome,
  dependencies: ReactiveEmailDeliveryDependencies,
): Promise<ReactiveEmailOutcome> {
  try {
    if (outcome === "sent") {
      await ensureProviderMessageId(attempt, dependencies);
    }
    await dependencies.finalizeOutcome(attempt, outcome);
    await dependencies.completeInboundReceipt();
    return outcome;
  } catch {
    throw retryableReactiveEmailPostprocessError();
  }
}

export async function deliverReactiveEmailWithRetry(
  dependencies: ReactiveEmailDeliveryDependencies,
): Promise<ReactiveEmailOutcome> {
  const attempt = await dependencies.beginAttempt();
  if (!attempt.shouldSend) {
    switch (attempt.existingStatus) {
      case "sent":
        return await finalizeRetryableOutcome(
          attempt,
          "sent",
          dependencies,
        );
      case "uncertain":
        return await finalizeRetryableOutcome(
          attempt,
          "uncertain",
          dependencies,
        );
      case "failed":
        await dependencies.finalizeOutcome(attempt, "failed");
        await dependencies.completeInboundReceipt();
        return "failed";
      case "pending":
        throw retryableReactiveEmailPostprocessError();
      default: {
        const exhaustive: never = attempt.existingStatus;
        throw new Error(
          `unhandled reactive email attempt state: ${String(exhaustive)}`,
        );
      }
    }
  }

  let submission: HomaEmailSubmission;
  try {
    submission = await dependencies.sendEmail(attempt);
  } catch {
    await dependencies.finishAttempt(attempt, {
      delivered: false,
      error: "reactive email transport failed",
    });
    await dependencies.finalizeOutcome(attempt, "failed");
    await dependencies.completeInboundReceipt();
    return "failed";
  }

  if (submission.status === "submitted") {
    await dependencies.finishAttempt(attempt, {
      delivered: true,
      providerSubmissionId: submission.providerSubmissionId,
    });
    try {
      const providerMessageId =
        await submission.retrieveProviderMessageId();
      if (!providerMessageId) {
        throw retryableReactiveEmailPostprocessError();
      }
      await dependencies.enrichProviderMessageId(
        attempt,
        submission.providerSubmissionId,
        providerMessageId,
      );
      await dependencies.finalizeOutcome(attempt, "sent");
      await dependencies.completeInboundReceipt();
      return "sent";
    } catch {
      throw retryableReactiveEmailPostprocessError();
    }
  }

  const uncertain = submission.status === "unknown";
  await dependencies.finishAttempt(attempt, {
    delivered: false,
    error: uncertain
      ? "Resend submission uncertain"
      : "Resend send rejected",
    uncertain,
  });
  return await finalizeRetryableOutcome(
    attempt,
    uncertain ? "uncertain" : "failed",
    dependencies,
  );
}
