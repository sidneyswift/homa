import { progressNextMoveSchema, type ProgressNextMove } from "@homa/core";

import { mapDb, type DbJson } from "../map/db";
import { PROGRESS_NEXT_MOVE_PROMPT_VERSION } from "./next-move-snapshot";

export type ProgressNextMoveStatus =
  | "pending"
  | "ready"
  | "clarify"
  | "none"
  | "failed"
  | "dismissed"
  | "superseded";

interface ProgressNextMoveRow {
  family_id: string;
  child_id: string;
  context_fingerprint: string;
  source_revision: string;
  status: ProgressNextMoveStatus;
  result: unknown;
  runtime_session_id: string | null;
  updated_at: string;
}

export interface StoredProgressNextMove {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  sourceRevision: bigint;
  status: ProgressNextMoveStatus;
  nextMove: ProgressNextMove | null;
  runtimeSessionId: string | null;
  updatedAt: string;
}

function parseRow(row: ProgressNextMoveRow): StoredProgressNextMove {
  const parsed = progressNextMoveSchema.safeParse(row.result);
  return {
    familyId: row.family_id,
    childId: row.child_id,
    contextFingerprint: row.context_fingerprint,
    sourceRevision: BigInt(row.source_revision),
    status: row.status,
    nextMove: parsed.success ? parsed.data : null,
    runtimeSessionId: row.runtime_session_id,
    updatedAt: row.updated_at,
  };
}

export function validatedProgressNextMoveForStorage(
  value: unknown,
): ProgressNextMove | null {
  const parsed = progressNextMoveSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loadStoredProgressNextMove(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
}): Promise<StoredProgressNextMove | null> {
  const sql = mapDb();
  const rows = await sql<ProgressNextMoveRow[]>`
    select family_id, child_id, context_fingerprint,
           source_revision::text as source_revision, status, result,
           runtime_session_id, updated_at::text as updated_at
    from public.child_progress_next_moves
    where family_id = ${input.familyId}
      and child_id = ${input.childId}
      and context_fingerprint = ${input.contextFingerprint}
    limit 1
  `;
  return rows[0] ? parseRow(rows[0]) : null;
}

export async function claimProgressNextMove(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  sourceRevision: bigint;
  retryFailed?: boolean;
}): Promise<StoredProgressNextMove> {
  const sql = mapDb();
  const wrapped = await sql.begin(async (transaction) => {
    const scopedChildren = await transaction<{ id: string }[]>`
      select id
      from public.children
      where id = ${input.childId}
        and family_id = ${input.familyId}
      for update
    `;
    if (scopedChildren.length !== 1) {
      throw new Error("Progress next move child does not belong to family");
    }
    if (input.retryFailed) {
      await transaction`
        update public.child_progress_next_moves
        set status = 'pending', result = null, runtime_session_id = null,
            dismissed_at = null, dismissed_until = null, updated_at = now()
        where family_id = ${input.familyId}
          and child_id = ${input.childId}
          and context_fingerprint = ${input.contextFingerprint}
          and status = 'failed'
      `;
    }
    await transaction`
      update public.child_progress_next_moves
      set status = 'pending', result = null, runtime_session_id = null,
          dismissed_at = null, dismissed_until = null, updated_at = now()
      where family_id = ${input.familyId}
        and child_id = ${input.childId}
        and context_fingerprint = ${input.contextFingerprint}
        and status = 'dismissed'
        and dismissed_until <= now()
    `;
    await transaction`
      update public.child_progress_next_moves
      set status = 'superseded', superseded_at = now(), updated_at = now()
      where family_id = ${input.familyId}
        and child_id = ${input.childId}
        and context_fingerprint <> ${input.contextFingerprint}
        and status in ('pending', 'ready', 'clarify', 'none', 'failed')
    `;
    await transaction`
      insert into public.child_progress_next_moves (
        family_id, child_id, context_fingerprint, source_revision,
        prompt_version, status
      ) values (
        ${input.familyId}, ${input.childId}, ${input.contextFingerprint},
        ${input.sourceRevision.toString()},
        ${PROGRESS_NEXT_MOVE_PROMPT_VERSION}, 'pending'
      )
      on conflict (family_id, child_id, context_fingerprint) do nothing
    `;
    return await transaction<ProgressNextMoveRow[]>`
      select family_id, child_id, context_fingerprint,
             source_revision::text as source_revision, status, result,
             runtime_session_id, updated_at::text as updated_at
      from public.child_progress_next_moves
      where family_id = ${input.familyId}
        and child_id = ${input.childId}
        and context_fingerprint = ${input.contextFingerprint}
      limit 1
    `;
  });
  const row = wrapped[0];
  if (!row) throw new Error("Progress next move claim did not return its row");
  return parseRow(row);
}

