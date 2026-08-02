export type MutationFailureReason =
  | "provider_error"
  | "missing_receipt"
  | "contradictory_receipt";

/**
 * Internal error for a durable write that Homa cannot prove succeeded.
 * UI surfaces translate this into reassuring copy and never expose provider
 * messages to a family.
 */
export class MutationReceiptError extends Error {
  readonly operation: string;
  readonly reason: MutationFailureReason;

  constructor(
    operation: string,
    reason: MutationFailureReason,
    providerMessage?: string,
  ) {
    super(
      providerMessage
        ? `${operation} failed (${reason}): ${providerMessage}`
        : `${operation} failed (${reason})`,
    );
    this.name = "MutationReceiptError";
    this.operation = operation;
    this.reason = reason;
  }
}

interface ProviderError {
  message: string;
}

export function requireMutationAcknowledgement(
  operation: string,
  error: ProviderError | null,
): void {
  if (error) {
    throw new MutationReceiptError(operation, "provider_error", error.message);
  }
}

export function requireMutationReceipt<T>(
  operation: string,
  result: { data: T | null; error: ProviderError | null },
): T {
  requireMutationAcknowledgement(operation, result.error);
  if (result.data === null) {
    throw new MutationReceiptError(operation, "missing_receipt");
  }
  return result.data;
}

export function requireReceiptValue(
  operation: string,
  matches: boolean,
): void {
  if (!matches) {
    throw new MutationReceiptError(operation, "contradictory_receipt");
  }
}
