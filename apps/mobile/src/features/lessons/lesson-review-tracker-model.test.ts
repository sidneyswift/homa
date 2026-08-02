import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_TRACKED_LESSON_REVIEWS,
  parseTrackedLessonReviews,
  removeTrackedLessonReview,
  upsertTrackedLessonReview,
} from "./lesson-review-tracker-model";

const CHILD_ID = "11111111-1111-4111-8111-111111111111";

function lesson(index: number, savedAt = `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`) {
  return {
    lessonId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    childId: CHILD_ID,
    childName: "Maya",
    purpose: "reading lesson",
    savedAt,
  };
}

describe("native lesson review tracker model", () => {
  it("accepts only bounded recovery metadata and newest unique lessons", () => {
    const parsed = parseTrackedLessonReviews([
      lesson(1, "2026-08-01T12:00:00.000Z"),
      lesson(2, "2026-08-02T12:00:00.000Z"),
      lesson(1, "2026-08-03T12:00:00.000Z"),
      { ...lesson(3), lessonId: "not-a-uuid" },
      { ...lesson(4), purpose: " " },
      null,
    ]);
    assert.deepEqual(parsed.map((item) => item.lessonId), [
      lesson(2).lessonId,
      lesson(1).lessonId,
    ]);
  });

  it("caps retained pointers without storing recording data", () => {
    const parsed = parseTrackedLessonReviews(
      Array.from({ length: MAX_TRACKED_LESSON_REVIEWS + 3 }, (_, index) => lesson(index)),
    );
    assert.equal(parsed.length, MAX_TRACKED_LESSON_REVIEWS);
    assert.deepEqual(Object.keys(parsed[0]).sort(), [
      "childId",
      "childName",
      "lessonId",
      "purpose",
      "savedAt",
    ]);
  });

  it("upserts and dismisses by the durable lesson id", () => {
    const first = lesson(1, "2026-08-01T12:00:00.000Z");
    const updated = { ...first, purpose: "phonics lesson", savedAt: "2026-08-02T12:00:00.000Z" };
    assert.deepEqual(upsertTrackedLessonReview([first], updated), [updated]);
    assert.deepEqual(removeTrackedLessonReview([updated, lesson(2)], updated.lessonId), [lesson(2)]);
  });
});