export async function completeProgressNextMove(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  sourceRevision: bigint;
  nextMove: ProgressNextMove;
}): Promise<StoredProgressNextMove | null> {
  const nextMove = validatedProgressNextMoveForStorage(input.nextMove);
  if (
    !nextMove ||
    nextMove.childId !== input.childId ||
    nextMove.sourceRevision !== input.sourceRevision.toString()
  ) {
    return null;
  }
  const status =
    nextMove.kind === "move"
      ? "ready"
      : nextMove.kind === "clarify"
        ? "clarify"
        : "none";
  const sql = mapDb();
  const rows = await sql<ProgressNextMoveRow[]>`
    update public.child_progress_next_moves
    set status = ${status}, result = ${sql.json(
      nextMove as unknown as DbJson,
    )}, updated_at = now()
    where family_id = ${input.familyId}
      and child_id = ${input.childId}
      and context_fingerprint = ${input.contextFingerprint}
      and source_revision = ${input.sourceRevision.toString()}
      and status = 'pending'
    returning family_id, child_id, context_fingerprint,
              source_revision::text as source_revision, status, result,
              runtime_session_id, updated_at::text as updated_at
  `;
  return rows[0] ? parseRow(rows[0]) : null;
}

export async function failProgressNextMove(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  sourceRevision: bigint;
}): Promise<StoredProgressNextMove | null> {
  const sql = mapDb();
  const rows = await sql<ProgressNextMoveRow[]>`
    update public.child_progress_next_moves
    set status = 'failed', result = null, runtime_session_id = null,
        updated_at = now()
    where family_id = ${input.familyId}
      and child_id = ${input.childId}
      and context_fingerprint = ${input.contextFingerprint}
      and source_revision = ${input.sourceRevision.toString()}
      and status = 'pending'
    returning family_id, child_id, context_fingerprint,
              source_revision::text as source_revision, status, result,
              runtime_session_id, updated_at::text as updated_at
  `;
  return rows[0] ? parseRow(rows[0]) : null;
}

export async function setProgressNextMoveRuntimeSession(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  sessionId: string;
}): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ context_fingerprint: string }[]>`
    update public.child_progress_next_moves
    set runtime_session_id = ${input.sessionId}, updated_at = now()
    where family_id = ${input.familyId}
      and child_id = ${input.childId}
      and context_fingerprint = ${input.contextFingerprint}
      and status = 'pending'
      and runtime_session_id = 'starting'
    returning context_fingerprint
  `;
  return rows.length === 1;
}

export async function reserveProgressNextMoveStart(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
}): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ context_fingerprint: string }[]>`
    update public.child_progress_next_moves
    set runtime_session_id = 'starting', updated_at = now()
    where family_id = ${input.familyId}
      and child_id = ${input.childId}
      and context_fingerprint = ${input.contextFingerprint}
      and status = 'pending'
      and (
        runtime_session_id is null
        or (
          runtime_session_id = 'starting'
          and updated_at < now() - interval '60 seconds'
        )
      )
    returning context_fingerprint
  `;
  return rows.length === 1;
}

export async function dismissProgressNextMove(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  sourceRevision: bigint;
  timeZone: string;
  nextMove: ProgressNextMove;
}): Promise<boolean> {
  const nextMove = validatedProgressNextMoveForStorage(input.nextMove);
  if (
    !nextMove ||
    nextMove.childId !== input.childId ||
    nextMove.sourceRevision !== input.sourceRevision.toString()
  ) {
    return false;
  }
  const sql = mapDb();
  const rows = await sql<{ context_fingerprint: string }[]>`
    update public.child_progress_next_moves
    set status = 'dismissed', result = ${sql.json(
      nextMove as unknown as DbJson,
    )}, dismissed_at = now(),
        dismissed_until = (
          date_trunc('day', now() at time zone ${input.timeZone})
          + interval '1 day'
        ) at time zone ${input.timeZone},
        updated_at = now()
    where family_id = ${input.familyId}
      and child_id = ${input.childId}
      and context_fingerprint = ${input.contextFingerprint}
      and source_revision = ${input.sourceRevision.toString()}
      and status in ('pending', 'ready', 'clarify', 'none')
    returning context_fingerprint
  `;
  return rows.length === 1;
}

export async function waitForSettledProgressNextMove(input: {
  familyId: string;
  childId: string;
  contextFingerprint: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<StoredProgressNextMove | null> {
  const deadline = Date.now() + (input.timeoutMs ?? 12_000);
  do {
    const current = await loadStoredProgressNextMove(input);
    if (current && current.status !== "pending") return current;
    await new Promise((resolve) => setTimeout(resolve, input.pollMs ?? 250));
  } while (Date.now() < deadline);
  return await loadStoredProgressNextMove(input);
}
