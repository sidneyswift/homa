import type { LessonStatus } from "./store";

export interface LessonAnalysisRetryFacts {
  status: LessonStatus;
  attempts: number;
  maxAttempts: number;
  audioDeletedAt: string | null;
  hasUsableTranscript: boolean;
}

export type LessonAnalysisRetryState =
  | { status: "available"; attempts: number }
  | { status: "processing"; attempts: number }
  | { status: "ready"; attempts: number }
  | { status: "exhausted"; attempts: number }
  | { status: "source_unavailable"; attempts: number }
  | { status: "not_finished"; attempts: number };

/**
 * The durable retry law. Clients never infer this from a local counter:
 * the server classifies the family-scoped recording and its retained source.
 */
export function lessonAnalysisRetryState(
  facts: LessonAnalysisRetryFacts,
): LessonAnalysisRetryState {
  if (facts.status === "ready") {
    return { status: "ready", attempts: facts.attempts };
  }
  if (facts.status === "uploaded" || facts.status === "analyzing") {
    return { status: "processing", attempts: facts.attempts };
  }
  if (facts.status === "recording") {
    return { status: "not_finished", attempts: facts.attempts };
  }
  if (facts.attempts >= facts.maxAttempts) {
    return { status: "exhausted", attempts: facts.attempts };
  }
  if (facts.audioDeletedAt !== null && !facts.hasUsableTranscript) {
    return { status: "source_unavailable", attempts: facts.attempts };
  }
  return { status: "available", attempts: facts.attempts };
}

export function hasUsableLessonTranscript(
  transcripts: ReadonlyArray<string | null>,
): boolean {
  return transcripts.some(
    (transcript) => transcript !== null && transcript.trim().length > 0,
  );
}

export function lessonRetryApiReason(
  state: LessonAnalysisRetryState,
): "attempts-exhausted" | "source-unavailable" | "not-finished" | null {
  if (state.status === "exhausted") return "attempts-exhausted";
  if (state.status === "source_unavailable") return "source-unavailable";
  if (state.status === "not_finished") return "not-finished";
  return null;
}
