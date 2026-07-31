import { resolveApiFamily } from "../../../../../lib/api-auth";
import { runTaskNow } from "../../../../../lib/tasks/run-now";

/**
 * POST /api/tasks/{taskId}/run-now: one immediate run of one task, the
 * mobile twin of runTaskNowAction. familyId comes from the caller's own
 * membership, never the client; runTaskNow's own route re-scopes taskId
 * by it.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { taskId } = await params;

  const result = await runTaskNow(taskId, auth.familyId);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.note }, { status: 400 });
  }
  return Response.json({ ok: true });
}
