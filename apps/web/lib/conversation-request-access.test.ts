import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

import { resolveFamilyContextInstructionMarkdown, type FamilyContextInstructionDependencies } from "../agent/instructions/family-context";
import { resolveAgentAccess } from "./agent-db";
import { defineBoundedTool } from "./agent-tool-deadline";
import { CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL } from "./conversation-request-admission";
import { requireConversationRequestAccess, requireConversationRequestContextAccess,
  requireConversationRequestDatabaseAccess, type ConversationAccessDependencies } from "./conversation-request-access";
import { prepareConversationRequestContext } from "./conversation-request-context";
import { ConversationRequestError } from "./conversation-requests";

const familyId = randomUUID(), memberUserId = randomUUID(), accessEpoch = randomUUID();
function session(): ToolContext["session"] {
  const auth = { authenticator: CONVERSATION_DISPATCH_AUTHENTICATOR, principalType: "user" as const,
    principalId: memberUserId, attributes: { channel: CONVERSATION_DISPATCH_CHANNEL, familyId, memberUserId,
      conversationRequestId: randomUUID(), conversationRequestLease: randomUUID(), conversationRequestAccessEpoch: accessEpoch,
      conversationExecutionSessionId: "root", conversationExecutionTurnId: "turn-0" } };
  return { id: "root", turn: { id: "turn-0", sequence: 0 }, auth: { current: auth, initiator: auth } };
}
function deps() {
  const calls: unknown[] = [];
  const dependencies: ConversationAccessDependencies = {
    authorize: async (p, execution) => { calls.push({ p, execution }); },
    familyAccess: async id => { calls.push(id); },
  };
  return { dependencies, calls };
}

test("background access rechecks the exact adult, epoch and claimed runtime", async () => {
  const current = session(), { dependencies, calls } = deps();
  assert.deepEqual(await requireConversationRequestAccess(current, "execute", dependencies), { familyId, memberUserId });
  assert.deepEqual(calls[0], { p: { familyId, memberUserId, accessEpoch }, execution: {
    requestId: current.auth.current!.attributes.conversationRequestId,
    leaseToken: current.auth.current!.attributes.conversationRequestLease,
    sessionId: "root", turnId: "turn-0", phase: "execute",
  } });
  assert.equal(calls[1], familyId);
});

test("descendants use their actual root lineage and cannot prepare with an unclaimed lease", async () => {
  const current = session(), { dependencies, calls } = deps();
  const child = { ...current, id: "child", turn: { id: "child-turn", sequence: 0 },
    parent: { sessionId: "root", rootSessionId: "root", callId: "call-one", turn: current.turn } };
  await requireConversationRequestAccess(child, "prepare", dependencies);
  assert.equal((calls[0] as { execution: { phase: string } }).execution.phase, "execute");
  await assert.rejects(requireConversationRequestAccess({ ...child,
    parent: { ...child.parent, rootSessionId: "unrelated-root" } }, "execute", dependencies), ConversationRequestError);
  assert.equal(calls.length, 2);
});

test("membership denial stops access before family data loading", async () => {
  const { dependencies, calls } = deps();
  dependencies.authorize = async () => { throw new ConversationRequestError("execution"); };
  await assert.rejects(requireConversationRequestAccess(session(), "execute", dependencies), ConversationRequestError);
  assert.deepEqual(calls, []);
});

test("database access cannot bypass a request check by supplying a browser token", async () => {
  const current = session();
  const attributes = { ...current.auth.current!.attributes, supabaseAccessToken: "opaque-token" };
  let checked = false;
  await assert.rejects(resolveAgentAccess(attributes, {
    nowSeconds: () => 0, verifyFamilyMembership: async () => true,
    verifyConversationRequest: async () => { checked = true; throw new ConversationRequestError("execution"); },
  }), ConversationRequestError);
  assert.equal(checked, true);
});

test("a verified request gets pinned data access without expanding the generic channel allowlist", async () => {
  assert.deepEqual(await resolveAgentAccess(session().auth.current!.attributes, {
    nowSeconds: () => 0, verifyFamilyMembership: async () => { throw new Error("wrong path"); },
    verifyConversationRequest: async () => ({ familyId, memberUserId }),
  }), { mode: "pinned", familyId });
});

test("dynamic family context rejects request access before any special-case loader", async () => {
  let otherCalls = 0;
  const dependencies = new Proxy({ authorizeConversationRequest: async () => { throw new ConversationRequestError("execution"); } }, {
    get: (target, name) => name === "authorizeConversationRequest" ? target.authorizeConversationRequest : async () => { otherCalls++; },
  }) as unknown as FamilyContextInstructionDependencies;
  await assert.rejects(resolveFamilyContextInstructionMarkdown({
    attributes: session().auth.current!.attributes, sessionId: "root", turnId: "turn-0",
  }, dependencies), ConversationRequestError);
  assert.equal(otherCalls, 0);
});

test("pre-claim context uses a lease; admitted context requires execution access", async () => {
  const current = session(), { dependencies, calls } = deps();
  const attrs = { ...current.auth.current!.attributes };
  delete attrs.conversationExecutionSessionId; delete attrs.conversationExecutionTurnId;
  await requireConversationRequestContextAccess(attrs, { sessionId: "root", turnId: "turn-0" }, dependencies);
  assert.equal((calls[0] as { execution: { phase: string } }).execution.phase, "prepare");
  await assert.rejects(requireConversationRequestDatabaseAccess(attrs, dependencies), ConversationRequestError);
  await requireConversationRequestContextAccess(current.auth.current!.attributes, { sessionId: "root", turnId: "turn-0" }, dependencies);
  assert.equal((calls[2] as { execution: { phase: string } }).execution.phase, "execute");
});

test("authored tools deny an incompatible request envelope before their body runs", async () => {
  let called = false;
  const tool = defineBoundedTool({ description: "Synthetic effect", inputSchema: z.object({}),
    deadlineMs: 100, repeatable: false, execute: () => { called = true; return "effect"; } });
  const current = session();
  Object.assign(current.auth.current!.attributes, { channel: "web" });
  await assert.rejects(async () => tool.execute({}, { session: current } as ToolContext), ConversationRequestError);
  assert.equal(called, false);
});


test("preflight context failure cannot leave a falsely loaded conversation", async () => {
  const current = session();
  await assert.rejects(prepareConversationRequestContext(current, {
    authorize: async () => ({ familyId, memberUserId }),
    load: async () => { throw new Error("history unavailable"); },
  }), /history unavailable/);
  assert.equal(current.auth.current!.attributes.conversationRequestContextLoaded, undefined);
});

test("preflight preserves verified empty history without episode fallback", async () => {
  const current = session();
  await prepareConversationRequestContext(current, {
    authorize: async () => ({ familyId, memberUserId }),
    load: async principal => { assert.deepEqual(principal, { familyId, memberUserId, accessEpoch }); return ""; },
  });
  assert.equal(current.auth.current!.attributes.continuityContext, "");
  assert.equal(current.auth.current!.attributes.conversationRequestContextLoaded, "true");
});
