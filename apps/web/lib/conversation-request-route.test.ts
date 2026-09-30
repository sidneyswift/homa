import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import {
  conversationRequestResponse, MAX_CONVERSATION_REQUEST_BYTES,
  type ConversationRequestRouteDependencies,
} from "./conversation-request-route";
import { ConversationRequestError } from "./conversation-requests";

const familyId = randomUUID(), memberUserId = randomUUID(), accessEpoch = randomUUID();
const account = `${familyId}:${memberUserId}`, intentId = randomUUID();
const receipt = { intentId, requestId: randomUUID(), messageId: randomUUID(),
  acceptedAt: new Date().toISOString(), state: "queued" as const, replayed: false };
function fixture(overrides: Partial<ConversationRequestRouteDependencies> = {}) {
  const calls: unknown[] = [];
  const deps: ConversationRequestRouteDependencies = {
    enabled: () => true, principal: async () => ({ familyId, memberUserId }), limited: () => false,
    access: async p => { calls.push(p); return { conversationId: randomUUID(), accessEpoch }; },
    accept: async (p, input) => { calls.push({ p, input }); return receipt; },
    answer: async () => { throw new Error("Unexpected question answer"); },
    questions: async p => { calls.push(p); return []; },
    receipt: async (p, id) => { calls.push({ p, id }); return receipt; }, ...overrides,
  };
  return { calls, deps };
}
function post(body: object = { account, accessEpoch, intentId, text: "Hello" }, headers = {}) {
  return new Request("https://homa.test/api/conversation/requests", { method: "POST",
    headers: { authorization: "Bearer exact-token", "content-type": "application/json", ...headers },
    body: JSON.stringify(body) });
}

test("disabled admission cannot create or read a record", async () => {
  const { deps, calls } = fixture({ enabled: () => false, principal: async () => { throw new Error(); } });
  const response = await conversationRequestResponse(post(), deps);
  assert.equal(response.status, 503); assert.deepEqual(calls, []);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("cookies and malformed bearers cannot enter automatic delivery", async () => {
  const { deps, calls } = fixture({ principal: async () => { throw new Error("must not resolve"); } });
  for (const authorization of [undefined, "Basic cookie-fallback", "Bearer two tokens"]) {
    const request = new Request("https://homa.test/api/conversation/requests", {
      headers: { cookie: "session=other-adult", ...(authorization ? { authorization } : {}) },
    });
    assert.equal((await conversationRequestResponse(request, deps)).status, 401);
  }
  assert.deepEqual(calls, []);
});

test("acceptance pins server ownership and preserves exact text", async () => {
  const { deps, calls } = fixture();
  const text = `  Hi\n${"🥑".repeat(5000)}  `;
  const response = await conversationRequestResponse(post({ account, accessEpoch, intentId, text }), deps);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { receipt });
  assert.deepEqual(calls, [{ p: { familyId, memberUserId, accessEpoch }, input: { intentId, text } }]);
});

test("replay returns receipt without claiming a new submission", async () => {
  const { deps } = fixture({ accept: async () => ({ ...receipt, replayed: true }) });
  assert.equal((await conversationRequestResponse(post(), deps)).status, 200);
});

test("different account, supplied family selector and attachments fail before acceptance", async () => {
  const { deps, calls } = fixture();
  assert.equal((await conversationRequestResponse(post({ account: `${randomUUID()}:${memberUserId}`, accessEpoch, intentId, text: "Hi" }), deps)).status, 409);
  for (const extra of [{ familyId }, { attachments: [] }, { sessionId: "forged" }]) {
    assert.equal((await conversationRequestResponse(post({ account, accessEpoch, intentId, text: "Hi", ...extra }), deps)).status, 400);
  }
  assert.deepEqual(calls, []);
});

test("receipt lookup requires the same account and epoch", async () => {
  const { deps, calls } = fixture();
  const get = (params: object) => new Request(`https://homa.test/api/conversation/requests?${new URLSearchParams(params as Record<string,string>)}`,
    { headers: { authorization: "Bearer exact-token" } });
  assert.equal((await conversationRequestResponse(get({ intentId }), deps)).status, 409);
  assert.equal((await conversationRequestResponse(get({ intentId, account, accessEpoch }), deps)).status, 200);
  assert.deepEqual(calls, [{ p: { familyId, memberUserId, accessEpoch }, id: intentId }]);
});

test("commit uncertainty stays retryable and never discloses storage errors", async () => {
  const { deps } = fixture({ accept: async () => { throw new Error("secret transcript/database token"); } });
  const response = await conversationRequestResponse(post(), deps);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { reason: "retry" });
});

