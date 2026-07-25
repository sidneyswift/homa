import { mapDb } from "../map/db";

/**
 * Cloud-to-device deltas, computed straight from the domain tables: no
 * reverse event rows, no emit hooks in the write paths. Cursors are
 * timestamps the device echoes back; anything updated after them is
 * returned, including superseded memories (compaction rewrites the store,
 * and a mirror that never sees supersessions diverges permanently).
 */

export interface SyncPullCursor {
  /** ISO timestamp: memories and children updated after this. */
  since: string | null;
}

export interface SyncPullDelta {
  serverTime: string;
  memories: {
    id: string;
    childId: string | null;
    kind: string;
    content: string;
    source: string;
    createdAt: string;
    updatedAt: string;
    supersededAt: string | null;
  }[];
  children: {
    id: string;
    name: string;
    profile: Record<string, unknown> | null;
    updatedAt: string;
  }[];
  progress: {
    childId: string;
    projection: Record<string, unknown>;
    updatedAt: string;
  }[];
}

const PULL_LIMIT = 500;

export async function getSyncPullDelta(
  familyId: string,
  cursor: SyncPullCursor,
): Promise<SyncPullDelta> {
  const sql = mapDb();
  const since = cursor.since ?? "1970-01-01T00:00:00Z";

  const [serverTimeRows, memories, children, progress] = await Promise.all([
    sql<{ now: string }[]>`select now()::text as now`,
    sql<
      {
        id: string;
        child_id: string | null;
        kind: string;
        content: string;
        source: string;
        created_at: string;
        updated_at: string;
        superseded_at: string | null;
      }[]
    >`
      select id, child_id, kind, content, source,
             created_at::text, updated_at::text, superseded_at::text
      from public.family_memories
      where family_id = ${familyId} and updated_at > ${since}
      order by updated_at asc
      limit ${PULL_LIMIT}
    `,
    sql<
      { id: string; name: string; profile: Record<string, unknown> | null; updated_at: string }[]
    >`
      select id, name, profile, updated_at::text
      from public.children
      where family_id = ${familyId} and updated_at > ${since}
      order by updated_at asc
    `,
    sql<
      { child_id: string; projection: Record<string, unknown>; updated_at: string }[]
    >`
      select live.child_id, live.projection, live.updated_at::text
      from public.child_progress_live live
      where live.family_id = ${familyId} and live.updated_at > ${since}
      order by live.updated_at asc
    `,
  ]);

  return {
    serverTime: serverTimeRows[0]?.now ?? new Date().toISOString(),
    memories: memories.map((row) => ({
      id: row.id,
      childId: row.child_id,
      kind: row.kind,
      content: row.content,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      supersededAt: row.superseded_at,
    })),
    children: children.map((row) => ({
      id: row.id,
      name: row.name,
      profile: row.profile,
      updatedAt: row.updated_at,
    })),
    progress: progress.map((row) => ({
      childId: row.child_id,
      projection: row.projection,
      updatedAt: row.updated_at,
    })),
  };
}
