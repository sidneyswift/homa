import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVE_OBJECT_KINDS,
  activeObjectKey,
  parseActiveObjectReference,
} from "./active-object";

const OBJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("active object references", () => {
  it("keeps the complete closed object-kind boundary", () => {
    assert.deepEqual(ACTIVE_OBJECT_KINDS, [
      "material",
      "plan",
      "recording",
      "photo_proposal",
      "state_packet",
      "calendar_preview",
      "task",
    ]);
  });

  it("accepts a bounded typed pointer and derives a stable client key", () => {
    const reference = parseActiveObjectReference({
      kind: "material",
      objectId: OBJECT_ID,
      version: "2026-08-01T12:00:00.000Z",
    });
    assert.ok(reference);
    assert.equal(
      activeObjectKey(reference),
      `material:${OBJECT_ID}:2026-08-01T12:00:00.000Z`,
    );
  });

  it("rejects unknown kinds, malformed ids, and unbounded versions", () => {
    assert.equal(
      parseActiveObjectReference({ kind: "family", objectId: OBJECT_ID, version: "1" }),
      null,
    );
    assert.equal(
      parseActiveObjectReference({ kind: "material", objectId: "not-an-id", version: "1" }),
      null,
    );
    assert.equal(
      parseActiveObjectReference({ kind: "material", objectId: OBJECT_ID, version: "x".repeat(161) }),
      null,
    );
  });
});
