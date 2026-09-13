import assert from "node:assert/strict";
import test from "node:test";

import { acceptedUpgradeSession, assertUpgradeReply, parkedUpgradeQuestion, readUpgradeStream, upgradeAnswerBody, UPGRADE_QUESTION } from "./eve-upgrade-proof.mjs";

const event = (type, data = {}) => ({ type, data });
const waiting = event("session.waiting", { wait: "next-user-message" });
function baseline() {
  return [
    event("turn.started", { turnId: "original-turn" }),
    event("input.requested", { turnId: "original-turn", requests: [{
      requestId: "question-1", prompt: UPGRADE_QUESTION, allowFreeform: true,
      action: { kind: "tool-call", toolName: "ask_question", callId: "call-1", input: {} },
    }] }),
    event("turn.completed", { turnId: "original-turn" }), waiting,
  ];
}
const probe = "upgrade-proof:unpredictable-after-parking";

test("a September candidate receives an ID-addressed response without a rejected legacy token", () => {
  assert.deepEqual(upgradeAnswerBody({ version: "0.54.3", continuationToken: "old-token", requestId: "question-1", probe }), {
    inputResponses: [{ requestId: "question-1", text: probe }],
  });
  assert.deepEqual(upgradeAnswerBody({ version: "0.19.0", continuationToken: "old-token", requestId: "question-1", probe }), {
    continuationToken: "old-token", inputResponses: [{ requestId: "question-1", text: probe }],
  });
  assert.throws(() => upgradeAnswerBody({ version: "0.19.0", requestId: "question-1", probe }), /requires a continuation/);
  assert.throws(() => upgradeAnswerBody({ version: "latest", requestId: "question-1", probe }), /exact Eve versions/);
});
function resumed() {
  return [...baseline(), event("turn.started", { turnId: "resumed-turn" }),
    event("message.completed", { turnId: "resumed-turn", message: probe, finishReason: "stop" }),
    event("turn.completed", { turnId: "resumed-turn" }), waiting];
}

test("an idle session alone does not establish a parked question", () => {
  assert.throws(() => parkedUpgradeQuestion([event("turn.started", { turnId: "turn_1" }), waiting]), /actual pending/);
});
test("a real pending freeform question is accepted", () => {
  assert.deepEqual(parkedUpgradeQuestion(baseline()), { requestId: "question-1" });
});
test("a different question or tool, missing identity, and unanswered batches fail closed", () => {
  for (const mutate of [
    (r) => { r.prompt = "Something else?"; },
    (r) => { r.action.toolName = "delete_account"; },
    (r) => { r.requestId = ""; },
    (r) => { r.action.callId = ""; },
    (r) => { r.allowFreeform = false; },
  ]) {
    const events = baseline(); mutate(events[1].data.requests[0]);
    assert.throws(() => parkedUpgradeQuestion(events));
  }
  const events = baseline(); events[1].data.requests.push(events[1].data.requests[0]);
  assert.throws(() => parkedUpgradeQuestion(events));
});
test("a question must still be parked when the old server stops", () => {
  assert.throws(() => parkedUpgradeQuestion(baseline().slice(0, -1)), /observed parked/);
  assert.throws(() => parkedUpgradeQuestion([...baseline(), event("turn.started", { turnId: "later" })]), /observed parked/);
});
test("a completed new turn repeating the supplied probe proves continuation", () => {
  assertUpgradeReply({ baseline: baseline(), resumed: resumed(), probe });
});
test("old history and a turn-start alone cannot prove continuation", () => {
  assert.throws(() => assertUpgradeReply({ baseline: baseline(), resumed: baseline(), probe }), /No new turn/);
  assert.throws(() => assertUpgradeReply({ baseline: baseline(), resumed: [...baseline(), event("turn.started", { turnId: "new" })], probe }), /did not repeat/);
});
test("wrong output, missing turn identity, reasoning-only, and incomplete replies fail", () => {
  for (const mutate of [
    (events) => { events[5].data.message = "4"; },
    (events) => { delete events[4].data.turnId; },
    (events) => { events[5].type = "reasoning.completed"; },
    (events) => { events[5].data.turnId = "original-turn"; },
    (events) => { events[5].data.finishReason = "length"; },
    (events) => { events.splice(6, 1); },
    (events) => { events[6].data.turnId = "other-turn"; },
  ]) {
    const events = resumed(); mutate(events);
    assert.throws(() => assertUpgradeReply({ baseline: baseline(), resumed: events, probe }));
  }
});
test("failures and repeated questions invalidate apparent success", () => {
  for (const type of ["step.failed", "turn.failed", "session.failed", "input.requested"]) {
    assert.throws(() => assertUpgradeReply({ baseline: baseline(), resumed: [...resumed(), event(type)], probe }));
  }
  assert.throws(() => parkedUpgradeQuestion([...baseline(), event("session.failed")]));
});

