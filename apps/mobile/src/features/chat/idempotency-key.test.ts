import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createIdempotencyKey } from "./idempotency-key";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe("mobile checklist idempotency keys", () => {
  it("produces a UUID v4 with the required version and variant bits", () => {
    assert.equal(
      createIdempotencyKey(() => 0),
      "00000000-0000-4000-8000-000000000000",
    );
    assert.match(createIdempotencyKey(() => 0.99), UUID_V4_PATTERN);
  });

  it("uses fresh random input for each key", () => {
    let nibble = 0;
    const nextNibble = () => {
      nibble = (nibble + 1) % 16;
      return nibble / 16;
    };

    const first = createIdempotencyKey(nextNibble);
    const second = createIdempotencyKey(nextNibble);

    assert.match(first, UUID_V4_PATTERN);
    assert.match(second, UUID_V4_PATTERN);
    assert.notEqual(first, second);
  });
});
