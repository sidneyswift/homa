import { z } from "zod";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { isResearchBriefFeedbackSignal } from "../../../../lib/tasks/research-brief-feedback";
import { recordResearchBriefFeedback } from "../../../../lib/tasks/research-brief-feedback-server";

/**
 * POST /api/tasks/feedback: the mobile twin of
 * recordResearchBriefFeedbackAction. familyId and memberUserId both
 * come from resolveApiFamily, never the client; recordResearchBriefFeedback
 * re-checks that the run is family-visible and feedback-eligible before
 * writing anything.
 */

const TASK_RUN_ID_SCHEMA = z.uuid();

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const { taskRunId, signal } = (body ?? {}) as { taskRunId?: unknown; signal?: unknown };

  const parsedTaskRunId = TASK_RUN_ID_SCHEMA.safeParse(taskRunId);
  if (!parsedTaskRunId.success) {
    return Response.json({ ok: false, reason: "invalid-task-run" }, { status: 400 });
  }
  if (!isResearchBriefFeedbackSignal(signal)) {
    return Response.json({ ok: false, reason: "invalid-signal" }, { status: 400 });
  }

  const result = await recordResearchBriefFeedback({
    familyId: auth.familyId,
    taskRunId: parsedTaskRunId.data,
    memberUserId: auth.userId,
    signal,
  });
  if (!result.accepted) {
    return Response.json({ ok: false, reason: "not-eligible" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
