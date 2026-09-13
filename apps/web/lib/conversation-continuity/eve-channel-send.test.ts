import assert from "node:assert/strict";
import test from "node:test";

import { sendEveChannelMessage, sendEveChannelTarget } from "./eve-channel-send";

const auth = { principalId: "synthetic-adult", attributes: { familyId: "synthetic-family" } };
const options = { continuationToken: "channel:exact/address", auth, state: { jobId: "job-1" }, context: ["context"], mode: "task" };
const session = { id: "synthetic-session" };

test("legacy channel delivery preserves options and session identity", async () => {
  const channel = {
    async send(message: string, received: typeof options) {
      assert.equal(this, channel);
      assert.equal(message, "message");
      assert.equal(received, options);
      return session;
    },
  };
  assert.equal(await sendEveChannelMessage(channel, "message", options), session);
});

test("handle channel delivery preserves exact address, auth, state and result", async () => {
  const source = {
    async send(message: string, received: Omit<typeof options, "continuationToken">) {
      assert.equal(this, source);
      assert.equal(message, "message");
      assert.equal(received.auth, auth);
      assert.equal(received.state, options.state);
      assert.deepEqual(received, { auth, state: options.state, context: options.context, mode: "task" });
      assert(!("continuationToken" in received));
      return session;
    },
  };
  const channel = { from(address: string) { assert.equal(this, channel); assert.equal(address, options.continuationToken); return source; } };
  assert.equal(await sendEveChannelMessage(channel, "message", options), session);
  assert.equal(options.continuationToken, "channel:exact/address");
});

test("handle bridge refuses missing addresses and never retries ambiguous delivery", async () => {
  let sends = 0;
  const failure = new Error("delivery outcome unknown");
  const channel = { from() { return { async send() { sends++; throw failure; } }; } };
  assert.throws(() => sendEveChannelMessage(channel, "message", { ...options, continuationToken: "" }), /requires a conversation address/);
  assert.equal(sends, 0);
  await assert.rejects(sendEveChannelMessage(channel, "message", options), e => e === failure);
  assert.equal(sends, 1);
});

test("schedule bridge preserves channel, target and authenticated caller on both versions", async () => {
  const channel = { name: "synthetic-channel" };
  const input = { message: "next stage", target: options.state, auth };
  const legacy = {
    async receive(receivedChannel: typeof channel, received: typeof input) {
      assert.equal(this, legacy);
      assert.equal(receivedChannel, channel);
      assert.equal(received, input);
      return session;
    },
  };
  const target = {
    async send(message: string, received: { auth: typeof auth }) {
      assert.equal(this, target);
      assert.equal(message, input.message);
      assert.equal(received.auth, auth);
      return session;
    },
  };
  const candidate = {
    to(receivedChannel: typeof channel, receivedTarget: typeof input.target) {
      assert.equal(this, candidate);
      assert.equal(receivedChannel, channel);
      assert.equal(receivedTarget, input.target);
      return target;
    },
  };
  assert.equal(await sendEveChannelTarget(legacy, channel, input), session);
  assert.equal(await sendEveChannelTarget(candidate, channel, input), session);
});
