import type { ToolContext } from "eve/tools";

import { assertFamilyArtifactAccess } from "./account-deletion-artifact-fence";
import { conversationRequestEnvelope, CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL } from "./conversation-request-admission";
import { authorizeConversationRequest, ConversationRequestError } from "./conversation-requests";

export function hasConversationRequestContext(attributes: unknown) {
  const attrs = attributes as Record<string, unknown> | null | undefined;
  return !!attrs && (attrs.channel === CONVERSATION_DISPATCH_CHANNEL ||
    ["conversationRequestId", "conversationRequestLease", "conversationRequestAccessEpoch"].some(key => key in attrs));
}

export interface ConversationAccessDependencies {
  authorize: typeof authorizeConversationRequest;
  familyAccess: typeof assertFamilyArtifactAccess;
}
const defaults: ConversationAccessDependencies = {
  authorize: authorizeConversationRequest, familyAccess: assertFamilyArtifactAccess,
};

/** Runtime context, not model input. Descendants must prove their actual root
 * matches the origin stamped after admission. They never gain a new lease. */
export async function requireConversationRequestAccess(
  session: ToolContext["session"], phase: "prepare" | "execute",
  dependencies: ConversationAccessDependencies = defaults,
) {
  if (!hasConversationRequestContext(session.auth.current?.attributes)) return null;
  const envelope = conversationRequestEnvelope(session.auth.current);
  if (!envelope) throw new ConversationRequestError("execution");
  let sessionId = session.id;
  let turnId = session.turn.id;
  if (session.parent) {
    if (envelope.attributes.conversationExecutionSessionId !== session.parent.rootSessionId ||
        typeof envelope.attributes.conversationExecutionTurnId !== "string") throw new ConversationRequestError("execution");
    sessionId = session.parent.rootSessionId;
    turnId = envelope.attributes.conversationExecutionTurnId;
    phase = "execute";
  }
  await dependencies.authorize({ familyId: envelope.familyId, memberUserId: envelope.memberUserId,
    accessEpoch: envelope.accessEpoch }, {
    requestId: envelope.requestId, leaseToken: envelope.leaseToken, sessionId, turnId, phase,
  });
  await dependencies.familyAccess(envelope.familyId);
  return { familyId: envelope.familyId, memberUserId: envelope.memberUserId };
}


/** Tools whose database helper receives only server-owned auth attributes use
 * the origin recorded by admission. The lease secret and DB claim are verified;
 * the channel name alone can never grant pinned access. */
export async function requireConversationRequestDatabaseAccess(
  attributes: unknown, dependencies: ConversationAccessDependencies = defaults,
) {
  if (!hasConversationRequestContext(attributes)) return null;
  const attrs = attributes as Record<string, unknown>;
  const envelope = conversationRequestEnvelope({ authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR,
    principalId: attrs.memberUserId, attributes: attrs });
  if (!envelope || typeof attrs.conversationExecutionSessionId !== "string" ||
      typeof attrs.conversationExecutionTurnId !== "string") throw new ConversationRequestError("execution");
  await dependencies.authorize({ familyId: envelope.familyId, memberUserId: envelope.memberUserId,
    accessEpoch: envelope.accessEpoch }, { requestId: envelope.requestId, leaseToken: envelope.leaseToken,
    sessionId: attrs.conversationExecutionSessionId, turnId: attrs.conversationExecutionTurnId, phase: "execute" });
  await dependencies.familyAccess(envelope.familyId);
  return { familyId: envelope.familyId, memberUserId: envelope.memberUserId };
}


/** Dynamic resolvers omit lineage. The earlier global hook validates the actual
 * root/child runtime before ANY resolver. This second read checks the current
 * request access again, using its admitted origin when that already exists. */
export async function requireConversationRequestContextAccess(
  attributes: unknown, runtime: { sessionId: string; turnId: string },
  dependencies: ConversationAccessDependencies = defaults,
) {
  if (!hasConversationRequestContext(attributes)) return null;
  const attrs = attributes as Record<string, unknown>;
  if (attrs.conversationExecutionSessionId !== undefined || attrs.conversationExecutionTurnId !== undefined) {
    return requireConversationRequestDatabaseAccess(attributes, dependencies);
  }
  const envelope = conversationRequestEnvelope({ authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR,
    principalId: attrs.memberUserId, attributes: attrs });
  if (!envelope) throw new ConversationRequestError("execution");
  await dependencies.authorize({ familyId: envelope.familyId, memberUserId: envelope.memberUserId,
    accessEpoch: envelope.accessEpoch }, { requestId: envelope.requestId, leaseToken: envelope.leaseToken,
    ...runtime, phase: "prepare" });
  await dependencies.familyAccess(envelope.familyId);
  return { familyId: envelope.familyId, memberUserId: envelope.memberUserId };
}
