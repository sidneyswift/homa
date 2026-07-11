import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyTelnyxHttpFailure, submitHomaSms } from "./telnyx-api";

function restoreEnvironmentValue(
  name: string,
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe("Telnyx HTTP failure classification", () => {
  it("treats client rejections as definitive", () => {
    assert.equal(classifyTelnyxHttpFailure(400), "rejected");
    assert.equal(classifyTelnyxHttpFailure(401), "rejected");
    assert.equal(classifyTelnyxHttpFailure(422), "rejected");
  });

  it("preserves uncertainty for timeout, throttling, and server failures", () => {
    assert.equal(classifyTelnyxHttpFailure(408), "unknown");
    assert.equal(classifyTelnyxHttpFailure(429), "unknown");
    assert.equal(classifyTelnyxHttpFailure(500), "unknown");
    assert.equal(classifyTelnyxHttpFailure(503), "unknown");
  });
});

describe("Telnyx SMS request cancellation", () => {
  it("forwards the caller's abort signal to fetch", async (t) => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = process.env.TELNYX_SMS_ENABLED;
    const originalApiKey = process.env.TELNYX_API_KEY;
    const originalFromNumber = process.env.TELNYX_FROM_NUMBER;
    const controller = new AbortController();

    t.after(() => {
      globalThis.fetch = originalFetch;
      restoreEnvironmentValue("TELNYX_SMS_ENABLED", originalEnabled);
      restoreEnvironmentValue("TELNYX_API_KEY", originalApiKey);
      restoreEnvironmentValue("TELNYX_FROM_NUMBER", originalFromNumber);
    });

    process.env.TELNYX_SMS_ENABLED = "true";
    process.env.TELNYX_API_KEY = "test-key";
    process.env.TELNYX_FROM_NUMBER = "+15555550199";
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.signal, controller.signal);
      return Response.json({ data: { id: "message-1" } });
    };

    const result = await submitHomaSms(
      "+15555550100",
      "Test message",
      undefined,
      controller.signal,
    );

    assert.deepEqual(result, {
      status: "submitted",
      messageId: "message-1",
    });
  });
});
