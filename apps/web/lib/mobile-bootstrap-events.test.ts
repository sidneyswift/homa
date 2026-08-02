import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mobileBootstrapEventSchema,
} from "./mobile-bootstrap-events";

describe("mobile bootstrap event contract", () => {
  it("accepts only closed content-free fields", () => {
    assert.equal(
      mobileBootstrapEventSchema.safeParse({
        kind: "failed",
        stage: "consent",
        reason: "offline",
      }).success,
      true,
    );
    assert.equal(
      mobileBootstrapEventSchema.safeParse({
        kind: "failed",
        stage: "consent",
        reason: "offline",
        family_id: "00000000-0000-0000-0000-000000000000",
      }).success,
      false,
    );
    assert.equal(
      mobileBootstrapEventSchema.safeParse({
        kind: "attempted",
        stage: "session",
      }).success,
      true,
    );
    assert.equal(
      mobileBootstrapEventSchema.safeParse({
        kind: "attempted",
        stage: "session",
        reason: "unknown",
      }).success,
      false,
    );
  });
});
