import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { conversationDispatchToken, runConversationRequestCycle, type ConversationCycleDependencies } from "./conversation-request-cycle";

function fixture() {
  const owner = { familyId: randomUUID(), memberUserId: randomUUID(), accessEpoch: randomUUID() };
  const lease = { kind: "leased" as const, requestId: randomUUID(), leaseToken: randomUUID(),
    text: "  Exact submitted words\n", episodeId: randomUUID(), messageId: randomUUID() };
  const calls: string[] = [];
  const dependencies: ConversationCycleDependencies = { enabled: () => true,
    owners: async () => { calls.push("owners"); return [owner]; },
    lease: async () => { calls.push("lease"); return lease; },
    accountGate: async () => { calls.push("gate"); return { checkout: null, lapsed: false }; } };
  return { owner, lease, calls, dependencies };
}

test("disabled pickup does not touch accounts, requests, or runtime", async () => {
  const f = fixture(); f.dependencies.enabled = () => false;
  assert.deepEqual(await runConversationRequestCycle(async () => assert.fail(), f.dependencies), { started: 0, blocked: 0, uncertain: 0 });
  assert.deepEqual(f.calls, []);
});

test("pickup carries exact accepted input and server-owned identity without a browser token", async () => {
  const f = fixture();
  const result = await runConversationRequestCycle(async input => {
    assert.equal(input.message, f.lease.text);
    assert.equal(input.auth.principalId, f.owner.memberUserId);
    assert.equal(input.auth.attributes.familyId, f.owner.familyId);
    assert.equal(input.auth.attributes.conversationRequestId, f.lease.requestId);
    assert.equal(input.auth.attributes.conversationRequestLease, f.lease.leaseToken);
    assert.equal(input.auth.attributes.conversationRequestAccessEpoch, f.owner.accessEpoch);
    assert.equal(input.auth.attributes.episodeId, f.lease.episodeId);
    assert.equal(input.auth.attributes.accessToken, undefined);
  }, f.dependencies);
  assert.equal(result.started, 1);
  assert.deepEqual(f.calls, ["owners", "lease", "gate"]);
});

test("uncertain delivery never retries that request inside the pickup pass", async () => {
  const f = fixture(); let launches = 0;
  const result = await runConversationRequestCycle(async () => { launches++; throw new Error("lost acknowledgement"); }, f.dependencies);
  assert.equal(launches, 1); assert.equal(result.uncertain, 1);
});

test("already executing work cannot reach billing or spawn", async () => {
  const f = fixture(); f.dependencies.lease = async () => ({ kind: "blocked", requestId: f.lease.requestId, reason: "executing" });
  const result = await runConversationRequestCycle(async () => assert.fail(), f.dependencies);
  assert.equal(result.blocked, 1); assert.deepEqual(f.calls, ["owners"]);
});

test("a billing wait advances its lease and still permits the next owner", async () => {
  const f = fixture(), second = { ...f.owner, familyId: randomUUID(), memberUserId: randomUUID() };
  f.dependencies.owners = async () => [f.owner, second];
  f.dependencies.accountGate = async familyId => ({ checkout: familyId === f.owner.familyId
    ? {} as NonNullable<Awaited<ReturnType<ConversationCycleDependencies["accountGate"]>>["checkout"]> : null, lapsed: false });
  const launched: string[] = [];
  const result = await runConversationRequestCycle(async input => { launched.push(input.auth.principalId); }, f.dependencies);
  assert.deepEqual(launched, [second.memberUserId]);
  assert.deepEqual(result, { started: 1, blocked: 1, uncertain: 0 });
  assert.equal(f.calls.filter(call => call === "lease").length, 2);
});


test("observable routing identity does not expose the execution lease", () => {
  const requestId = randomUUID(), lease = randomUUID();
  const token = conversationDispatchToken(requestId, lease);
  assert(!token.includes(lease));
  assert.equal(token, conversationDispatchToken(requestId, lease));
  assert.notEqual(token, conversationDispatchToken(requestId, randomUUID()));
});

test("native retries carry the accepted answer key and original session route",async()=>{
  const f=fixture(),rootId=randomUUID(),rootLease=randomUUID();
  const inputResponses=[{requestId:"question-1",optionId:"approve"}];
  f.dependencies.native=async()=>({inputResponses,sessionId:"runtime",originRequestId:rootId,originLease:rootLease});
  f.dependencies.input=async()=>assert.fail("Native answers must not be rendered as new text");
  const sent=[];
  await runConversationRequestCycle(async input=>{sent.push(input);assert.deepEqual(input.nativeContinuation,{
    inputResponses,idempotencyKey:f.lease.requestId,continuationToken:conversationDispatchToken(rootId,rootLease)});},f.dependencies);
  assert.equal(sent.length,1);
});
