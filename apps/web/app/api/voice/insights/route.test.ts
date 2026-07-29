import assert from "node:assert/strict";
import test from "node:test";

import { readConversationId } from "./route";

// Telnyx nests the conversation id differently across payload versions, and
// this route believes exactly one thing from the body: which conversation
// ended. Reading the wrong field means the call is never synced and #171
// quietly comes back, with the hourly cron masking it.
test("reads a top-level conversation_id", () => {
  assert.equal(readConversationId({ conversation_id: "abc" }), "abc");
});

test("reads data.conversation_id", () => {
  assert.equal(readConversationId({ data: { conversation_id: "abc" } }), "abc");
});

test("reads data.id", () => {
  assert.equal(readConversationId({ data: { id: "abc" } }), "abc");
});

test("reads payload.conversation_id", () => {
  assert.equal(readConversationId({ payload: { conversation_id: "abc" } }), "abc");
});

test("prefers the most specific field when several are present", () => {
  assert.equal(
    readConversationId({
      conversation_id: "top",
      data: { conversation_id: "nested" },
    }),
    "top",
  );
});

test("an empty string is not an id", () => {
  assert.equal(readConversationId({ conversation_id: "", data: { id: "abc" } }), "abc");
});

test("a payload with no id at all returns null rather than guessing", () => {
  assert.equal(readConversationId({ event_type: "conversation.insights.completed" }), null);
  assert.equal(readConversationId({}), null);
});
