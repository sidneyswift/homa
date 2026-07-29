import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A material's version history (gh#350).
 *
 * "As soon as she redoes it I can't see the old version, so I have to
 * start screenshotting" (co-founder, 2026-07-28). The rows were always
 * there; what was missing was somewhere to look at them, and until the
 * retention change every superseded version's image was deleted at
 * finalize so there was nothing to show even if you looked.
 *
 * Versions created before 2026-07-29 may have no image left. Those are
 * returned with `previewUrl: null` rather than dropped: "this version
 * existed and its picture is gone" is the truth, and silently omitting
 * it would make the history look shorter than her memory of it.
 */

export interface MaterialVersion {
  id: string;
  /** null when the image was reclaimed before retention shipped. */
  previewUrl: string | null;
  createdAt: string;
  status: "draft" | "final" | "superseded";
  /** 1 is the first version she ever saw, counting up. */
  ordinal: number;
  isCurrent: boolean;
}

interface VersionRow {
  id: string;
  revises: string | null;
  preview_url: string | null;
  created_at: string;
  status: "draft" | "final" | "superseded";
}

/**
 * Walks the whole revision chain containing materialId, in both
 * directions, the same connected component finalize locks. Ordered
 * oldest first, because that is how she remembers making them.
 */
export function toVersionHistory(
  rows: readonly VersionRow[],
  currentId: string,
): MaterialVersion[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const chain = new Map<string, VersionRow>();
  const queue = [currentId];
  const children = new Map<string, VersionRow[]>();
  for (const row of rows) {
    if (!row.revises) continue;
    children.set(row.revises, [...(children.get(row.revises) ?? []), row]);
  }
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (chain.has(id)) continue;
    const row = byId.get(id);
    if (!row) continue;
    chain.set(id, row);
    if (row.revises) queue.push(row.revises);
    for (const child of children.get(id) ?? []) queue.push(child.id);
  }

  return [...chain.values()]
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at) ||
        left.id.localeCompare(right.id),
    )
    .map((row, index) => ({
      id: row.id,
      previewUrl: row.preview_url && row.preview_url.trim() !== "" ? row.preview_url : null,
      createdAt: row.created_at,
      status: row.status,
      ordinal: index + 1,
      isCurrent: row.id === currentId,
    }));
}

/** Reads on the caller's session, so RLS is the tenancy wall. */
export async function findMaterialVersionsCaller(
  db: SupabaseClient,
  familyId: string,
  materialId: string,
): Promise<MaterialVersion[]> {
  const { data, error } = await db
    .from("materials")
    .select("id, revises, preview_url, created_at, status")
    .eq("family_id", familyId)
    .limit(3000);
  if (error) {
    console.error("material version history failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as VersionRow[];
  if (!rows.some((row) => row.id === materialId)) return [];
  return toVersionHistory(rows, materialId);
}
