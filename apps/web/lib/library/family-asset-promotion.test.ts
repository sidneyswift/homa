import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attachmentOriginalName } from "./family-asset-promotion";

describe("family chat attachment filename promotion", () => {
  it("removes Vercel's storage suffix from an image filename", () => {
    assert.equal(
      attachmentOriginalName({
        caption: null,
        kind: "image",
        url: "https://assets.public.blob.vercel-storage.com/families/family-id/chat/IMG_6203-7T4Cg8XgYfJhL3SR8IExfYK44q7AbC.jpg",
      }),
      "IMG_6203.jpg",
    );
  });

  it("keeps an explicit document filename instead of deriving a Blob key", () => {
    assert.equal(
      attachmentOriginalName({
        caption: "First grade phonics.pdf",
        kind: "file",
        url: "https://assets.public.blob.vercel-storage.com/random-key.pdf",
      }),
      "First grade phonics.pdf",
    );
  });
});
