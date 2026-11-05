// Executes installed package helpers, event codecs and the installed driver wait
// loop. This is boundary evidence, not a workflow-host crash/restart test.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const installed = pathToFileURL(`${process.cwd()}/apps/web/node_modules/eve/dist/src/`);
const messagesUrl = new URL("harness/messages.js", installed).href;
const importCode = code => import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const helpersUrl = new URL("execution/deliver-payloads.js", installed).href;
const helpers = await import(helpersUrl);
const source = await readFile(new URL("execution/workflow-entry.js", installed), "utf8");
const section = source.slice(source.indexOf("async function waitForNextDeliver(e)"), source.indexOf("export{workflowEntry};"));
const { waitForNextDeliver } = await importCode(`import{coalesceDeliveries}from${JSON.stringify(messagesUrl)};
  import{hasKeyedInputResponseDelivery,takeCoalescibleDelivery}from${JSON.stringify(helpersUrl)};
  ${section} export{waitForNextDeliver};`);

const keyed = (id, option = "approve") => ({ kind: "deliver", auth: { attributes: { owner: "parent", request: id } },
  requestId: `http:${id}`, payloads: [{ idempotencyKey: id, inputResponses: [{ requestId: `approval:${id}`, optionId: option }] }] });
const ordinary = id => ({ kind: "deliver", auth: { attributes: { request: id } }, requestId: `http:${id}`, payloads: [{ message: id }] });
function hook(deliveries) {
  let index = 0;
  return { next: () => Promise.resolve(index < deliveries.length ? { done: false, value: deliveries[index] } : { done: true }),
    consumeNext: () => { index++; }, get consumed() { return index; } };
}

test("queued duplicate and newer approval preserve envelope order, complete auth and request identity", async () => {
  const values = [keyed("old"), keyed("old"), keyed("new", "deny")];
  const queue = [...values], deliveryHook = hook([]);
  for (const value of values) assert.strictEqual(await waitForNextDeliver({ bufferedDeliveries: queue, deliveryHook }), value);
  assert.deepEqual(queue, []);
  assert.equal(deliveryHook.consumed, 0);
});
test("ordinary prefixes keep existing coalescing, with no crossing of keyed boundaries", async () => {
  const a = ordinary("a"), b = ordinary("b"), answer = keyed("answer"), c = ordinary("c"), d = ordinary("d");
  const queue = [a, b, answer, c, d], deliveryHook = hook([]);
  assert.deepEqual(await waitForNextDeliver({ bufferedDeliveries: queue, deliveryHook }), { ...a, auth: b.auth, payloads: [...a.payloads, ...b.payloads] });
  assert.strictEqual(await waitForNextDeliver({ bufferedDeliveries: queue, deliveryHook }), answer);
  assert.deepEqual(await waitForNextDeliver({ bufferedDeliveries: queue, deliveryHook }), { ...c, auth: d.auth, payloads: [...c.payloads, ...d.payloads] });
});
test("ready hook stops at keyed boundary and pushes back without losing or reordering arrivals", async () => {
  const a = ordinary("a"), b = ordinary("b"), answer = keyed("answer"), next = keyed("next", "deny"), c = ordinary("c");
  const deliveryHook = hook([a, b, answer, next, c]), bufferedDeliveries = [];
  assert.deepEqual(await waitForNextDeliver({ bufferedDeliveries, deliveryHook }), { ...a, auth: b.auth, payloads: [...a.payloads, ...b.payloads] });
  assert.deepEqual(bufferedDeliveries, [answer]);
  assert.equal(deliveryHook.consumed, 3);
  assert.strictEqual(await waitForNextDeliver({ bufferedDeliveries, deliveryHook }), answer);
  assert.strictEqual(await waitForNextDeliver({ bufferedDeliveries, deliveryHook }), next);
  assert.deepEqual(await waitForNextDeliver({ bufferedDeliveries, deliveryHook }), c);
});
test("keyed first hook arrival does not eagerly consume a later answer", async () => {
  const values = [keyed("old"), keyed("old"), keyed("new", "deny")], deliveryHook = hook(values), bufferedDeliveries = [];
  for (const [index, value] of values.entries()) {
    assert.strictEqual(await waitForNextDeliver({ bufferedDeliveries, deliveryHook }), value);
    assert.equal(deliveryHook.consumed, index + 1);
  }
});
test("installed queue and adapter discard a duplicate before accepting the next answer", async () => {
  const { defineChannel } = await import(new URL("public/definitions/defineChannel.js", installed));
  const seen = new Map(), accepted = [];
  const { adapter } = defineChannel({ state: {}, routes: [], deliver(payload) {
    const digest = JSON.stringify(payload.inputResponses), prior = seen.get(payload.idempotencyKey);
    if (prior !== undefined) { assert.equal(prior, digest); return; }
    seen.set(payload.idempotencyKey, digest); accepted.push(payload); return { inputResponses: payload.inputResponses };
  } });
  const values = [keyed("old"), keyed("old"), keyed("new", "deny")];
  const bufferedDeliveries = [...values], deliveryHook = hook([]);
  while (bufferedDeliveries.length) {
    const delivery = await waitForNextDeliver({ bufferedDeliveries, deliveryHook });
    const payload = helpers.coalesceDeliverPayloads(delivery.payloads);
    assert.equal(payload.inputResponses.length, 1);
    assert.equal(delivery.auth.attributes.request, payload.idempotencyKey);
    adapter.deliver(payload, { state: adapter.state });
  }
  assert.deepEqual(accepted.map(value => value.idempotencyKey), ["old", "new"]);
  assert.equal(accepted[1].inputResponses[0].optionId, "deny");
});

