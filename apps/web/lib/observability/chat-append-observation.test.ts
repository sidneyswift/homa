import assert from "node:assert/strict";
import test from "node:test";

import { createChatAppendObserver } from "./chat-append-observation";

test("cumulative streams preserve text-block first-append detection", () => {
  const observe = createChatAppendObserver();
  const data = { turnId: "turn", messageDelta: "private text", messageSoFar: "private text" };
  assert.equal(observe("session", { ...data, messageDelta: "", messageSoFar: "" }), undefined);
  assert.equal(observe("session", data), "first_message_appended");
  assert.equal(observe("session", { ...data, messageDelta: " more", messageSoFar: "private text more" }), undefined);
  assert.equal(observe("session", data), "first_message_appended");
});

test("delta-only observations are scoped to both session and turn and skip empty deltas", () => {
  const observe = createChatAppendObserver();
  assert.equal(observe("session", { turnId: "turn", messageDelta: "" }), undefined);
  assert.equal(observe("session", { turnId: "turn", messageDelta: "private text" }), "first_observed_message_append");
  assert.equal(observe("session", { turnId: "turn", messageDelta: " more" }), undefined);
  assert.equal(observe("session-2", { turnId: "turn", messageDelta: "text" }), "first_observed_message_append");
  assert.equal(observe("session", { turnId: "turn-2", messageDelta: "text" }), "first_observed_message_append");
});

test("bounded-cache eviction and worker restarts remain observations, not global first append claims", () => {
  const observe = createChatAppendObserver(1);
  const data = { turnId: "turn", messageDelta: "possibly a later piece" };
  assert.equal(observe("session", data), "first_observed_message_append");
  observe("other-session", data);
  assert.equal(observe("session", data), "first_observed_message_append");
  assert.equal(createChatAppendObserver()("session", data), "first_observed_message_append");
  assert.throws(() => createChatAppendObserver(0), /cache size/);
});
