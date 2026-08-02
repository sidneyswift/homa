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
});

