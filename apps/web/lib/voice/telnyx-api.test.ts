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

  it("delivers a text over the segment cap by transliterating to GSM-7", async (t) => {
    // The 2026-07-16/17 digest failures: refusal is no longer the
    // answer; the emoji is dropped and the message fits again.
    stubSmsEnvironment(t);
    const sentBodies: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      sentBodies.push(body.text);
      return Response.json({ data: { id: `message-${sentBodies.length}` } });
    };

    const result = await submitHomaSms("+15555550100", oversizedEmojiText);

    assert.deepEqual(result, { status: "submitted", messageId: "message-1" });
    assert.deepEqual(sentBodies, ["a".repeat(754)]);
  });

  it("splits a genuinely long GSM-7 text into sequential messages", async (t) => {
    stubSmsEnvironment(t);
    const sentBodies: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      sentBodies.push(body.text);
      return Response.json({ data: { id: `message-${sentBodies.length}` } });
    };

    const longText = Array.from(
      { length: 400 },
      (_, index) => `word${index}`,
    ).join(" ");
    const result = await submitHomaSms("+15555550100", longText);

    assert.deepEqual(result, { status: "submitted", messageId: "message-1" });
    assert.ok(sentBodies.length >= 2 && sentBodies.length <= 3);
    assert.equal(sentBodies.join(" "), longText);
  });

  it("reports unknown when a later part fails after the first submitted", async (t) => {
    stubSmsEnvironment(t);
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return fetchCalls === 1
        ? Response.json({ data: { id: "message-1" } })
        : new Response("{}", { status: 500 });
    };

    const longText = Array.from(
      { length: 400 },
      (_, index) => `word${index}`,
    ).join(" ");
    const result = await submitHomaSms("+15555550100", longText);

    assert.deepEqual(result, { status: "unknown" });
    assert.equal(fetchCalls, 2);
  });

  it("still refuses a pathological payload without calling Telnyx", async (t) => {
    stubSmsEnvironment(t);
    globalThis.fetch = async () => {
      throw new Error("fetch must not be called for a doomed send");
    };

    const result = await submitHomaSms("+15555550100", "a".repeat(60_000));

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
      "https://example.com/worksheet.jpg",
    ]);

    assert.equal(fetchCalls, 1);
    assert.deepEqual(result, { status: "submitted", messageId: "message-2" });
  });

  it("sends a printable PDF as a link instead of oversized MMS media", async (t) => {
    stubSmsEnvironment(t);
    const previewUrl = "https://example.com/counting-practice.jpg";
    const pdfUrl = "https://example.com/counting-practice.pdf";
    let requestBody: unknown;
    globalThis.fetch = async (_input, init) => {
      const body = init?.body;
      assert.equal(typeof body, "string");
      requestBody = JSON.parse(body as string);
      return Response.json({ data: { id: "message-material" } });
    };

    const result = await submitHomaSms(
      "+15555550100",
      "Counting practice is ready to print:",
      [previewUrl, pdfUrl],
    );

    assert.deepEqual(result, {
      status: "submitted",
      messageId: "message-material",
    });
    assert.deepEqual(requestBody, {
      from: "+15555550199",
      to: "+15555550100",
      text: `Counting practice is ready to print: ${pdfUrl}`,
      media_urls: [previewUrl],
    });
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
