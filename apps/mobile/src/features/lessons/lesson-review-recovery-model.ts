import type { LessonReviewStatusResult } from "./lesson-recording-upload";
import type { TrackedLessonReview } from "./lesson-review-tracker-model";

export interface TrackedLessonReviewStatus {
  lesson: TrackedLessonReview;
  outcome: LessonReviewStatusResult;
}

export type LessonReviewRecoveryAction = "retry" | "discuss" | "later" | "dismiss";

export interface LessonReviewRecoveryCopy {
  eyebrow: string;
  title: string;
  body: string;
  primary: LessonReviewRecoveryAction | null;
  secondary: LessonReviewRecoveryAction | null;
}

function priority(item: TrackedLessonReviewStatus): number {
  if (item.outcome.status === "review_failed" && item.outcome.retryable) return 0;
  if (item.outcome.status === "ready") return 1;
  if (item.outcome.status === "review_failed") return 2;
  if (item.outcome.status === "status_unavailable") return 3;
  return 4;
}

function needsParentAttention(item: TrackedLessonReviewStatus): boolean {
  if (item.outcome.status === "ready") return true;
  if (item.outcome.status === "review_failed") return true;
  return item.outcome.status === "status_unavailable"
    && item.outcome.reason === "not_found";
}

export function lessonReviewRecoveryFingerprint(
  outcome: LessonReviewStatusResult,
): string {
  if (outcome.status === "review_failed") {
    return `${outcome.status}:${outcome.retryable}:${outcome.reason}`;
  }
  if (outcome.status === "status_unavailable") {
    return `${outcome.status}:${outcome.reason}`;
  }
  return outcome.status;
}

export function selectLessonReviewRecovery(
  items: readonly TrackedLessonReviewStatus[],
  hiddenLessonStates: ReadonlyMap<string, string>,
): TrackedLessonReviewStatus | null {
  return [...items]
    .filter(needsParentAttention)
    .filter((item) =>
      hiddenLessonStates.get(item.lesson.lessonId)
      !== lessonReviewRecoveryFingerprint(item.outcome))
    .sort((left, right) => {
      const byPriority = priority(left) - priority(right);
      return byPriority !== 0
        ? byPriority
        : Date.parse(right.lesson.savedAt) - Date.parse(left.lesson.savedAt);
    })[0] ?? null;
}

export function lessonReviewRecoveryCopy(
  item: TrackedLessonReviewStatus,
): LessonReviewRecoveryCopy {
  const eyebrow = `${item.lesson.childName} · ${item.lesson.purpose}`;
  if (item.outcome.status === "ready") {
    return {
      eyebrow,
      title: "Lesson review ready",
      body: item.outcome.review.summary,
      primary: "discuss",
      secondary: "later",
    };
  }
  if (item.outcome.status === "processing") {
    return {
      eyebrow,
      title: "Lesson saved",
      body: "Homa is finishing the review in the background. It will appear here when it is ready.",
      primary: null,
      secondary: null,
    };
  }
  if (item.outcome.status === "status_unavailable") {
    return item.outcome.reason === "not_found"
      ? {
          eyebrow,
          title: "This review is no longer available",
          body: `${item.lesson.childName} does not need to repeat the lesson for Homa. Tell Homa what you remember, and she can still help plan the next step.`,
          primary: "discuss",
          secondary: "dismiss",
        }
      : {
          eyebrow,
          title: "Lesson saved",
          body: "Homa will keep checking the review in the background. It will appear here when it is ready.",
          primary: null,
          secondary: null,
        };
  }
  if (item.outcome.retryable) {
    return {
      eyebrow,
      title: "Lesson saved",
      body: `Homa needs one more try to finish the review. ${item.lesson.childName} does not need to record the lesson again.`,
      primary: "retry",
      secondary: "later",
    };
  }
  return {
    eyebrow,
    title: "Lesson saved",
    body: item.outcome.reason === "source_unavailable"
      ? `Homa could not finish this review. ${item.lesson.childName} does not need to record the lesson again. Tell Homa what you noticed, and she can still help choose the next step.`
      : `Homa could not finish a review she trusts. ${item.lesson.childName} does not need to record the lesson again. Tell Homa what you noticed, and she can still help choose the next step.`,
    primary: "discuss",
    secondary: "dismiss",
  };
}
