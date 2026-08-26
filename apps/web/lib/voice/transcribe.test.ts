import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transcribeAudio } from "./transcribe";

/**
 * gh#1012 (2026-08-26): Carolyng hit three consecutive Telnyx STT 500s
 * with no automatic recovery, each surfacing as "Homa couldn't make
 * that out" even though nothing about her audio was the problem. These
 * cover the retry this fix added: retry once on a transient failure
 * (5xx, or a thrown network error), never on a 4xx or a clean empty
 * transcript, since resending identical bytes would not change either.
 */

const STT_URL = "https://api.telnyx.com/v2/ai/audio/transcriptions";

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function stubFetch(
  t: { after(fn: () => void): void },
  handler: (callIndex: number) => Response | Promise<Response>,
): { calls: number } {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TELNYX_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue("TELNYX_API_KEY", originalApiKey);
  });
  process.env.TELNYX_API_KEY = "test-key";

  const record = { calls: 0 };
  globalThis.fetch = async (input) => {
    assert.equal(String(input), STT_URL);
    const callIndex = record.calls;
    record.calls += 1;
    return handler(callIndex);
  };
  return record;
}

describe("transcribeAudio retry (gh#1012)", () => {
  it("retries once on HTTP 500 and returns the transcript on success", async (t) => {
    const record = stubFetch(t, (callIndex) =>
      callIndex === 0
        ? new Response("{}", { status: 500 })
        : Response.json({ text: "We finished math today." }),
    );

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, "We finished math today.");
    assert.equal(record.calls, 2);
  });

  it("gives up after two consecutive HTTP 500s", async (t) => {
    const record = stubFetch(t, () => new Response("{}", { status: 500 }));

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, null);
    assert.equal(record.calls, 2);
  });

  it("does not retry a 4xx (bad request)", async (t) => {
    const record = stubFetch(t, () => new Response("{}", { status: 400 }));

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, null);
    assert.equal(record.calls, 1);
  });

  it("does not retry a clean empty transcript", async (t) => {
    const record = stubFetch(t, () => Response.json({ text: "" }));

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, null);
    assert.equal(record.calls, 1);
  });

  it("retries once on a thrown network error", async (t) => {
    const record = stubFetch(t, (callIndex) => {
      if (callIndex === 0) throw new Error("fetch failed");
      return Response.json({ text: "Recovered after the blip." });
    });

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, "Recovered after the blip.");
    assert.equal(record.calls, 2);
  });
});
