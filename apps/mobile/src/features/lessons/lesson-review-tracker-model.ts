export const MAX_TRACKED_LESSON_REVIEWS = 8;

export interface TrackedLessonReview {
  lessonId: string;
  childId: string;
  childName: string;
  purpose: string;
  savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function trackedLessonReview(value: unknown): TrackedLessonReview | null {
  if (!isRecord(value)) return null;
  if (!isUuid(value.lessonId) || !isUuid(value.childId)) return null;
  if (
    typeof value.childName !== "string"
    || typeof value.purpose !== "string"
    || typeof value.savedAt !== "string"
  ) {
    return null;
  }
  const childName = value.childName.trim();
  const purpose = value.purpose.trim();
  if (
    childName.length === 0
    || childName.length > 80
    || purpose.length < 2
    || purpose.length > 120
    || !Number.isFinite(Date.parse(value.savedAt))
  ) {
    return null;
  }
  return {
    lessonId: value.lessonId,
    childId: value.childId,
    childName,
    purpose,
    savedAt: value.savedAt,
  };
}

/**
 * Local data is only a recovery pointer. The authenticated lesson status
 * endpoint remains authoritative for ownership, retryability, and content.
 */
export function parseTrackedLessonReviews(value: unknown): TrackedLessonReview[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, TrackedLessonReview>();
  for (const candidate of value) {
    const parsed = trackedLessonReview(candidate);
    if (!parsed || unique.has(parsed.lessonId)) continue;
    unique.set(parsed.lessonId, parsed);
  }
  return [...unique.values()]
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
    .slice(0, MAX_TRACKED_LESSON_REVIEWS);
}

export function upsertTrackedLessonReview(
  current: readonly TrackedLessonReview[],
  lesson: TrackedLessonReview,
): TrackedLessonReview[] {
  return parseTrackedLessonReviews([
    lesson,
    ...current.filter((candidate) => candidate.lessonId !== lesson.lessonId),
  ]);
}

export function removeTrackedLessonReview(
  current: readonly TrackedLessonReview[],
  lessonId: string,
): TrackedLessonReview[] {
  return current.filter((candidate) => candidate.lessonId !== lessonId);
}