test("the stream reader preserves final events without a trailing newline", async () => {
  const events = await readUpgradeStream("https://test.invalid", 1000, async () =>
    new Response(baseline().map(JSON.stringify).join("\n")));
  assert.deepEqual(events, baseline());
});
test("malformed events, HTTP errors, and transport loss cannot be treated as success", async () => {
  for (const response of [
    new Response("unavailable", { status: 503 }),
    new Response('{"type":"session.failed"'),
    new Response('{}\n'),
    new Response(new ReadableStream({ start(controller) { controller.error(new TypeError("Load failed")); } })),
  ]) {
    await assert.rejects(readUpgradeStream("https://test.invalid", 1000, async () => response));
  }
});
test("our observation deadline retains complete events from an open parked stream", async () => {
  const events = await readUpgradeStream("https://test.invalid", 10, async (_url, { signal }) =>
    new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`${JSON.stringify(waiting)}\n`));
      signal.addEventListener("abort", () => controller.error(new DOMException("Deadline", "AbortError")), { once: true });
    } })));
  assert.deepEqual(events, [waiting]);
});


test("upgrade admission accepts each reviewed protocol without treating admission as reply proof", () => {
  const response = new Response(null, { status: 202, headers: { "x-eve-session-id": "session-1" } });
  assert.deepEqual(acceptedUpgradeSession({ version: "0.54.3", response,
    body: { sessionId: "session-1", deliveryId: "delivery-1" }, expectedSessionId: "session-1" }), { sessionId: "session-1" });
  assert.deepEqual(acceptedUpgradeSession({ version: "0.19.0", response,
    body: { ok: true, sessionId: "session-1", continuationToken: "legacy-token" } }),
  { sessionId: "session-1", continuationToken: "legacy-token" });
  assert.throws(() => assertUpgradeReply({ baseline: baseline(), resumed: baseline(), probe }), /No new turn/);
});

test("upgrade admission rejects failed, mismatched, malformed, and mixed-protocol acknowledgements", () => {
  const accepted = new Response(null, { status: 202 });
  for (const input of [
    { response: new Response(null, { status: 409 }), body: { sessionId: "session-1" } },
    { response: new Response(null, { status: 200 }), body: { sessionId: "session-1" } },
    { body: { ok: false, sessionId: "session-1" } },
    { body: { sessionId: "different" }, expectedSessionId: "session-1" },
    { response: new Response(null, { status: 202, headers: { "x-eve-session-id": "different" } }), body: { sessionId: "session-1" } },
    ...[null, [], {}, { sessionId: "" }, { sessionId: " a " }, { sessionId: "../different" },
      { sessionId: "session-1", continuationToken: "old-token" }].map(body => ({ body })),
  ]) assert.throws(() => acceptedUpgradeSession({ version: "0.54.3", response: accepted, ...input }));
  for (const body of [{ sessionId: "session-1" }, { ok: true, sessionId: "session-1", continuationToken: " " }]) {
    assert.throws(() => acceptedUpgradeSession({ version: "0.19.0", response: accepted, body }), /continuation token/);
  }
});

test("legacy continuation uses 200 and original identity, while creation still requires 202 and a token", () => {
  const response = new Response(null, { status: 200 });
  const body = { ok: true, sessionId: "session-1" };
  const request = { version: "0.19.0", response, body, expectedSessionId: "session-1" };
  assert.deepEqual(acceptedUpgradeSession(request), { sessionId: "session-1" });
  for (const invalid of [
    { expectedSessionId: undefined },
    { expectedSessionId: "different" },
    { body: { ...body, ok: false } },
    { response: new Response(null, { status: 202 }) },
  ]) assert.throws(() => acceptedUpgradeSession({ ...request, ...invalid }));
});
