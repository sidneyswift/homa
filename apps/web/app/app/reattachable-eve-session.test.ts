import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultMessageReducer,
  EveAgentStore,
  type ClientSession,
  type SessionState,
} from "eve/client";

import { createReattachableEveSession } from "./reattachable-eve-session";

function fakeSession(
  state: SessionState,
  calls: string[],
): ClientSession {
  return {
    get state() {
      return state;
    },
    send() {
      calls.push(state.sessionId ?? "fresh");
      return Promise.reject(new Error("send is not exercised past delegation"));
    },
  } as unknown as ClientSession;
}

describe("reattachable Eve session", () => {
  it("keeps the store-facing object stable while adopting a recovered cursor", async () => {
    const calls: string[] = [];
    const initial = { sessionId: "session-before", streamIndex: 4 };
    const recovered = { sessionId: "session-recovered", streamIndex: 19 };
    const wrapper = createReattachableEveSession({
      createSession: (state = { streamIndex: 0 }) => fakeSession(state, calls),
      initialSession: initial,
    });
    const storeFacingSession = wrapper.session;

    assert.deepEqual(storeFacingSession.state, initial);
    wrapper.adopt(recovered);

    assert.equal(wrapper.session, storeFacingSession);
    assert.deepEqual(storeFacingSession.state, recovered);
    await assert.rejects(() => storeFacingSession.send("hello"));
    assert.deepEqual(calls, ["session-recovered"]);
  });

  it("makes EveAgentStore.reset reuse the newly adopted cursor", () => {
    const wrapper = createReattachableEveSession({
      createSession: (state = { streamIndex: 0 }) => fakeSession(state, []),
      initialSession: { sessionId: "session-before", streamIndex: 4 },
    });
    const store = new EveAgentStore({
      reducer: defaultMessageReducer(),
      session: wrapper.session,
    });

    wrapper.adopt({ sessionId: "session-recovered", streamIndex: 19 });
    store.reset();

    assert.deepEqual(store.snapshot.session, {
      sessionId: "session-recovered",
      streamIndex: 19,
    });
  });
});
