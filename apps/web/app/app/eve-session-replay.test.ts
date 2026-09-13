import assert from "node:assert/strict";
import test from "node:test";

import { attachEveSessionForReplay } from "./eve-session-replay";

test("both client versions attach the exact existing conversation and forward replay options", async () => {
  const signal = new AbortController().signal;
  const options = { startIndex: 7, signal };
  const events = [{ type: "synthetic-event" }];
  const session = {
    async *stream(received: typeof options) {
      assert.equal(this, session);
      assert.equal(received, options);
      yield* events;
    },
    send() { assert.fail("replay must never send"); },
  };
  let attached = 0;
  const old = {
    session(state: { sessionId: string; streamIndex: number }) {
      assert.equal(this, old);
      assert.deepEqual(state, { sessionId: "saved-session", streamIndex: 0 });
      attached++;
      return session;
    },
  };
  const handles = {
    attach(id: string, cursor: { streamIndex: number }) {
      assert.equal(this, handles);
      assert.equal(id, "saved-session");
      assert.deepEqual(cursor, { streamIndex: 0 });
      attached++;
      return session;
    },
    create() { assert.fail("replay must never create"); },
  };
  for (const client of [old, { sessions: handles }]) {
    const replay = attachEveSessionForReplay(client, "saved-session");
    assert.deepEqual(Object.keys(replay), ["stream"]);
    const seen = [];
    for await (const event of replay.stream(options)) seen.push(event);
    assert.deepEqual(seen, events);
  }
  assert.equal(attached, 2);
});

test("invalid IDs and stream failures cannot fall back to starting a conversation", async () => {
  const failure = new Error("read unavailable");
  let attached = 0;
  const client = { sessions: {
    attach() {
      attached++;
      return { async *stream() { yield await Promise.reject(failure); } };
    },
    create() { assert.fail("no create fallback"); },
  } };
  for (const id of ["", " ", " saved-session"]) {
    assert.throws(() => attachEveSessionForReplay(client, id), /existing session ID/);
  }
  assert.equal(attached, 0);
  const stream = attachEveSessionForReplay(client, "saved-session").stream({ startIndex: 0, signal: new AbortController().signal });
  await assert.rejects(stream[Symbol.asyncIterator]().next(), error => error === failure);
  assert.equal(attached, 1);
});
