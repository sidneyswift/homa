import { z } from "zod";

import { resolveApiFamily } from "../../../../../lib/api-auth";
import { setTaskPaused } from "../../../../../lib/tasks/custom";

/**
 * POST /api/tasks/{taskId}/pause: the tab toggle, the mobile twin of
 * setTaskPausedAction. Valid for every kind; unpausing recomputes
 * next_run_at the same way the web action does, so a task never fires
 * instantly off a stale timestamp.
 */

const PAUSE_BODY_SCHEMA = z.object({ paused: z.boolean() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { taskId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = PAUSE_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid-pause" }, { status: 400 });
  }

  const result = await setTaskPaused(auth.familyId, taskId, parsed.data.paused);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.note }, { status: 400 });
  }
  return Response.json({ ok: true });
}
