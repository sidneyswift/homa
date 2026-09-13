import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Offline experiment against an extracted candidate package. No dependency
// installation, provider request, or application deployment is performed.
const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath, "Usage: node scripts/eve-client-lifecycle-probe.mjs <candidate-package> <receipt.json>");
const root = resolve(packageDirectory);
const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const { Client, EveAgentStore, defaultMessageReducer } = await import(
  pathToFileURL(resolve(root, "dist/src/client/index.js")).href
);
const { createRecoverableEveAgentStore } = await import(
  "../apps/web/app/app/recoverable-eve-agent-store.ts"
);

const sessionId = "synthetic-lifecycle-session";
const host = "https://homa-lifecycle.test";
const requests = [];
const pending = [];
const checks = [];
const transportViolations = [];
const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();
const deadline = setTimeout(() => {
  console.error("Candidate lifecycle probe did not settle within 15 seconds.");
  process.exit(1);
}, 15_000);

function expectRequest(method, path, respond) {
  pending.push({ method, path, respond });
}

function eventsForTurn(turn, sequence, text, deliveryId) {
  const meta = deliveryId ? { deliveryIds: [deliveryId] } : undefined;
  return [
    { type: "turn.started", data: { turnId: turn, sequence }, ...(meta ? { meta } : {}) },
    { type: "message.appended", data: { turnId: turn, sequence: sequence + 1, stepIndex: 0, messageDelta: text }, ...(meta ? { meta } : {}) },
    { type: "message.completed", data: { turnId: turn, sequence: sequence + 2, stepIndex: 0, message: text, finishReason: "stop" }, ...(meta ? { meta } : {}) },
    { type: "session.waiting", data: { wait: "next-user-message" }, ...(meta ? { meta } : {}) },
  ];
}

function streamResponse(events, init, hold = false) {
  let controller;
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    init.signal?.removeEventListener("abort", abort);
    controller.close();
  };
  const abort = () => {
    if (!open) return;
    open = false;
    controller.error(new DOMException("Synthetic client disconnected", "AbortError"));
  };
  const body = new ReadableStream({
    start(value) {
      controller = value;
      for (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      if (hold) init.signal?.addEventListener("abort", abort, { once: true });
      else close();
    },
    cancel() {
      open = false;
      init.signal?.removeEventListener("abort", abort);
    },
  });
  return new Response(body, { headers: {
    "content-type": "application/x-ndjson",
    "x-eve-stream-version": "25",
  } });
}

globalThis.fetch = async (url, init = {}) => {
  try {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, host);
    const method = init.method ?? "GET";
    const path = `${parsed.pathname}${parsed.search}`;
    const expected = pending.shift();
    assert.ok(expected, `Unexpected request: ${method} ${path}`);
    assert.equal(method, expected.method);
    assert.equal(path, expected.path);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer synthetic-fixture");
    requests.push({ method, path, ...(init.body ? { body: JSON.parse(init.body) } : {}) });
    return expected.respond(init);
  } catch (error) {
    transportViolations.push(String(error));
    throw error;
  }
};

function createStore(initialSession, initialEvents) {
  return new EveAgentStore({
    host, auth: { bearer: "synthetic-fixture" }, reducer: defaultMessageReducer(),
    initialSession, initialEvents,
  });
}

function textOf(snapshot) {
  return snapshot.data.messages.filter(message => message.role === "assistant")
    .flatMap(message => message.parts).filter(part => part.type === "text")
    .map(part => part.text).join("");
}

