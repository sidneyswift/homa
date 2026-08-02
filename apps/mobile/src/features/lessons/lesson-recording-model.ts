export interface PreparedLessonRecording {
  childId: string;
  childName: string;
  purpose: string;
}

export interface NativeLessonReview {
  summary: string;
  evidenceCount: number;
  observationCount: number;
}

export type LessonReviewFailureReason =
  | "retryable"
  | "attempts_exhausted"
  | "source_unavailable"
  | "unknown";

export type NativeLessonReviewOutcome =
  | { status: "ready"; review: NativeLessonReview }
  | { status: "processing" }
  | {
      status: "review_failed";
      retryable: boolean;
      reason: LessonReviewFailureReason;
    };

export type LessonRecorderPhase =
  | "confirm"
  | "consent"
  | "starting"
  | "recording"
  | "paused"
  | "interrupted"
  | "review"
  | "saving"
  | "analyzing"
  | "processing"
  | "review_failed"
  | "ready"
  | "save_failed"
  | "consent_failed"
  | "permission_denied"
  | "low_storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses both the status poll and the retry command without trusting shape. */
export function parseNativeLessonReviewOutcome(
  value: unknown,
): NativeLessonReviewOutcome | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "ready" && isRecord(value.review)) {
    if (typeof value.review.summary !== "string") return null;
    return {
      status: "ready",
      review: {
        summary: value.review.summary,
        evidenceCount: Number(value.review.evidenceCount) || 0,
        observationCount: Number(value.review.observationCount) || 0,
      },
    };
  }
  if (
    value.status === "processing" ||
    value.status === "uploaded" ||
    value.status === "analyzing" ||
    value.status === "recording"
  ) {
    return { status: "processing" };
  }
  if (value.status !== "failed" && value.status !== "review_failed") {
    return null;
  }
  const apiReason = value.retryReason ?? value.reason;
  const reason: LessonReviewFailureReason =
    apiReason === "attempts-exhausted"
      ? "attempts_exhausted"
      : apiReason === "source-unavailable"
        ? "source_unavailable"
        : value.retryable === true
          ? "retryable"
          : "unknown";
  return {
    status: "review_failed",
    retryable: value.retryable === true,
    reason,
  };
}

export function lessonReviewFailureCopy(
  reason: LessonReviewFailureReason,
): string {
  if (reason === "attempts_exhausted") {
    return "Homa tried every safe pass without getting a review she could trust. The lesson is still saved, but she will not pretend the review is ready.";
  }
  if (reason === "source_unavailable") {
    return "The raw audio is no longer available, and there is not enough transcript left to build a trustworthy review.";
  }
  if (reason === "retryable") {
    return "The recording is saved, but Homa could not finish this review. You can ask her to listen again.";
  }
  return "The recording is saved, but Homa could not finish this review.";
}

/** A model tool result becomes a microphone handoff only through this
 * closed parser. Prose, partial objects, and unsuccessful results stay inert. */
export function parsePreparedLessonRecording(
  value: unknown,
): PreparedLessonRecording | null {
  if (!isRecord(value)) return null;
  if (value.prepared !== true || value.nativeAction !== "lesson_recording") {
    return null;
  }
  if (
    typeof value.childId !== "string" ||
    typeof value.childName !== "string" ||
    typeof value.purpose !== "string"
  ) {
    return null;
  }
  const childName = value.childName.trim();
  const purpose = value.purpose.trim();
  if (!childName || purpose.length < 2 || purpose.length > 120) return null;
  return {
    childId: value.childId,
    childName,
    purpose,
  };
}

export interface LessonRecordingSignal {
  key: string;
  intent: PreparedLessonRecording;
}

/** Finds only completed prepare_lesson_recording tool results. This mirrors
 * Voice overlay dedup without making the recorder a generic overlay. */
export function deriveLessonRecordingSignals(
  messages: readonly unknown[],
  handledKeys: ReadonlySet<string>,
): { signals: LessonRecordingSignal[]; keys: string[] } {
  const signals: LessonRecordingSignal[] = [];
  const keys: string[] = [];
  messages.forEach((message, messageIndex) => {
    if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.parts)) {
      return;
    }
    const messageId = typeof message.id === "string" ? message.id : `m${messageIndex}`;
    message.parts.forEach((part, partIndex) => {
      if (!isRecord(part)) return;
      if (
        part.type !== "dynamic-tool" ||
        part.toolName !== "prepare_lesson_recording" ||
        part.state !== "output-available"
      ) {
        return;
      }
      const intent = parsePreparedLessonRecording(part.output);
      if (!intent) return;
      const key = `${messageId}:${partIndex}`;
      keys.push(key);
      if (!handledKeys.has(key)) signals.push({ key, intent });
    });
  });
  return { signals, keys };
}

export function recorderPhaseCopy(
  phase: LessonRecorderPhase,
  childName: string,
): string {
  switch (phase) {
    case "confirm":
      return `Nothing is recording yet. This lesson is for ${childName}. Keep Homa open because leaving the app pauses recording.`;
    case "consent":
      return "Please read the privacy details before recording a child's voice.";
    case "starting":
      return "Getting the recorder ready.";
    case "recording":
      return "Keep Homa open while you record. Locking your phone or switching apps pauses the lesson.";
    case "paused":
      return "The recording is paused. Nothing new is being captured.";
    case "interrupted":
      return "Another app needed the microphone, so this recording paused.";
    case "review":
      return "Play it back, discard it, or save it privately for Homa to review.";
    case "saving":
      return "Saving the lesson privately. Keep Homa open until the upload finishes.";
    case "analyzing":
      return "The audio is saved. Homa is listening for the words, energy, and learning moments.";
    case "processing":
      return "The recording is saved. Homa is still finishing the lesson review. You can leave this screen while she keeps working.";
    case "review_failed":
      return "The recording is saved, but Homa couldn't finish this review. The audio is safe. You can leave this screen.";
    case "ready":
      return "The lesson review is ready. Return to Voice to talk it through.";
    case "save_failed":
      return "The recording is still on this phone. Homa did not save it, so you can try again or discard it.";
    case "consent_failed":
      return "Homa could not save your privacy choice. Nothing was recorded.";
    case "permission_denied":
      return "Nothing was recorded. Microphone access is off for Homa.";
    case "low_storage":
      return "Nothing was recorded. This phone needs a little more free space first.";
  }
}

export function formatLessonElapsed(totalSeconds: number): string {
  const bounded = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(bounded / 60);
  const seconds = bounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
