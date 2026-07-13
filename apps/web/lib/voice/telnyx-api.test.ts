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

describe("Telnyx SMS oversized-message handling", () => {
  function stubSmsEnvironment(t: { after(fn: () => void): void }): void {
    const originalFetch = globalThis.fetch;
    const originalEnabled = process.env.TELNYX_SMS_ENABLED;
    const originalApiKey = process.env.TELNYX_API_KEY;
    const originalFromNumber = process.env.TELNYX_FROM_NUMBER;
    t.after(() => {
      globalThis.fetch = originalFetch;
      restoreEnvironmentValue("TELNYX_SMS_ENABLED", originalEnabled);
      restoreEnvironmentValue("TELNYX_API_KEY", originalApiKey);
      restoreEnvironmentValue("TELNYX_FROM_NUMBER", originalFromNumber);
    });
    process.env.TELNYX_SMS_ENABLED = "true";
    process.env.TELNYX_API_KEY = "test-key";
    process.env.TELNYX_FROM_NUMBER = "+15555550199";
  }

  // The 2026-07-13 morning-brief shape: one emoji forces UCS-2, so a
  // 755-character text is 12 segments and Telnyx would reject it.
  const oversizedEmojiText = `\u{1F52C}${"a".repeat(754)}`;

  it("refuses a text over the segment cap without calling Telnyx", async (t) => {
    stubSmsEnvironment(t);
    globalThis.fetch = async () => {
      throw new Error("fetch must not be called for a doomed send");
    };

    const result = await submitHomaSms("+15555550100", oversizedEmojiText);

    assert.equal(result.status, "rejected");
    assert.ok(
      result.status === "rejected" &&
        result.reason?.includes("carrier size limit"),
    );
  });

  it("still sends oversized text when media rides along (MMS sizes by media)", async (t) => {
    stubSmsEnvironment(t);
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ data: { id: "message-2" } });
    };

    const result = await submitHomaSms("+15555550100", oversizedEmojiText, [
      "https://example.com/worksheet.pdf",
    ]);

    assert.equal(fetchCalls, 1);
    assert.deepEqual(result, { status: "submitted", messageId: "message-2" });
  });

  it("surfaces Telnyx's own error code when a send is rejected", async (t) => {
    stubSmsEnvironment(t);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [{ code: "40302", title: "Message too large" }],
        }),
        { status: 400 },
      );

    const result = await submitHomaSms("+15555550100", "Short message");

    assert.equal(result.status, "rejected");
    assert.ok(
      result.status === "rejected" &&
        result.reason === "Telnyx rejected the send: 40302 Message too large",
    );
  });
});
