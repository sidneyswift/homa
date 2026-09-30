import type { NativeInputResponse } from "../../lib/conversation-native-input";
import type { ConversationQuestionAnswer } from "../../lib/conversation-question-answer";

/** Transport-independent delivery contract. Drafts are not entries here: only
 * an explicit Send creates an immutable intent. Never mint a new ID on retry. */
export interface PendingConversationIntent {
  account: string;
  accessEpoch: string;
  intentId: string;
  text: string;
  questionAnswer?: ConversationQuestionAnswer;
  nativeInput?: { batchId: string; responses: NativeInputResponse[] };
  replyToQuestionId?: string;
  attachmentIds?: string[];
  stagedAttachmentIds?: string[];
  submittedAt: number;
}

export interface ConversationAcceptanceReceipt {
  intentId: string;
  requestId: string;
  messageId: string;
}

export interface ConversationOutboxStore {
  prepare?(entry: PendingConversationIntent, token: string, signal: AbortSignal): Promise<PendingConversationIntent>;
  list(account: string): Promise<PendingConversationIntent[]>;
  acknowledge(entry: PendingConversationIntent, receipt: ConversationAcceptanceReceipt): Promise<void>;
  reject(entry: PendingConversationIntent, reason: "conflict" | "rejected" | "deleted"): Promise<void>;
  revoke(account: string, accessEpoch: string): Promise<void>;
}

export interface ConversationOutboxTransport {
  // Resolve fresh authenticated identity before EVERY request. The sender must
  // use this exact bearer, not ambient cookies which may belong to a new login.
  session(): Promise<{ account: string; accessEpoch: string; accessToken: string } | null>;
  accept(entry: PendingConversationIntent, accessToken: string, signal: AbortSignal): Promise<
    | { kind: "accepted"; receipt: ConversationAcceptanceReceipt }
    | { kind: "retry" | "sign_in" | "conflict" | "deleted" | "rejected" }
  >;
}

export type OutboxDeliveryResult =
  | { kind: "snapshot_drained"; delivered: number; rejected: number }
  | { kind: "paused"; delivered: number; reason: "aborted" | "account_changed" | "storage" | "network" |
      "sign_in" | "conflict" | "deleted" | "rejected" | "invalid_receipt" | "invalid_session" | "access_changed" };

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

export function validAcceptanceReceipt(entry: PendingConversationIntent, receipt: ConversationAcceptanceReceipt) {
  return !!receipt && typeof receipt === "object" && receipt.intentId === entry.intentId &&
    typeof receipt.requestId === "string" && typeof receipt.messageId === "string" &&
    uuid.test(receipt.requestId) && uuid.test(receipt.messageId);
}

/** One bounded pass, called on reconnect/open. An uncertain response leaves the
 * same intent on disk. Concurrent tabs can deliver the same ID safely once the
 * server's acceptance API is connected. This never falls back to raw Eve send. */
export async function deliverConversationOutbox(input: {
  account: string;
  currentAccount(): string | null;
  store: ConversationOutboxStore;
  transport: ConversationOutboxTransport;
  signal: AbortSignal;
}): Promise<OutboxDeliveryResult> {
  let delivered = 0;
  let rejected = 0;
  const paused = (reason: Extract<OutboxDeliveryResult, { kind: "paused" }>["reason"]): OutboxDeliveryResult =>
    ({ kind: "paused", delivered, reason });
  if (input.signal.aborted) return paused("aborted");
  if (input.currentAccount() !== input.account) return paused("account_changed");
  let entries: PendingConversationIntent[];
  try { entries = await input.store.list(input.account); }
  catch { return paused("storage"); }
  for (let entry of entries) {
    if (input.signal.aborted) return paused("aborted");
    if (entry.account !== input.account || input.currentAccount() !== input.account) return paused("account_changed");
    let session: Awaited<ReturnType<ConversationOutboxTransport["session"]>>;
    try { session = await input.transport.session(); }
    catch { return paused("network"); }
    if (!session?.accessToken) return paused("sign_in");
    if (session.account !== input.account || input.currentAccount() !== input.account) return paused("account_changed");
    if (!uuid.test(session.accessEpoch) || !uuid.test(entry.accessEpoch)) return paused("invalid_session");
    if (session.accessEpoch !== entry.accessEpoch) {
      try { await input.store.revoke(entry.account, entry.accessEpoch); }
      catch { return paused("storage"); }
      return paused("access_changed");
    }
    if (input.signal.aborted) return paused("aborted");
    if (entry.stagedAttachmentIds?.length && !entry.attachmentIds?.length) {
      if (!input.store.prepare) return paused("storage");
      try { entry = await input.store.prepare(entry,session.accessToken,input.signal); }
      catch { return paused(input.signal.aborted ? "aborted" : "network"); }
      if(input.currentAccount() !== input.account) return paused("account_changed");
      if(input.signal.aborted) return paused("aborted");
    }
    let result: Awaited<ReturnType<ConversationOutboxTransport["accept"]>>;
    try { result = await input.transport.accept(entry, session.accessToken, input.signal); }
    catch { return paused(input.signal.aborted ? "aborted" : "network"); }
    if (!result || typeof result !== "object") return paused("invalid_receipt");
    if (result.kind === "conflict" || result.kind === "rejected" || result.kind === "deleted") {
      try { await input.store.reject(entry, result.kind); }
      catch { return paused("storage"); }
      rejected++;
      continue;
    }
    if (result.kind !== "accepted") return paused(result.kind === "retry" ? "network" : result.kind);
    if (!validAcceptanceReceipt(entry, result.receipt)) return paused("invalid_receipt");
    // Acknowledgement is scoped to the original account and exact immutable
    // payload. It is safe even if login changed while the response was in flight.
    try { await input.store.acknowledge(entry, result.receipt); }
    catch { return paused("storage"); }
    delivered++;
  }
  // Another tab may have added work during this bounded snapshot. The caller
  // must schedule another pass on enqueue; this is not a global empty claim.
  return { kind: "snapshot_drained", delivered, rejected };
}


/** An acknowledgement must match the submitted choices as well as preview text. */
export function sameConversationIntentContent(left: PendingConversationIntent, right: PendingConversationIntent): boolean {
  return JSON.stringify(left.nativeInput ?? null) === JSON.stringify(right.nativeInput ?? null) && left.text === right.text && left.replyToQuestionId === right.replyToQuestionId && JSON.stringify(left.questionAnswer ?? null) === JSON.stringify(right.questionAnswer ?? null) &&
    JSON.stringify(left.attachmentIds ?? []) === JSON.stringify(right.attachmentIds ?? []) &&
    JSON.stringify(left.stagedAttachmentIds ?? []) === JSON.stringify(right.stagedAttachmentIds ?? []);
}
