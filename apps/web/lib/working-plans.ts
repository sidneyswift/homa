import { mapDb, type DbJson } from "./map/db";
import {
  monthPlanDraftPayloadSchema,
  type MonthPlanDraftPayload,
} from "./month-plan-draft";

export interface WorkingPlanBinderItem {
  id: string;
  kind: "month_plan";
  title: string;
  currentRevision: number;
  updatedAt: string;
}

interface WorkingPlanRow {
  id: string;
  kind: "month_plan";
  title: string;
  current_revision: number;
  payload: unknown;
  updated_at: string;
}

export async function saveWorkingMonthPlan(input: {
  familyId: string;
  ownerUserId: string | null;
  sessionId: string;
  payload: MonthPlanDraftPayload;
}): Promise<boolean> {
  const parsed = monthPlanDraftPayloadSchema.safeParse(input.payload);
  if (!parsed.success || parsed.data.familyId !== input.familyId) return false;
  const snapshot = parsed.data.history[parsed.data.history.length - 1];
  const sql = mapDb();
  const sourceEntry = [{
    sessionId: input.sessionId,
    revision: snapshot.revision,
    capturedAt: new Date().toISOString(),
  }];
  const artifactLinks = [
    ...new Set(
      snapshot.plan.children.flatMap((child) =>
        child.weeks.flatMap((week) =>
          week.activities.flatMap((activity) =>
            activity.reusedMaterialId ? [activity.reusedMaterialId] : [],
          ),
        ),
      ),
    ),
  ].map((id) => ({ kind: "material", id }));
  const rows = await sql<{ id: string }[]>`
    insert into public.working_plans as existing
      (id, family_id, owner_user_id, kind, title, status,
       source_session_id, source_entries, current_revision, payload,
       artifact_links)
    values
      (${parsed.data.draftId}, ${input.familyId}, ${input.ownerUserId},
       'month_plan', ${snapshot.plan.title}, 'draft', ${input.sessionId},
       ${sql.json(sourceEntry as unknown as DbJson)}, ${snapshot.revision},
       ${sql.json(parsed.data as unknown as DbJson)},
       ${sql.json(artifactLinks as unknown as DbJson)})
    on conflict (id) do update
      set owner_user_id = coalesce(existing.owner_user_id, excluded.owner_user_id),
          title = excluded.title,
          source_session_id = excluded.source_session_id,
          source_entries = existing.source_entries || excluded.source_entries,
          current_revision = excluded.current_revision,
          payload = excluded.payload,
          artifact_links = excluded.artifact_links,
          updated_at = now()
      where existing.family_id = excluded.family_id
        and existing.status = 'draft'
        and existing.current_revision <= excluded.current_revision
    returning id
  `;
  return rows[0]?.id === parsed.data.draftId;
}

export async function loadWorkingMonthPlan(input: {
  familyId: string;
  workingPlanId: string;
}): Promise<MonthPlanDraftPayload | null> {
  const sql = mapDb();
  const rows = await sql<{ payload: unknown }[]>`
    select payload
    from public.working_plans
    where id = ${input.workingPlanId}
      and family_id = ${input.familyId}
      and kind = 'month_plan'
      and status = 'draft'
    limit 1
  `;
  const parsed = monthPlanDraftPayloadSchema.safeParse(rows[0]?.payload);
  return parsed.success && parsed.data.familyId === input.familyId
    ? parsed.data
    : null;
}

export async function listWorkingPlansForBinder(
  familyId: string,
  limit = 40,
): Promise<WorkingPlanBinderItem[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const sql = mapDb();
  const rows = await sql<WorkingPlanRow[]>`
    select w.id, w.kind, w.title, w.current_revision,
           w.payload, w.updated_at::text as updated_at
    from public.working_plans w
    where w.family_id = ${familyId}
      and w.status = 'draft'
      and not exists (
        select 1 from public.month_plan_approvals a
        where a.family_id = w.family_id and a.draft_id = w.id
      )
    order by w.updated_at desc
    limit ${boundedLimit}
  `;
  return rows.flatMap((row) => {
    const parsed = monthPlanDraftPayloadSchema.safeParse(row.payload);
    if (!parsed.success || parsed.data.familyId !== familyId) return [];
    return [{
      id: row.id,
      kind: row.kind,
      title: row.title,
      currentRevision: row.current_revision,
      updatedAt: row.updated_at,
    }];
  });
}

export async function archiveWorkingPlan(input: {
  familyId: string;
  workingPlanId: string;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.working_plans
    set status = 'archived', archived_at = now(), updated_at = now()
    where id = ${input.workingPlanId}
      and family_id = ${input.familyId}
      and status = 'draft'
  `;
}

export async function finalizeWorkingPlan(input: {
  familyId: string;
  workingPlanId: string;
  revision: number;
}): Promise<void> {
  const sql = mapDb();
  const receipt = [{
    effect: "planner_month_saved",
    revision: input.revision,
    verifiedAt: new Date().toISOString(),
  }];
  await sql`
    update public.working_plans
    set status = 'finalized', finalized_at = now(), updated_at = now(),
        effect_receipts = effect_receipts || ${sql.json(receipt as unknown as DbJson)}
    where id = ${input.workingPlanId}
      and family_id = ${input.familyId}
      and status = 'draft'
  `;
}
