import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyResendHttpFailure } from "./email";

describe("Resend submission failure classification", () => {
  it("distinguishes definitive rejection from unknown acceptance", () => {
    assert.equal(classifyResendHttpFailure(400), "rejected");
    assert.equal(classifyResendHttpFailure(401), "rejected");
    assert.equal(classifyResendHttpFailure(408), "unknown");
    assert.equal(classifyResendHttpFailure(429), "unknown");
    assert.equal(classifyResendHttpFailure(500), "unknown");
  });
});