test("known storage failures have distinct non-success results", async () => {
  for (const [code, status] of [["conflict",409],["deleted",410],["membership",403],["access_changed",409],["invalid",400]] as const) {
    const { deps } = fixture({ accept: async () => { throw new ConversationRequestError(code); } });
    const response = await conversationRequestResponse(post(), deps);
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { reason: code });
  }
});

test("actual body bytes are bounded and never truncated", async () => {
  const { deps, calls } = fixture();
  const response = await conversationRequestResponse(post({ account, accessEpoch, intentId,
    text: "a".repeat(MAX_CONVERSATION_REQUEST_BYTES) }, { "content-length": "1" }), deps);
  assert.equal(response.status, 413); assert.deepEqual(calls, []);
});

test("wrong content type and malformed JSON never enter storage", async () => {
  const { deps, calls } = fixture();
  assert.equal((await conversationRequestResponse(post({}, { "content-type": "text/plain" }), deps)).status, 415);
  const req = new Request("https://homa.test/api/conversation/requests", { method: "POST", headers: {
    authorization: "Bearer exact-token", "content-type": "application/json" }, body: "{" });
  assert.equal((await conversationRequestResponse(req, deps)).status, 400);
  assert.deepEqual(calls, []);
});

test("rate limited requests retain retryable semantics", async () => {
  const { deps, calls } = fixture({ limited: a => { assert.equal(a, account); return true; } });
  const response = await conversationRequestResponse(post(), deps);
  assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "5");
  assert.deepEqual(calls, []);
});


test("question restoration is account and access generation scoped", async () => {
  const { deps, calls } = fixture();
  const get = (params: object) => new Request(`https://homa.test/api/conversation/requests?${new URLSearchParams(params as Record<string,string>)}`,
    { headers: { authorization: "Bearer exact-token" } });
  assert.equal((await conversationRequestResponse(get({ questions: "true" }), deps)).status, 409);
  assert.equal((await conversationRequestResponse(get({ questions: "true", account }), deps)).status, 400);
  const response = await conversationRequestResponse(get({ questions: "true", account, accessEpoch }), deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { questions: [] });
  assert.deepEqual(calls, [{ familyId, memberUserId, accessEpoch }]);
});


test("selected answers are routed without trusting client text", async () => {
  const calls: unknown[] = [];
  const questionAnswer = { questionId: randomUUID(), answers: [{ question: 0, kind: "skip" }] };
  const { deps } = fixture({ answer: async (owner, input) => { calls.push({ owner, input }); return receipt; } });
  assert.equal((await conversationRequestResponse(post({ account, accessEpoch, intentId, questionAnswer }), deps)).status, 202);
  assert.deepEqual(calls, [{ owner: { familyId, memberUserId, accessEpoch }, input: { intentId, questionAnswer } }]);
  for (const text of ["forged", 7, null]) {
    assert.equal((await conversationRequestResponse(post({ account, accessEpoch, intentId, questionAnswer, text }), deps)).status, 400);
  }
  assert.equal(calls.length, 1);
});


test("attachment-only sends admit ordered receipt IDs without client file bodies", async () => {
  const attachmentIds=[randomUUID(),randomUUID()];
  const {deps,calls}=fixture();
  assert.equal((await conversationRequestResponse(post({account,accessEpoch,intentId,text:"",attachmentIds}),deps)).status,202);
  assert.deepEqual(calls,[{p:{familyId,memberUserId,accessEpoch},input:{intentId,text:"",attachmentIds}}]);
  for(const ids of [["https://example.com/file"],Array.from({length:7},()=>randomUUID()),{}]) {
    assert.equal((await conversationRequestResponse(post({account,accessEpoch,intentId,text:"",attachmentIds:ids}),deps)).status,400);
  }
  assert.equal((await conversationRequestResponse(post({account,accessEpoch,intentId,questionAnswer:{},attachmentIds}),deps)).status,400);
});
