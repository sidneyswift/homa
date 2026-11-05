import { claimNativeContinuation } from "./conversation-native-batches";
import { canonicalInboundAuthAttributes } from "./conversation-continuity/canonical-inbound";
import { claimConversationExecution, ConversationRequestError } from "./conversation-requests";

export const CONVERSATION_DISPATCH_AUTHENTICATOR = "conversation-request-dispatcher";
export const CONVERSATION_DISPATCH_CHANNEL = "conversation-request";

interface AdmissionAuth {
  authenticator?: unknown;
  principalId?: unknown;
  attributes?: Record<string, unknown>;
}

/** Root request execution must not opt into the voice/producer persistence
 * skips. Parented workers inherit context but do not claim a second user input;
 * their tools still require the originating adult's execution access gate. */
export function conversationRequestEnvelope(auth: AdmissionAuth | null | undefined) {
  const attributes = auth?.attributes;
  const isDispatcher = auth?.authenticator === CONVERSATION_DISPATCH_AUTHENTICATOR;
  const hasClaim = attributes && ["conversationRequestId", "conversationRequestLease", "conversationRequestAccessEpoch"]
    .some(key => key in attributes);
  if (!isDispatcher && !hasClaim) return null;
  if (!isDispatcher || !attributes || attributes.channel !== CONVERSATION_DISPATCH_CHANNEL ||
      attributes.voiceBridge === "true" || typeof attributes.familyId !== "string" ||
      typeof attributes.memberUserId !== "string" || auth?.principalId !== attributes.memberUserId ||
      typeof attributes.conversationRequestId !== "string" ||
      typeof attributes.conversationRequestLease !== "string" ||
      typeof attributes.conversationRequestAccessEpoch !== "string") {
    throw new ConversationRequestError("execution");
  }
  return { attributes, familyId: attributes.familyId, memberUserId: attributes.memberUserId,
    accessEpoch: attributes.conversationRequestAccessEpoch,
    requestId: attributes.conversationRequestId, leaseToken: attributes.conversationRequestLease };
}

/** Called by the global message.received hook before ordinary persistence and
 * before model/tools. Channel callbacks cannot enforce this: Eve catches their
 * exceptions. These attributes may only be stamped by the server dispatcher. */
export async function admitConversationRequest(input: {
  auth: AdmissionAuth | null | undefined;
  sessionId: string; turnId: string; sequence: number; text: string;
}, claim: typeof claimConversationExecution = claimConversationExecution) {
  const envelope = conversationRequestEnvelope(input.auth);
  if (!envelope) return null;
  const accepted = await claim({ familyId: envelope.familyId, memberUserId: envelope.memberUserId,
    accessEpoch: envelope.accessEpoch }, {
    requestId: envelope.requestId, leaseToken: envelope.leaseToken,
    sessionId: input.sessionId, turnId: input.turnId, sequence: input.sequence,
  }, input.text);
  // The database supplies the accepted episode and canonical UUID. A stale or
  // forged value in an auth envelope must not redirect ordinary persistence.
  Object.assign(envelope.attributes, { episodeId: accepted.episodeId,
    conversationExecutionSessionId: input.sessionId, conversationExecutionTurnId: input.turnId },
    canonicalInboundAuthAttributes({ messageId: accepted.messageId, text: accepted.text }));
  return accepted;
}

/** Root response-only native continuations are admitted before family context.
 * Ordinary inputs still require message.received exact-content admission. */
export async function admitNativeConversationContinuation(input: {
  auth: AdmissionAuth | null | undefined; sessionId: string; turnId: string; sequence: number;
}) {
  const envelope=conversationRequestEnvelope(input.auth);
  if (!envelope) return null;
  const accepted=await claimNativeContinuation(envelope,{requestId:envelope.requestId,leaseToken:envelope.leaseToken,
    sessionId:input.sessionId,turnId:input.turnId,sequence:input.sequence});
  if (accepted) Object.assign(envelope.attributes,{episodeId:accepted.episodeId,
    conversationExecutionSessionId:input.sessionId,conversationExecutionTurnId:input.turnId},
    canonicalInboundAuthAttributes({messageId:accepted.messageId,text:accepted.text}));
  return accepted;
}
