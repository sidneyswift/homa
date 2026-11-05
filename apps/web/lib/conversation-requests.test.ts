import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConversationRequestError, validateConversationIntent } from "./conversation-requests";

test("request fingerprint preserves all submitted whitespace and Unicode", () => {
  const id = randomUUID();
  const text = "  Family words 🧡\n".repeat(2000);
  assert.equal(validateConversationIntent(id, text), validateConversationIntent(id, text));
  assert.notEqual(validateConversationIntent(id, text), validateConversationIntent(id, text.trim()));
  assert.notEqual(validateConversationIntent(id, "é"), validateConversationIntent(id, "e\u0301"));
});

test("unrepresentable text is rejected rather than silently changed", () => {
  for (const text of ["", " \n", "a\0b", "a\ud800b", "a\udc00b"]) {
    assert.throws(() => validateConversationIntent(randomUUID(), text),
      (e: unknown) => e instanceof ConversationRequestError && e.code === "invalid");
  }
  assert.throws(() => validateConversationIntent("client-picked-family", "hello"), /invalid/);
});
