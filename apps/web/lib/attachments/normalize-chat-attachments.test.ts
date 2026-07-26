import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  chatAttachmentKind,
  normalizeOneChatAttachment,
  type ChatAttachmentInput,
} from "./normalize-chat-attachments";

const PHOTO_URL =
  "https://x1y2.public.blob.vercel-storage.com/families/fam-1/chat/page-abc123.jpg";

/**
 * Regression coverage for BUG-P3-1 / gh#202 (season simulation field
 * study R4, 2026-07-13): web photo attachments built an AI SDK
 * `{ type: "image", image, mediaType }` part, but eve's /eve/v1/session
 * parser (parseMessagePart, eve/dist/src/public/channels/eve.js) only
 * accepts "text" and "file" parts and 400s on anything else, so every
 * photo-plus-caption turn died silently. The fix (commit 6c6c3807,
 * 2026-07-14) makes processImage emit a `file` part with an image
 * mediaType instead. These tests pin that shape so a future edit can't
 * quietly reintroduce the `image` part type.
 */

let originalCaptionsFlag: string | undefined;

beforeEach(() => {
  originalCaptionsFlag = process.env.HOMA_MEDIA_CAPTIONS;
  // No model credentials in the test environment; captions are
  // incidental to this bug, so skip the network call entirely.
  process.env.HOMA_MEDIA_CAPTIONS = "off";
});

afterEach(() => {
  if (originalCaptionsFlag === undefined) delete process.env.HOMA_MEDIA_CAPTIONS;
  else process.env.HOMA_MEDIA_CAPTIONS = originalCaptionsFlag;
});

describe("web photo attachments (BUG-P3-1 / gh#202)", () => {
  it("never builds an AI SDK 'image' part, only a 'file' part", async () => {
    const input: ChatAttachmentInput = {
      url: PHOTO_URL,
      mediaType: "image/jpeg",
      name: "page-abc123.jpg",
    };
    const result = await normalizeOneChatAttachment(input, "fam-1");

    assert.equal(result.kind, "image");
    assert.equal(result.outcome, "model_native");
    assert.ok(result.part, "expected a model-facing part for a supported image");
    // The regression: this must be "file", never "image". eve's session
    // route rejects any type other than "text" or "file" with
    // `Unsupported message part type "..."`.
    assert.equal(result.part?.type, "file");
    assert.notEqual((result.part as { type: string }).type, "image");
  });

  it("carries the blob URL, mediaType, and filename an eve file part requires", async () => {
    const input: ChatAttachmentInput = {
      url: PHOTO_URL,
      mediaType: "image/png",
      name: "worksheet.png",
    };
    const result = await normalizeOneChatAttachment(input, "fam-1");

    assert.ok(result.part);
    const part = result.part as {
      type: string;
      data: string;
      mediaType: string;
      filename?: string;
    };
    // eve's parser requires a non-empty string 'mediaType' and a string
    // 'data' (base64, data URL, or URL) on every file part.
    assert.equal(typeof part.data, "string");
    assert.equal(part.data, input.url);
    assert.equal(part.mediaType, "image/png");
    assert.equal(part.filename, "worksheet.png");
  });

  it("omits filename rather than sending an empty one when no name was given", async () => {
    const input: ChatAttachmentInput = {
      url: PHOTO_URL,
      mediaType: "image/webp",
      name: null,
    };
    const result = await normalizeOneChatAttachment(input, "fam-1");

    assert.ok(result.part);
    assert.equal("filename" in (result.part as object), false);
  });

  it("builds a 'file' part (never 'image') for every supported image type", async () => {
    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    for (const mediaType of supportedTypes) {
      const result = await normalizeOneChatAttachment(
        { url: PHOTO_URL, mediaType, name: null },
        "fam-1",
      );
      assert.equal(chatAttachmentKind(mediaType), "image");
      assert.equal(
        result.part?.type,
        "file",
        `${mediaType} must ride to eve as a file part, not an image part`,
      );
    }
  });

  it("still fails soft (no part) for an image type the model can't read", async () => {
    const result = await normalizeOneChatAttachment(
      { url: PHOTO_URL, mediaType: "image/bmp", name: "scan.bmp" },
      "fam-1",
    );
    assert.equal(result.outcome, "failed");
    assert.equal(result.part, null);
  });
});
