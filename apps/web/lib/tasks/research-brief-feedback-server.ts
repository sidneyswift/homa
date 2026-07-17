import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  recordResearchBriefFeedbackWithDatabase,
  type ResearchBriefFeedbackResult,
  type ResearchBriefFeedbackSignal,
} from "./research-brief-feedback";

/**
 * Persists feedback from an authenticated Tasks action. The action supplies
 * caller-derived IDs only, so this server-only boundary never trusts form data
 * to choose a family or adult.
 */
export async function recordResearchBriefFeedback(input: {
  familyId: string;
  taskRunId: string;
  memberUserId: string;
  signal: ResearchBriefFeedbackSignal;
}): Promise<ResearchBriefFeedbackResult> {
  return await recordResearchBriefFeedbackWithDatabase(mapDb(), {
    ...input,
    emit: async ({ familyId, taskRunId, signal }) => {
      await emitMapEvent("research.brief_feedback", {
        family_id: familyId,
        task_run_id: taskRunId,
        signal,
      });
    },
  });
}
