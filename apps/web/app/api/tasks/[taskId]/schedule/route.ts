import { resolveApiFamily } from "../../../../../lib/api-auth";
import { taskScheduleInputSchema, updateTaskSchedule } from "../../../../../lib/tasks/custom";

/**
 * POST /api/tasks/{taskId}/schedule: the schedule-only edit valid for
 * every task kind, the mobile twin of updateTaskScheduleAction. A
 * built-in task's label and prompt are Homa's; only days, hour, and
 * delivery move here, and updateTaskSchedule enforces that regardless
 * of kind. familyId always comes from resolveApiFamily.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = taskScheduleInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "invalid-schedule" },
      { status: 400 },
    );
  }

  const result = await updateTaskSchedule(auth.familyId, taskId, parsed.data);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.note }, { status: 400 });
  }
  return Response.json({ ok: true });
}
