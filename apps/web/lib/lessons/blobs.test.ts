import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isFamilyLessonUrl, lessonBlobPrefix } from "./blobs";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_ID = "22222222-2222-4222-8222-222222222222";

describe("private lesson blob boundary", () => {
  it("accepts only the authenticated family's private lesson path", () => {
    const path = lessonBlobPrefix(FAMILY_ID, LESSON_ID);
    assert.equal(
      isFamilyLessonUrl(
        `https://store.private.blob.vercel-storage.com/${path}segment-1.m4a`,
        FAMILY_ID,
        LESSON_ID,
      ),
      true,
    );
    assert.equal(
      isFamilyLessonUrl(
        `https://store.private.blob.vercel-storage.com/${path}segment-1.m4a`,
        "33333333-3333-4333-8333-333333333333",
      ),
      false,
    );
  });

  it("rejects arbitrary hosts even when the path looks right", () => {
    assert.equal(
      isFamilyLessonUrl(
        `https://example.com/${lessonBlobPrefix(FAMILY_ID, LESSON_ID)}segment.m4a`,
        FAMILY_ID,
      ),
      false,
    );
  });
});
