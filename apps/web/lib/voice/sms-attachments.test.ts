import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Attachment } from "chat";

import { normalizeSmsAttachments } from "./sms-attachments";

/**
 * The CG-05 routing gap (2026-07-25): a voice note that arrives typed
 * "file" with an audio MIME (or a generic MIME plus an audio filename
 * extension) must take the same STT transcript lane as an "audio"-typed
 * attachment, instead of dropping as an unreadable attachment. These
 * tests stub fetch at the two seams the lane crosses: the Telnyx media
 * download and the Telnyx STT upload.
 */

const MEDIA_URL = "https://api.telnyx.com/v2/media/test-media-id";
const STT_URL = "https://api.telnyx.com/v2/ai/audio/transcriptions";

const VOICE_NOTE_FAILURE_NOTE =
  "[A voice note was attached but could not be transcribed.]";

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

interface SttStubOptions {
  /** Transcript the STT endpoint returns; null answers HTTP 400. */
  transcript: string | null;
}

interface SttStubRecord {
  /** Filename of the last STT upload, for extension-allowlist checks. */
  uploadedFileName: string | null;
  mediaDownloads: number;
}

/** Stubs fetch for the whole transcript lane: the media URL serves
 *  bytes, the STT endpoint answers with the given transcript. */
function stubTranscriptLane(
  t: { after(fn: () => void): void },
  options: SttStubOptions,
): SttStubRecord {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TELNYX_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue("TELNYX_API_KEY", originalApiKey);
  });
  process.env.TELNYX_API_KEY = "test-key";

  const record: SttStubRecord = { uploadedFileName: null, mediaDownloads: 0 };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === STT_URL) {
      const file = (init?.body as FormData).get("file");
      record.uploadedFileName = file instanceof File ? file.name : null;
      if (options.transcript === null) {
        return new Response("{}", { status: 400 });
      }
      return Response.json({ text: options.transcript });
    }
    record.mediaDownloads += 1;
    return new Response(new Uint8Array([1, 2, 3, 4]).buffer);
  };
  return record;
}

describe("file-typed voice notes (the CG-05 routing gap)", () => {
  it("transcribes a file-typed audio/amr attachment through the STT lane", async (t) => {
    const record = stubTranscriptLane(t, {
      transcript: "We finished the math lesson this morning.",
    });

    const attachment: Attachment = {
      type: "file",
      mimeType: "audio/amr",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "audio", mediaType: "audio/amr", outcome: "transcribed" },
    ]);
    assert.deepEqual(normalized.blocks, [
      "[Voice note, transcribed]: We finished the math lesson this morning.",
    ]);
    assert.equal(normalized.hasContent, true);
    assert.equal(record.mediaDownloads, 1);
    // AMR must ride transcribe.ts's extension law: uploaded as .mp3
    // because the STT allowlist rejects .amr by filename.
    assert.equal(record.uploadedFileName, "voice-note.mp3");
  });

  it("routes a generic-MIME file by its audio filename extension", async (t) => {
    const record = stubTranscriptLane(t, { transcript: "Reading practice." });

    const attachment: Attachment = {
      type: "file",
      mimeType: "application/octet-stream",
      name: "Voice Memo.3gp",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "audio", mediaType: "audio/3gpp", outcome: "transcribed" },
    ]);
    // 3gpp maps onto the allowlisted mp4 neighbor, same as audio-typed.
    assert.equal(record.uploadedFileName, "voice-note.mp4");
  });

  it("falls back to the media URL's extension, ignoring query strings", async (t) => {
    stubTranscriptLane(t, { transcript: "Spelling words." });

    const attachment: Attachment = {
      type: "file",
      mimeType: "application/octet-stream",
      url: `${MEDIA_URL}/clip.m4a?signature=abc123`,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "audio", mediaType: "audio/m4a", outcome: "transcribed" },
    ]);
  });

  it("fails soft with the voice-note failure note when STT rejects the clip", async (t) => {
    stubTranscriptLane(t, { transcript: null });

    const attachment: Attachment = {
      type: "file",
      mimeType: "audio/amr",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "audio", mediaType: "audio/amr", outcome: "failed" },
    ]);
    assert.deepEqual(normalized.blocks, [VOICE_NOTE_FAILURE_NOTE]);
    assert.equal(normalized.hasContent, false);
  });

  it("fails soft as audio when a file-typed voice note has no URL", async (t) => {
    stubTranscriptLane(t, { transcript: "never reached" });

    const attachment: Attachment = { type: "file", mimeType: "audio/amr" };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "audio", mediaType: "audio/amr", outcome: "failed" },
    ]);
    assert.deepEqual(normalized.blocks, [VOICE_NOTE_FAILURE_NOTE]);
  });

  it("never steals a document lane on filename alone", async (t) => {
    const record = stubTranscriptLane(t, { transcript: "never reached" });

    const attachment: Attachment = {
      type: "file",
      mimeType: "application/pdf",
      name: "voice.mp3",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      {
        kind: "document",
        mediaType: "application/pdf",
        outcome: "model_native",
      },
    ]);
    assert.equal(record.uploadedFileName, null);
  });

  it("leaves video MIMEs out of scope in the file lane", async (t) => {
    const record = stubTranscriptLane(t, { transcript: "never reached" });

    const attachment: Attachment = {
      type: "file",
      mimeType: "video/mp4",
      name: "clip.3gp",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "other", mediaType: "video/mp4", outcome: "failed" },
    ]);
    assert.equal(record.uploadedFileName, null);
  });

  it("keeps a genuinely unknown file on the failure-note lane", async (t) => {
    stubTranscriptLane(t, { transcript: "never reached" });

    const attachment: Attachment = {
      type: "file",
      mimeType: "application/octet-stream",
      name: "archive.zip",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      {
        kind: "other",
        mediaType: "application/octet-stream",
        outcome: "failed",
      },
    ]);
    assert.deepEqual(normalized.blocks, [
      "[An attachment of an unsupported type could not be read.]",
    ]);
  });

  it("still transcribes an audio-typed attachment the original way", async (t) => {
    const record = stubTranscriptLane(t, { transcript: "Original lane." });

    const attachment: Attachment = {
      type: "audio",
      mimeType: "audio/amr",
      url: MEDIA_URL,
    };
    const normalized = await normalizeSmsAttachments([attachment]);

    assert.deepEqual(normalized.results, [
      { kind: "audio", mediaType: "audio/amr", outcome: "transcribed" },
    ]);
    assert.equal(record.uploadedFileName, "voice-note.mp3");
  });
});