try {
  const store = createRecoverableEveAgentStore(createStore());
  assert.equal(store.snapshot.session, undefined);
  assert.equal(requests.length, 0);
  checks.push("constructing a fresh store performs no request and invents no session ID");

  const first = eventsForTurn("first-turn", 0, "First answer.");
  let visibleBeforeCompleted = false;
  store.subscribe(() => {
    if (textOf(store.snapshot) === "First answer." && !store.snapshot.events.some(event => event.type === "message.completed")) {
      visibleBeforeCompleted = true;
    }
  });
  expectRequest("POST", "/eve/v1/session", () => Response.json({ sessionId }, { status: 202 }));
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream`, init => streamResponse(first, init));
  await store.send({ message: "First question", clientContext: { page: "chat" }, streamReconnectPolicy: { reconnect: false } });
  assert.equal(visibleBeforeCompleted, true);
  assert.equal(store.snapshot.status, "ready");
  assert.deepEqual(store.snapshot.session, { sessionId, streamIndex: 4 });
  assert.deepEqual(requests[0].body, { message: "First question", clientContext: { page: "chat" } });
  checks.push("one initial POST creates the session and partial answer text reaches the reducer before completion");

  const second = eventsForTurn("second-turn", 4, "Second answer.", "second-delivery");
  expectRequest("POST", `/eve/v1/session/${sessionId}`, () => Response.json({ sessionId, deliveryId: "second-delivery" }, { status: 202 }));
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream?startIndex=4`, init => streamResponse(second, init));
  await store.send({ message: "Second question", streamReconnectPolicy: { reconnect: false } });
  assert.deepEqual(store.snapshot.session, { sessionId, streamIndex: 8 });
  assert.equal(textOf(store.snapshot), "First answer.Second answer.");
  checks.push("the next message uses the existing session and advances its stream cursor");

  const third = eventsForTurn("third-turn", 8, "Interrupted answer.", "third-delivery");
  const partialArrived = Promise.withResolvers();
  let finished = 0;
  store.setCallbacks({ onFinish: () => { finished++; } });
  const unsubscribe = store.subscribe(() => {
    if (textOf(store.snapshot).includes("Interrupted answer.")) partialArrived.resolve();
  });
  expectRequest("POST", `/eve/v1/session/${sessionId}`, () => Response.json({ sessionId, deliveryId: "third-delivery" }, { status: 202 }));
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream?startIndex=8`, init => streamResponse(third.slice(0, 2), init, true));
  const sending = store.send({ message: "Third question", streamReconnectPolicy: { reconnect: false } });
  await partialArrived.promise;
  store.stop();
  await sending;
  unsubscribe();
  assert.equal(store.snapshot.status, "ready");
  assert.equal(store.snapshot.error, undefined);
  assert.equal(finished, 1);
  assert.deepEqual(store.snapshot.session, { sessionId, streamIndex: 10 });
  assert.equal(textOf(store.snapshot), "First answer.Second answer.Interrupted answer.");
  checks.push("aborting the public send signal detaches locally, preserves partial text and cursor, and finishes once without a cancel request");

  const client = new Client({ host, auth: { bearer: "synthetic-fixture" } });
  const replay = client.sessions.attach(sessionId, { streamIndex: 0 });
  const durable = [...first, ...second, ...third];
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream`, init => streamResponse(durable, init));
  const recoveredEvents = [];
  for await (const event of replay.stream({ startIndex: 0, streamReconnectPolicy: { reconnect: false } })) recoveredEvents.push(event);
  assert.equal(recoveredEvents.length, 12);
  let replacementNotifications = 0;
  const unsubscribeReplacement = store.subscribe(() => { replacementNotifications++; });
  store.replace(createStore(replay.state, recoveredEvents));
  assert.equal(replacementNotifications, 1);
  assert.deepEqual(store.snapshot.session, { sessionId, streamIndex: 12 });
  assert.equal(textOf(store.snapshot), "First answer.Second answer.Interrupted answer.");
  const fourth = eventsForTurn("fourth-turn", 12, "After recovery.", "fourth-delivery");
  expectRequest("POST", `/eve/v1/session/${sessionId}`, () => Response.json({ sessionId, deliveryId: "fourth-delivery" }, { status: 202 }));
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream?startIndex=12`, init => streamResponse(fourth, init));
  await store.send({ message: "After reconnect", streamReconnectPolicy: { reconnect: false } });
  assert.equal(store.snapshot.session.sessionId, sessionId);
  assert.ok(replacementNotifications > 1);
  unsubscribeReplacement();
  assert.equal(requests.filter(request => request.path === "/eve/v1/session").length, 1);
  checks.push("read-only replay followed by a replacement store continues the original session without replaying the submitted message");

  store.reset();
  assert.equal(store.snapshot.session, undefined);
  assert.equal(store.snapshot.events.length, 0);
  checks.push("reset clears a store-owned session, so recovery must replace the store instead of resetting after attachment");

  const replacing = createRecoverableEveAgentStore(createStore({ sessionId, streamIndex: 0 }));
  const retiringPartial = Promise.withResolvers();
  const replacementPartial = Promise.withResolvers();
  let replacementFinishes = 0;
  replacing.setCallbacks({ onFinish: () => { replacementFinishes++; } });
  replacing.subscribe(() => {
    const text = textOf(replacing.snapshot);
    if (text === "Retiring connection.") retiringPartial.resolve();
    if (text === "Replacement connection.") replacementPartial.resolve();
  });
  expectRequest("POST", `/eve/v1/session/${sessionId}`, () => Response.json({ sessionId, deliveryId: "retiring-delivery" }, { status: 202 }));
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream`, init => streamResponse(eventsForTurn("retiring-turn", 0, "Retiring connection.", "retiring-delivery").slice(0, 2), init, true));
  const retiringSend = replacing.send({ message: "Retiring question", streamReconnectPolicy: { reconnect: false } });
  await retiringPartial.promise;
  replacing.replace(createStore({ sessionId, streamIndex: 12 }));
  expectRequest("POST", `/eve/v1/session/${sessionId}`, () => Response.json({ sessionId, deliveryId: "replacement-delivery" }, { status: 202 }));
  expectRequest("GET", `/eve/v1/session/${sessionId}/stream?startIndex=12`, init => streamResponse(eventsForTurn("replacement-turn", 12, "Replacement connection.", "replacement-delivery").slice(0, 2), init, true));
  const replacementSend = replacing.send({ message: "Replacement question", streamReconnectPolicy: { reconnect: false } });
  await replacementPartial.promise;
  await retiringSend;
  assert.equal(replacementFinishes, 0);
  await assert.rejects(() => replacing.send({ message: "Duplicate attempt" }), /already being sent/);
  replacing.stop();
  await replacementSend;
  assert.equal(replacementFinishes, 1);
  assert.equal(replacing.snapshot.status, "ready");
  assert.equal(textOf(replacing.snapshot), "Replacement connection.");
  checks.push("replacing an active connection suppresses its stale finish callback and preserves control of the replacement send");
  checks.push("a concurrent duplicate send is rejected before transport");

  const failingStore = createStore();
  expectRequest("POST", "/eve/v1/session", () => new Response("Synthetic failure", { status: 500 }));
  await failingStore.send({ message: "Failure case", streamReconnectPolicy: { reconnect: false } });
  assert.equal(failingStore.snapshot.status, "error");
  assert.equal(failingStore.snapshot.session, undefined);
  assert.equal(pending.length, 0);
  assert.deepEqual(transportViolations, []);
  checks.push("a failed creation reports an error without an automatic duplicate POST");

  await writeFile(resolve(receiptPath), `${JSON.stringify({
    checkedAt: new Date().toISOString(), candidate: metadata.version, checks, requests,
    networkCalls: 0, modelCalls: 0, databaseWrites: 0,
    limitations: "Actual candidate client, store, reducer and Homa recoverable store wrapper with synthetic HTTP responses. This does not test Homa's React wiring, server runtime, browser painting, a deployment, or latency.",
  }, null, 2)}\n`);
  console.log(`${checks.length} candidate lifecycle checks passed; no network or model calls.`);
} finally {
  globalThis.fetch = originalFetch;
  clearTimeout(deadline);
}
