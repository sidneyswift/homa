import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyTelnyxHttpFailure,
  permanentTelnyxFailureCode,
  submitHomaSms,
} from "./telnyx-api";

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

describe("permanent destination failure codes", () => {
  it("recognizes a STOP block as a permanent destination failure", () => {
    assert.equal(
      permanentTelnyxFailureCode(
        JSON.stringify({
          errors: [{ code: "40300", title: "Blocked due to STOP message" }],
        }),
      ),
      "40300",
    );
  });

  // 40309 used to be classified here too, on the assumption it meant a
  // dead or invalid number. The 2026-07-23 Mani family case corrected
  // that: it means this messaging profile cannot reach the destination's
  // region, and the number works fine over email. It is no longer
  // "permanent" in the suppress-forever sense; see unsupportedRegion in
  // submitHomaSms below, which drives an email-only switch instead.
  it("treats every other rejection, including an unsupported region, as not a blanket suppression", () => {
    assert.equal(
      permanentTelnyxFailureCode(
        JSON.stringify({
          errors: [{ code: 40309, title: "Invalid destination region" }],
        }),
      ),
      null,
    );
    assert.equal(
      permanentTelnyxFailureCode(
        JSON.stringify({
          errors: [{ code: "40302", title: "Too many message parts" }],
        }),
      ),
      null,
    );
    assert.equal(permanentTelnyxFailureCode("not json"), null);
    assert.equal(permanentTelnyxFailureCode("{}"), null);
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

  it("does not flag an ordinary rejection as an unsupported region", async (t) => {
    stubSmsEnvironment(t);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [{ code: "40302", title: "Message too large" }],
        }),
        { status: 400 },
      );

    const result = await submitHomaSms("+15555550100", "Short message");

    assert.ok(
      result.status === "rejected" && result.unsupportedRegion === undefined,
    );
  });

  // The confirmed 2026-07-23 failure shape: a non-US +1 number (Canada)
  // that our +1 normalization accepts, rejected by the US-only 10DLC
  // profile with 40309. The flag lets the delivery path switch the family
  // to email-only instead of retrying SMS every day.
  it("flags a 40309 rejection as an unsupported destination region", async (t) => {
    stubSmsEnvironment(t);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [{ code: "40309", title: "Invalid destination region" }],
        }),
        { status: 400 },
      );

    const result = await submitHomaSms("+12368462036", "Morning brief");

    assert.equal(result.status, "rejected");
    assert.ok(result.status === "rejected" && result.unsupportedRegion === true);
    assert.ok(
      result.status === "rejected" &&
        result.reason ===
          "Telnyx rejected the send: 40309 Invalid destination region",
    );
  });

  it("flags 40309 even when Telnyx sends the code as a number", async (t) => {
    stubSmsEnvironment(t);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [{ code: 40309, title: "Invalid destination region" }],
        }),
        { status: 400 },
      );

    const result = await submitHomaSms("+12368462036", "Morning brief");

    assert.ok(result.status === "rejected" && result.unsupportedRegion === true);
  });
});
