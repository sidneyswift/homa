import { resolveApiFamily } from "../../../../lib/api-auth";
import { customTaskInputSchema, deleteCustomTask, updateCustomTask } from "../../../../lib/tasks/custom";

/**
 * PATCH/DELETE /api/tasks/{taskId}: the mobile twin of the tasks tab's
 * edit and delete server actions. Both are custom-task-only surfaces;
 * updateCustomTask and deleteCustomTask already refuse a built-in kind
 * (or a taskId outside this family) on their own, so this route does
 * not re-check kind before calling them. familyId always comes from
 * resolveApiFamily, never the client; taskId comes from the URL but is
 * re-scoped to auth.familyId by the same functions the web actions use.
 */

export async function PATCH(
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
  const parsed = customTaskInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "invalid-task" },
      { status: 400 },
    );
  }

  const result = await updateCustomTask(auth.familyId, taskId, parsed.data);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.note }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { taskId } = await params;

  const result = await deleteCustomTask(auth.familyId, taskId);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.note }, { status: 400 });
  }
  return Response.json({ ok: true });
}
