import assert from "node:assert/strict";
import test from "node:test";

import { sendEveClientMessage } from "./eve-client-message";

test("legacy message delivery preserves the exact cursor and input", async () => {
  const input = { message: "Fixture", signal: new AbortController().signal };
  const cursor = { sessionId: "existing", streamIndex: 8, continuationToken: "legacy-token" };
  const response = { marker: true };
  const session = { state: cursor, send: async (actual: typeof input) => {
    assert.equal(actual, input); return response;
  } };
  const result = await sendEveClientMessage({ session: actual => {
    assert.equal(actual, cursor); return session;
  } }, input, cursor, 4);
  assert.equal(result.session, session);
  assert.equal(result.response, response);
});

test("handle creation carries context and abort signal, then exposes the live advanced cursor", async () => {
  const signal = new AbortController().signal;
  let streamIndex = 0;
  const session = { get state() { return { sessionId: "created", streamIndex }; } };
  const response = { consume() { streamIndex = 7; } };
  const result = await sendEveClientMessage({ sessions: {
    attach: () => assert.fail("must create"),
    create: async input => {
      assert.equal(input.message, "Fixture");
      assert.equal(input.signal, signal);
      assert.equal(input.clientContext, "Voice context");
      assert.equal(input.streamReconnectPolicy.streamOpenReconnectPolicy.maxAttempts, 4);
      assert.equal(Object.hasOwn(input.streamReconnectPolicy, "streamIdleReconnectPolicy"), false);
      return { session, response };
    },
  } }, { message: "Fixture", clientContext: "Voice context", signal }, undefined, 4);
  result.response.consume();
  assert.deepEqual(result.session.state, { sessionId: "created", streamIndex: 7 });
});

test("a failed handle follow-up cannot create or resend a conversation", async () => {
  let sends = 0;
  const cursor = { sessionId: "existing", streamIndex: 8, continuationToken: "old-credential" };
  await assert.rejects(sendEveClientMessage({ sessions: {
    create: async () => assert.fail("must not fall back to creation"),
    attach: (id, state) => {
      assert.equal(id, cursor.sessionId);
      assert.deepEqual(state, { streamIndex: 8 });
      return { state: cursor, send: async (message, options) => {
        sends++;
        assert.equal(message, "Fixture");
        assert.equal(Object.hasOwn(options, "continuationToken"), false);
        throw new Error("uncertain delivery");
      } };
    },
  } }, { message: "Fixture", signal: new AbortController().signal }, cursor, 4), /uncertain delivery/);
  assert.equal(sends, 1);
});

test("invalid or token-only legacy cursors cannot become fresh handle conversations", async () => {
  for (const cursor of [
    { streamIndex: 2, sessionId: "" },
    { streamIndex: 2, sessionId: " existing " },
    { streamIndex: 2, continuationToken: "legacy-only" },
  ]) {
    await assert.rejects(sendEveClientMessage({ sessions: {
      create: async () => assert.fail("invalid cursor must not create"),
      attach: () => assert.fail("invalid cursor must not attach"),
    } }, { message: "Fixture", signal: new AbortController().signal }, cursor, 4), /session ID/);
  }
});
