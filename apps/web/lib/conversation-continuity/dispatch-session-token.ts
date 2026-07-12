import type { FamilyTaskKind } from "../tasks/kinds";

/**
 * dispatchContinuationToken(kind, familyId, runId, now)
 * The dispatch channel's session identity: one eve session per task run.
 *
 * eve claims a hook per continuation token and refuses to start a second
 * session on a claimed one (HookConflictError). The 2026-07-12 incident:
 * a family with three custom per-kid briefs fired all three in one
 * dispatcher tick, the kind-plus-family-plus-day token collided, and two
 * of the three runs never started.
 */
export function dispatchContinuationToken(
  kind: FamilyTaskKind,
  familyId: string | null | undefined,
  runId: string | null | undefined,
  now: Date = new Date(),
): string {
  const dayKey = now.toISOString().slice(0, 10);
  const base = `${kind}:${familyId ?? "unknown"}:${dayKey}`;
  // The run id (the homa_task_runs outbox row) is unique per schedule per
  // family-local day, so it separates sibling custom tasks while a true
  // redelivery of one run still resumes its own session. The day-scoped
  // fallback only covers callers with no run row.
  return runId ? `${base}:${runId}` : base;
}
