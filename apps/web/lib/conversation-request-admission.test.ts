import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { admitConversationRequest, CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL } from "./conversation-request-admission";
import { ConversationRequestError } from "./conversation-requests";

const familyId = randomUUID(), memberUserId = randomUUID(), accessEpoch = randomUUID();
const requestId = randomUUID(), leaseToken = randomUUID(), messageId = randomUUID(), episodeId = randomUUID();
const execution = { sessionId: "session-one", turnId: "turn_0", sequence: 0, text: "Hi" };
function auth() {
  return { authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR, principalId: memberUserId,
    attributes: { channel: CONVERSATION_DISPATCH_CHANNEL, familyId, memberUserId, conversationRequestId: requestId,
      conversationRequestLease: leaseToken, conversationRequestAccessEpoch: accessEpoch,
      episodeId: "untrusted-envelope-episode", canonicalInboundMessageId: "untrusted-envelope-message" } };
}

test("ordinary web traffic never touches request storage", async () => {
  assert.equal(await admitConversationRequest({ ...execution, auth: { authenticator: "supabase",
    principalId: memberUserId, attributes: { familyId, memberUserId } } }, async () => { throw new Error(); }), null);
});

test("a caller cannot opt into a trusted execution claim through attributes", async () => {
  const value = auth(); value.authenticator = "supabase";
  await assert.rejects(admitConversationRequest({ ...execution, auth: value }, async () => { throw new Error("must not call"); }),
    (error: unknown) => error instanceof ConversationRequestError && error.code === "execution");
});

test("missing dispatcher claims and mismatched adult identity fail closed", async () => {
  for (const value of [{ authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL },
    { ...auth(), principalId: randomUUID() }, { ...auth(), attributes: {} }]) {
    await assert.rejects(admitConversationRequest({ ...execution, auth: value }), ConversationRequestError);
  }
});

test("claim happens before persistence and replaces episode and canonical IDs from storage", async () => {
  const value = auth();
  const accepted = await admitConversationRequest({ ...execution, auth: value }, async (principal, identity, text) => {
    assert.deepEqual(principal, { familyId, memberUserId, accessEpoch });
    assert.deepEqual(identity, { requestId, leaseToken, sessionId: execution.sessionId, turnId: execution.turnId, sequence: 0 });
    assert.equal(text, execution.text);
    assert.equal(value.attributes.episodeId, "untrusted-envelope-episode");
    return { messageId, episodeId, text, replayed: false };
  });
  assert.equal(accepted?.messageId, messageId);
  assert.equal(value.attributes.episodeId, episodeId);
  assert.equal(value.attributes.canonicalInboundMessageId, messageId);
});

test("a lost lease or different execution aborts without changing auth context", async () => {
  const value = auth(), before = structuredClone(value);
  await assert.rejects(admitConversationRequest({ ...execution, auth: value }, async () => {
    throw new ConversationRequestError("execution");
  }), ConversationRequestError);
  assert.deepEqual(value, before);
});


test("root dispatch cannot use a producer or voice-bridge persistence skip", async () => {
  for (const extra of [{ channel: "subject_lesson" }, { channel: "progress_next_move" }, { voiceBridge: "true" }]) {
    const value = auth();
    Object.assign(value.attributes, extra);
    await assert.rejects(admitConversationRequest({ ...execution, auth: value }, async () => {
      throw new Error("must not reach storage");
    }), (error: unknown) => error instanceof ConversationRequestError && error.code === "execution");
  }
});
