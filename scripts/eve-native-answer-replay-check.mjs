import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(root, "apps/web/package.json"));
const eve = path.dirname(require.resolve("eve/package.json"));
const { defineChannel } = await import(path.join(eve, "dist/src/public/definitions/defineChannel.js"));
const { createSendFn } = await import(path.join(eve, "dist/src/channel/send.js"));

const received = [];
const state = { seen: {} };
const { adapter } = defineChannel({ routes: [], state,
  deliver(payload, context) {
    const prior = context.state.seen[payload.idempotencyKey];
    const value = JSON.stringify(payload.inputResponses);
    if (prior !== undefined) {
      assert.equal(prior, value, "A changed answer must not reuse a delivery identity");
      return undefined;
    }
    context.state.seen[payload.idempotencyKey] = value;
    received.push(payload);
    return { inputResponses: payload.inputResponses };
  },
});
let newSessions = 0;
const runtime = { async run() { newSessions++; throw new Error("Unexpected fresh session"); }, async deliver({ payload }) {
  const delivered = adapter.deliver(payload, { state: adapter.state });
  if (received.length === 1) assert.equal(payload.idempotencyKey, "answer-1");
  return { sessionId: "session", delivered };
} };
const send = createSendFn(runtime, {}, "conversation-request");
const payload = { idempotencyKey: "answer-1", inputResponses: [{ requestId: "question-1", optionId: "yes" }] };
const options = { auth: null, continuationToken: "session-token" };
await send(payload, options);
await send(payload, options);
assert.equal(received.length, 1, "Installed Eve must call the authored guard and discard duplicate input");
assert.equal(received[0].context, undefined, "Delivery identity must not become model text");
assert.throws(() => adapter.deliver({ ...payload, inputResponses: [{ requestId: "question-1", optionId: "no" }] }, { state: adapter.state }));
await assert.rejects(send({ ...payload, inputResponses: [{ requestId: "question-1", optionId: "no" }] }, options), /Cannot deliver inputResponses/u);
assert.equal(newSessions, 0, "An answer delivery failure must never start a fresh session");
const ordinary = defineChannel({ routes: [], state: {} });
assert.equal(ordinary.adapter.deliver({ message: "hello" }).message, "hello");
console.log("PASS installed Eve preserves answer identity and invokes delivery guards before input consumption");
