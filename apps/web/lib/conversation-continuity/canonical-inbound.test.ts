import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalInboundAuthAttributes,
} from "./canonical-inbound";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";

describe("canonical inbound auth attributes", () => {
  it("stamps bounded canonical text and its durable message UUID", () => {
    const text = `  Maya read a book. ${"x".repeat(9_000)}  `;
    const attributes = canonicalInboundAuthAttributes({
      text,
      messageId: MESSAGE_ID,
    });

    assert.equal(attributes.canonicalInboundMessageId, MESSAGE_ID);
    assert.equal(
      Array.from(attributes.canonicalInboundText).length,
      8_000,
    );
    assert.match(
      attributes.canonicalInboundText,
      /^Maya read a book\./u,
    );
  });

  it("rejects a non-UUID canonical message identifier", () => {
    assert.throws(
      () =>
        canonicalInboundAuthAttributes({
          text: "Maya read a book.",
          messageId: "provider-message-id",
        }),
      /UUID/u,
    );
  });
});
