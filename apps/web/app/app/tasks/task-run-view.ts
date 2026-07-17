import type { TaskRunView } from "./tasks-view";

export const TASK_RUN_HISTORY_SELECT =
  "id, kind, status, title, summary, delivered_channel, started_at, research_brief_feedback(signal, member_user_id)";

interface TaskRunHistoryRow {
  id: string;
  kind: TaskRunView["kind"];
  status: TaskRunView["status"];
  title: string;
  summary: string | null;
  delivered_channel: TaskRunView["deliveredChannel"];
  started_at: string;
  research_brief_feedback:
    | Array<{
        member_user_id: string;
        signal: "helpful" | "not_for_us";
      }>
    | null;
}

/**
 * Keeps the client payload minimal by attaching the signed-in adult's own
 * persisted feedback to its corresponding History row during server render.
 */
export function mapTaskRunViews(
  rows: TaskRunHistoryRow[],
  callerUserId: string | null,
): TaskRunView[] {
  return rows.map((row) => {
    const callerFeedback = (row.research_brief_feedback ?? []).find(
      (feedback) => feedback.member_user_id === callerUserId,
    );
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      title: row.title,
      summary: row.summary,
      deliveredChannel: row.delivered_channel,
      startedAt: row.started_at,
      feedbackSignal: callerFeedback?.signal ?? null,
    };
  });
}
