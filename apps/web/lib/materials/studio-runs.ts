import { mapDb } from "../map/db";

/**
 * The studio test bench's run ledger (materials_studio_runs migration).
 * Started by the materials-lab channel's run route, finished by that
 * channel's terminal events, mirroring how the agent-job channel parks
 * unreported stages: a run whose session dies before create_printable
 * stays visible as failed instead of vanishing.
 *
 * Tenancy: familyId is stamped by the route after its own sandbox-family
 * check (never model or client input), and every update re-scopes id by
 * family_id, the same belt lib/jobs/runner.ts wears.
 */

export interface StartedStudioRun {
  id: string;
}

export async function createStudioRun(input: {
  familyId: string;
  childId: string | null;
  request: string;
  startedBy: string;
}): Promise<StartedStudioRun> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    insert into public.materials_studio_runs
      (family_id, child_id, request, started_by)
    values (${input.familyId}, ${input.childId}, ${input.request}, ${input.startedBy})
    returning id
  `;
  return { id: rows[0].id };
}

export async function setStudioRunSession(
  familyId: string,
  runId: string,
  sessionId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.materials_studio_runs
    set session_id = ${sessionId}, updated_at = now()
    where id = ${runId} and family_id = ${familyId}
  `;
}

/** turn.completed: the session finished on its own. Only a still-started
 * run flips, so a late event can never overwrite a recorded failure. */
export async function completeStudioRunIfStarted(
  familyId: string,
  runId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.materials_studio_runs
    set status = 'completed', updated_at = now()
    where id = ${runId} and family_id = ${familyId} and status = 'started'
  `;
}

export async function failStudioRunIfStarted(
  familyId: string,
  runId: string,
  error: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.materials_studio_runs
    set status = 'failed', error = ${error.slice(0, 500)}, updated_at = now()
    where id = ${runId} and family_id = ${familyId} and status = 'started'
  `;
}

/** The route's target guard: the family must exist, be a sandbox family,
 * and not be deleted. Returns the family name for the reply, null when
 * the guard refuses. */
export async function loadSandboxFamilyForStudio(
  familyId: string,
): Promise<{ id: string; name: string } | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from public.families
    where id = ${familyId} and sandbox and status <> 'deleted'
  `;
  return rows[0] ?? null;
}

/** Re-scopes a picked child inside the target family (tenancy law) and
 * returns the name the brief should use. */
export async function loadStudioChild(
  familyId: string,
  childId: string,
): Promise<{ id: string; name: string } | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from public.children
    where id = ${childId} and family_id = ${familyId}
  `;
  return rows[0] ?? null;
}
