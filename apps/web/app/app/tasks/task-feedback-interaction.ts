import type { ResearchBriefFeedbackSignal } from "../../../lib/tasks/research-brief-feedback";

export const BRIEF_FEEDBACK_ERROR_MESSAGE =
  "That didn't save. Nothing else changed. You can tap your choice again.";

interface BriefFeedbackInteractionInput {
  taskRunId: string;
  signal: ResearchBriefFeedbackSignal;
}

interface BriefFeedbackInteractionDependencies {
  action: (
    taskRunId: string,
    signal: ResearchBriefFeedbackSignal,
  ) => Promise<{ error: string | null }>;
  setError: (error: string | null) => void;
  refresh: () => void;
}

/**
 * Owns one feedback click from stale-error clearing through refresh. The
 * injected boundaries keep every success and failure branch executable in
 * tests without a browser or authenticated request.
 */
export async function runBriefFeedbackInteraction(
  input: BriefFeedbackInteractionInput,
  dependencies: BriefFeedbackInteractionDependencies,
): Promise<void> {
  dependencies.setError(null);
  try {
    const result = await dependencies.action(input.taskRunId, input.signal);
    if (result.error !== null) {
      dependencies.setError(BRIEF_FEEDBACK_ERROR_MESSAGE);
      return;
    }
    dependencies.refresh();
  } catch {
    dependencies.setError(BRIEF_FEEDBACK_ERROR_MESSAGE);
  }
}
