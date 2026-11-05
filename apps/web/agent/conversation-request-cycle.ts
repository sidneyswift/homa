import type { UserContent } from "ai";
import { createHash } from "node:crypto";

import { prepareNativeContinuation } from "../lib/conversation-native-batches";
import type { NativeInputResponse } from "../lib/conversation-native-input";
import { loadConversationDispatchInput } from "../lib/conversation-attachments";
import { familyAccountGate } from "../lib/billing/wall";
import { CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL } from "../lib/conversation-request-admission";
import { leaseConversationRequest, listConversationDispatchOwners } from "../lib/conversation-requests";

export interface ConversationDispatchInput {
  message: UserContent;
  nativeContinuation?: { idempotencyKey:string; inputResponses: NativeInputResponse[]; continuationToken: string };
  auth: {
    authenticator: string; principalId: string; principalType: "user";
    attributes: Record<string, string>;
  };
}
export interface ConversationCycleDependencies {
  enabled(): boolean;
  owners: typeof listConversationDispatchOwners;
  lease: typeof leaseConversationRequest;
  accountGate: typeof familyAccountGate;
  input?: typeof loadConversationDispatchInput;
  native?: typeof prepareNativeContinuation;
}
const defaults: ConversationCycleDependencies = {
  enabled: () => process.env.HOMA_CONVERSATION_REQUESTS === "1",
  owners: listConversationDispatchOwners, lease: leaseConversationRequest, accountGate: familyAccountGate,
  input: loadConversationDispatchInput,native:prepareNativeContinuation,
};

/** A send acknowledgement is not completion. Ambiguous launch outcomes keep
 * the fenced lease; expiration can retry only work that never claimed execution.
 * Already claimed work is excluded by the durable owner query. */
export async function runConversationRequestCycle(
  spawn: (input: ConversationDispatchInput) => Promise<unknown>,
  dependencies: ConversationCycleDependencies = defaults,
) {
  const counts = { started: 0, blocked: 0, uncertain: 0 };
  if (!dependencies.enabled()) return counts;
  for (const owner of await dependencies.owners(10)) {
    try {
      const lease = await dependencies.lease(owner);
      if (lease.kind !== "leased") { counts.blocked++; continue; }
      // Leasing advances pickup age even for a blocked account. After expiry,
      // other owners get their turn before this one is reconsidered.
      if ((await dependencies.accountGate(owner.familyId)).checkout) { counts.blocked++; continue; }
      const native = dependencies.native ? await dependencies.native(owner,lease.requestId,lease.leaseToken) : null;
      await spawn({ ...(native ? { nativeContinuation: { idempotencyKey:lease.requestId,inputResponses:native.inputResponses,
        continuationToken:conversationDispatchToken(native.originRequestId,native.originLease) } } : {}), message: !native && dependencies.input ? await dependencies.input(owner,lease.requestId,lease.leaseToken,lease.text) : lease.text, auth: {
        authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR, principalId: owner.memberUserId, principalType: "user",
        attributes: { channel: CONVERSATION_DISPATCH_CHANNEL, familyId: owner.familyId, memberUserId: owner.memberUserId,
          conversationRequestAccessEpoch: owner.accessEpoch, conversationRequestId: lease.requestId,
          conversationRequestLease: lease.leaseToken, episodeId: lease.episodeId },
      } });
      counts.started++;
    } catch {
      // Do not release or mint a new intent after an uncertain delivery. The
      // transaction and admission claim, not the catch path, decide retry safety.
      counts.uncertain++;
    }
  }
  return counts;
}


/** Routing is observable metadata, not an execution credential. */
export function conversationDispatchToken(requestId: string, leaseToken: string): string {
  return `conversation-request:${requestId}:${createHash("sha256").update(leaseToken).digest("hex")}`;
}
