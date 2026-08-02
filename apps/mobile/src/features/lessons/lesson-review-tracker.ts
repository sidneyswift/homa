import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  parseTrackedLessonReviews,
  removeTrackedLessonReview,
  type TrackedLessonReview,
  upsertTrackedLessonReview,
} from "./lesson-review-tracker-model";

const TRACKER_PREFIX = "homa:lesson-review-tracker:v1";
const mutations = new Map<string, Promise<void>>();

export function lessonReviewTrackerKey(familyId: string): string {
  return `${TRACKER_PREFIX}:${familyId}`;
}

async function readTracker(key: string): Promise<TrackedLessonReview[]> {
  const pending = mutations.get(key);
  if (pending) await pending.catch(() => undefined);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    return parseTrackedLessonReviews(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function mutateTracker(
  familyId: string,
  update: (current: TrackedLessonReview[]) => TrackedLessonReview[],
): Promise<void> {
  const key = lessonReviewTrackerKey(familyId);
  const prior = mutations.get(key) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(async () => {
    const raw = await AsyncStorage.getItem(key);
    let current: TrackedLessonReview[] = [];
    if (raw) {
      try {
        current = parseTrackedLessonReviews(JSON.parse(raw));
      } catch {
        current = [];
      }
    }
    const updated = update(current);
    if (updated.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    }
  });
  mutations.set(key, next);
  try {
    await next;
  } finally {
    if (mutations.get(key) === next) mutations.delete(key);
  }
}

export async function loadTrackedLessonReviews(
  familyId: string,
): Promise<TrackedLessonReview[]> {
  return await readTracker(lessonReviewTrackerKey(familyId));
}

export async function rememberTrackedLessonReview(
  familyId: string,
  lesson: TrackedLessonReview,
): Promise<void> {
  const [validated] = parseTrackedLessonReviews([lesson]);
  if (!validated) throw new Error("Invalid lesson review recovery pointer.");
  await mutateTracker(familyId, (current) =>
    upsertTrackedLessonReview(current, validated));
}

export async function forgetTrackedLessonReview(
  familyId: string,
  lessonId: string,
): Promise<void> {
  await mutateTracker(familyId, (current) =>
    removeTrackedLessonReview(current, lessonId));
}