test("keyed answers reach root guard before any child forwarding, while ordinary routing remains unchanged", async () => {
  const { routeDeliverToChildren } = await import(new URL("execution/route-child-delivery.js", installed));
  const answer = keyed("old");
  // Entering routeProxiedDeliverStep here would need a workflow host and fail.
  assert.strictEqual(await routeDeliverToChildren({ ...answer, sessionState: { hasProxyInputRequests: true } }), answer.payloads[0]);
  const message = ordinary("ordinary");
  assert.deepEqual(await routeDeliverToChildren({ ...message, sessionState: { hasProxyInputRequests: false } }), message.payloads[0]);
});
test("only the proxy emitter stamps provenance and installed event encoding preserves it", async () => {
  const { emitProxiedInputRequest } = await import(new URL("execution/subagent-hitl-proxy.js", installed));
  const { createInputRequestedEvent, encodeMessageStreamEvent } = await import(new URL("protocol/message.js", installed));
  const data = { turnId: "child-turn", sequence: 0, stepIndex: 0, requests: [{ requestId: "child-approval" }] };
  assert.equal(createInputRequestedEvent(data).data.nativeInputSource, undefined);
  const emitted = [];
  await emitProxiedInputRequest({ emit: async event => { emitted.push(event); }, mode: "task", session: { state: { "eve.harness.emission": { sessionStarted: true, turnId: "parent-turn", sequence: 4, stepIndex: 2 } } },
    hookPayload: { event: data, childContinuationToken: "child-token" } });
  assert.equal(emitted.length, 1);
  const wire = JSON.parse(new TextDecoder().decode(encodeMessageStreamEvent(emitted[0])));
  assert.equal(wire.data.nativeInputSource, "proxy");
  assert.deepEqual(wire.data.nativeInputParent, { turnId: "parent-turn", sequence: 4 });
  assert.deepEqual(wire.data.requests, data.requests);
});
test("installed adapter context reads new delivery auth before authored guard, with original initiator unchanged", async () => {
  const { ContextContainer } = await import(new URL("context/container.js", installed));
  const { AuthKey, InitiatorAuthKey } = await import(new URL("context/keys.js", installed));
  const { defineChannel } = await import(new URL("public/definitions/defineChannel.js", installed));
  const { buildAdapterContext } = await import(new URL("channel/adapter-context.js", installed));
  const context = new ContextContainer();
  const origin = { attributes: { request: "origin" } }, answer = keyed("answer").auth;
  context.set(AuthKey, origin); context.set(InitiatorAuthKey, origin);
  const { adapter } = defineChannel({ state: {}, routes: [], deliver(_, ctx) {
    assert.strictEqual(ctx.session.auth.current, answer);
    assert.strictEqual(ctx.session.auth.initiator, origin);
  } });
  context.set(AuthKey, answer);
  adapter.deliver({}, buildAdapterContext(adapter, context));
  const workflow = await readFile(new URL("execution/workflow-steps.js", installed), "utf8");
  const authAt = workflow.indexOf('l.set(AuthKey,t.input.auth??null)');
  const contextAt = workflow.indexOf('buildAdapterContext(f,l)');
  const guardAt = workflow.indexOf('f.deliver?await f.deliver');
  assert(authAt >= 0 && authAt < contextAt && contextAt < guardAt);
});
