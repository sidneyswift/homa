import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sliceFamilyCurriculumDocument } from "./family-curriculum-source";

describe("sliceFamilyCurriculumDocument", () => {
  it("returns bounded, cursor-addressable source segments", () => {
    const page = sliceFamilyCurriculumDocument(
      {
        ok: true,
        segmentKind: "page",
        segments: Array.from({ length: 10 }, (_, index) => ({
          ordinal: index + 1,
          locator: `Page ${index + 1}`,
          text: `words ${index + 1}`,
        })),
        totalSegments: 10,
        truncated: false,
      },
      3,
    );
    assert.deepEqual(
      page.segments.map((segment) => segment.ordinal),
      [3, 4, 5, 6, 7, 8, 9, 10],
    );
    assert.equal(page.nextCursor, null);
  });

  it("reports the next source ordinal when more segments remain", () => {
    const page = sliceFamilyCurriculumDocument(
      {
        ok: true,
        segmentKind: "page",
        segments: Array.from({ length: 12 }, (_, index) => ({
          ordinal: index + 1,
          locator: `Page ${index + 1}`,
          text: "words",
        })),
        totalSegments: 12,
        truncated: false,
      },
      1,
    );
    assert.equal(page.segments.length, 8);
    assert.equal(page.nextCursor, 9);
  });

  it("never skips the unread tail of a segment to advance the cursor", () => {
    const page = sliceFamilyCurriculumDocument(
      {
        ok: true,
        segmentKind: "page",
        segments: [
          { ordinal: 1, locator: "Page 1", text: "a".repeat(20_000) },
          { ordinal: 2, locator: "Page 2", text: "b".repeat(20_000) },
          { ordinal: 3, locator: "Page 3", text: "last page" },
        ],
        totalSegments: 3,
        truncated: false,
      },
      1,
    );
    assert.deepEqual(page.segments.map((segment) => segment.ordinal), [1]);
    assert.equal(page.segments[0]?.text.length, 20_000);
    assert.equal(page.nextCursor, 2);
    assert.equal(page.truncated, false);
  });

  it("marks one overlarge source segment as visibly truncated", () => {
    const page = sliceFamilyCurriculumDocument(
      {
        ok: true,
        segmentKind: "page",
        segments: [
          { ordinal: 1, locator: "Page 1", text: "dense".repeat(8_000) },
        ],
        totalSegments: 1,
        truncated: false,
      },
      1,
    );
    assert.equal(page.segments[0]?.text.length, 32_000);
    assert.equal(page.nextCursor, null);
    assert.equal(page.truncated, true);
  });
});
