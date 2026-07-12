import type { MapAnswer } from "@homa/core";

export type MapAnswerAttemptSource = "checklist" | "deep_dive";

export interface MapAnswerAttempt {
  itemId: string;
  answer: MapAnswer;
  source: MapAnswerAttemptSource;
  idempotencyKey: string;
}

export type MapAnswerIntent =
  | {
      action: "save";
      childId: string;
      itemId: string;
      answer: MapAnswer;
      source: MapAnswerAttemptSource;
    }
  | {
      action: "delete";
      childId: string;
      itemId: string;
    };

export type MapAnswerRequestStatus =
  | "success"
  | "retryable"
  | "permanent";

export type MapAnswerResponse =
  | MapAnswerRequestStatus
  | "conflict_pending"
  | "idempotency_mismatch";

export function classifyMapAnswerRequestStatus(
  status: number,
): MapAnswerRequestStatus {
  if (status >= 200 && status < 300) return "success";
  if (status === 408 || status === 429 || status >= 500) {
    return "retryable";
  }
  return "permanent";
}

export function classifyMapAnswerResponse(
  status: number,
  reason?: string,
): MapAnswerResponse {
  if (status === 409 && reason === "conflict-pending") {
    return "conflict_pending";
  }
  if (status === 409 && reason === "idempotency-mismatch") {
    return "idempotency_mismatch";
  }
  return classifyMapAnswerRequestStatus(status);
}

function mapAnswerIntentScope(intent: MapAnswerIntent): string {
  return [
    intent.childId,
    intent.itemId,
  ].join("\u0000");
}

function mapAnswerIntentSignature(intent: MapAnswerIntent): string {
  return intent.action === "save"
    ? [
        mapAnswerIntentScope(intent),
        intent.answer,
        intent.source,
      ].join("\u0000")
    : mapAnswerIntentScope(intent);
}

/**
 * Ref-friendly key registry. Failed requests retain their key, changed
 * intents replace it, and only success for the current intent clears it.
 */
export class MapAnswerAttemptKeyPolicy {
  private readonly entries = new Map<
    string,
    { signature: string; key: string }
  >();

  constructor(
    private readonly createUuid: () => string =
      () => crypto.randomUUID(),
  ) {}

  keyFor(intent: MapAnswerIntent): string {
    const scope = mapAnswerIntentScope(intent);
    const signature = mapAnswerIntentSignature(intent);
    const current = this.entries.get(scope);
    if (current?.signature === signature) return current.key;
    const key = this.createUuid();
    this.entries.set(scope, { signature, key });
    return key;
  }

  markSucceeded(intent: MapAnswerIntent): void {
    this.clearCurrentIntent(intent);
  }

  markPermanentFailure(intent: MapAnswerIntent): void {
    this.clearCurrentIntent(intent);
  }

  private clearCurrentIntent(intent: MapAnswerIntent): void {
    const scope = mapAnswerIntentScope(intent);
    const current = this.entries.get(scope);
    if (
      current?.signature === mapAnswerIntentSignature(intent)
    ) {
      this.entries.delete(scope);
    }
  }
}

/**
 * Creates one durable client attempt. The same object is retained if its
 * fetch needs retrying, so the server sees one idempotency key.
 */
export function createMapAnswerAttempt(
  input: Omit<MapAnswerAttempt, "idempotencyKey">,
  createUuid: () => string = () => crypto.randomUUID(),
): MapAnswerAttempt {
  return {
    ...input,
    idempotencyKey: createUuid(),
  };
}

export function mapAnswerAttemptRequestBody(
  childId: string,
  attempt: MapAnswerAttempt,
): MapAnswerAttempt & { childId: string } {
  return {
    childId,
    ...attempt,
  };
}
