export interface PreparedLessonRecording {
  childId: string;
  childName: string;
  purpose: string;
}

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
