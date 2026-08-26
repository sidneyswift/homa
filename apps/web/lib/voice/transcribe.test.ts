import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transcribeAudio } from "./transcribe";

/**
 * gh#1012 (2026-08-26): Carolyng hit three consecutive Telnyx STT 500s
 * with no automatic recovery, each surfacing as "Homa couldn't make
 * that out" even though nothing about her audio was the problem. Direct
 * probes against the live endpoint that day showed openai/whisper-
 * large-v3-turbo failing on every input regardless of audio content,
 * while distil-whisper/distil-large-v2 succeeded on the exact same
 * bytes: the primary model was the defect, not the audio pipeline.
 * These cover the fix: retry the primary model once on a transient
 * failure (5xx, or a thrown network error), and only fall back to the
 * secondary model once the primary is fully exhausted. Never retry or
 * fall back on a 4xx or a clean empty transcript, since resending
 * identical bytes would not change either outcome.
 */

const STT_URL = "https://api.telnyx.com/v2/ai/audio/transcriptions";
const PRIMARY_MODEL = "openai/whisper-large-v3-turbo";
const FALLBACK_MODEL = "distil-whisper/distil-large-v2";

function restoreEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function stubFetch(
  t: { after(fn: () => void): void },
  handler: (model: string, callIndex: number) => Response | Promise<Response>,
): { calls: Array<{ model: string }> } {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TELNYX_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue("TELNYX_API_KEY", originalApiKey);
  });
  process.env.TELNYX_API_KEY = "test-key";

  const record: { calls: Array<{ model: string }> } = { calls: [] };
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), STT_URL);
    const model = String((init?.body as FormData).get("model"));
    const callIndex = record.calls.length;
    record.calls.push({ model });
    return handler(model, callIndex);
  };
  return record;
}

describe("transcribeAudio retry and fallback (gh#1012)", () => {
  it("retries the primary model once on HTTP 500 and returns the transcript on success", async (t) => {
    const record = stubFetch(t, (_model, callIndex) =>
      callIndex === 0
        ? new Response("{}", { status: 500 })
        : Response.json({ text: "We finished math today." }),
    );

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, "We finished math today.");
    assert.deepEqual(
      record.calls.map((c) => c.model),
      [PRIMARY_MODEL, PRIMARY_MODEL],
    );
  });

  it("falls back to the secondary model once the primary is exhausted, and returns its transcript", async (t) => {
    const record = stubFetch(t, (model) =>
      model === PRIMARY_MODEL
        ? new Response("{}", { status: 500 })
        : Response.json({ text: "Recovered on the fallback model." }),
    );

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, "Recovered on the fallback model.");
    assert.deepEqual(
      record.calls.map((c) => c.model),
      [PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL],
    );
  });

  it("gives up when both the primary and fallback models fail", async (t) => {
    const record = stubFetch(t, () => new Response("{}", { status: 500 }));

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, null);
    assert.deepEqual(
      record.calls.map((c) => c.model),
      [PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL],
    );
  });

  it("does not retry or fall back on a 4xx (bad request)", async (t) => {
    const record = stubFetch(t, () => new Response("{}", { status: 400 }));

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, null);
    assert.deepEqual(
      record.calls.map((c) => c.model),
      [PRIMARY_MODEL],
    );
  });

  it("does not retry or fall back on a clean empty transcript", async (t) => {
    const record = stubFetch(t, () => Response.json({ text: "" }));

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, null);
    assert.deepEqual(
      record.calls.map((c) => c.model),
      [PRIMARY_MODEL],
    );
  });

  it("retries the primary model once on a thrown network error", async (t) => {
    const record = stubFetch(t, (_model, callIndex) => {
      if (callIndex === 0) throw new Error("fetch failed");
      return Response.json({ text: "Recovered after the blip." });
    });

    const transcript = await transcribeAudio(new Uint8Array([1, 2, 3]).buffer, "audio/webm");

    assert.equal(transcript, "Recovered after the blip.");
    assert.deepEqual(
      record.calls.map((c) => c.model),
      [PRIMARY_MODEL, PRIMARY_MODEL],
    );
  });
});
