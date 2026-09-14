import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Attachment } from "chat";

import { loadSharp } from "../sharp-loader";
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

it("loads image processing on first BMP conversion and preserves the pixel", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TELNYX_API_KEY;
  process.env.TELNYX_API_KEY = "test-key";
  t.after(() => {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue("TELNYX_API_KEY", originalApiKey);
  });
  // One red pixel in an uncompressed 24-bit BMP, including row padding.
  const bmp = Buffer.alloc(58);
  bmp.write("BM");
  bmp.writeUInt32LE(58, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(1, 18);
  bmp.writeInt32LE(1, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(4, 34);
  bmp[56] = 255;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), MEDIA_URL);
    return new Response(new Uint8Array(bmp));
  };
  const result = await normalizeSmsAttachments([
    { type: "image", mimeType: "image/bmp", url: MEDIA_URL },
  ]);
  assert.deepEqual(result.results, [
    { kind: "image", mediaType: "image/bmp", outcome: "converted" },
  ]);
  const part = result.mediaParts[0];
  assert.equal(part.type, "image");
  assert.ok(part.type === "image" && Buffer.isBuffer(part.image));
  const sharp = await loadSharp();
  const decoded = await sharp(part.image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, 1);
  assert.equal(decoded.info.height, 1);
  assert.deepEqual([...decoded.data], [255, 0, 0]);
});

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
