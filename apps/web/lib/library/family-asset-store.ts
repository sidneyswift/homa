import { del } from "@vercel/blob";
import { MAP_SUBJECTS } from "@homa/core";

import {
  FAMILY_ASSET_ROW_SELECT,
  type FamilyAssetRow,
  toFamilyAssetView,
} from "./family-asset-upload-store";
import type { FamilyAssetUpdate } from "./family-asset-shelf";
import {
  isFamilyLibraryUrl,
  type FamilyAssetResourceKind,
  type FamilyAssetStatus,
  type FamilyAssetView,
} from "./family-assets";
import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";

const SUBJECTS_BY_ID = new Map(
  MAP_SUBJECTS.map((subject) => [subject.id, subject.displayName]),
);

export type UpdateFamilyAssetResult =
  | { ok: true; asset: FamilyAssetView }
  | {
      ok: false;
      reason: "not-found" | "unknown-child" | "unknown-subject";
    };

export interface FamilyAssetPatch {
  id: string;
  title?: string;
  resourceKind?: FamilyAssetResourceKind | null;
  childIds?: string[];
  subjectIds?: string[];
}

export type DeleteFamilyAssetResult =
  | { ok: true; priorStatus: FamilyAssetStatus }
  | { ok: false; reason: "not-found" | "delete-failed" };

export async function getFamilyAsset(
  familyId: string,
  assetId: string,
): Promise<FamilyAssetView | null> {
  const sql = mapDb();
  const rows = await sql<FamilyAssetRow[]>`
    select ${sql.unsafe(FAMILY_ASSET_ROW_SELECT)}
    from public.family_assets
    where id = ${assetId}
      and family_id = ${familyId}
      and deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const [children, subjects] = await Promise.all([
    sql<Array<{ id: string; name: string }>>`
      select child.id, child.name
      from public.family_asset_children link
      join public.children child
        on child.id = link.child_id
       and child.family_id = link.family_id
      where link.asset_id = ${assetId}
        and link.family_id = ${familyId}
      order by child.created_at, child.id
    `,
    sql<
      Array<{
        id: string;
        value: string;
        catalog_id: string | null;
        source: "model" | "parent" | "import" | "system";
      }>
    >`
      select id, value, catalog_id, source
      from public.family_asset_tags
      where asset_id = ${assetId}
        and family_id = ${familyId}
        and kind = 'subject'
      order by created_at, id
    `,
  ]);
  return toFamilyAssetView(row, {
    children,
    subjects: subjects.map((subject) => ({
      id:
        subject.catalog_id && SUBJECTS_BY_ID.has(subject.catalog_id)
          ? subject.catalog_id
          : `tag:${subject.id}`,
      label:
        (subject.catalog_id && SUBJECTS_BY_ID.get(subject.catalog_id)) ||
        subject.value,
      source: subject.source,
    })),
  });
}

/**
 * Applies one parent edit atomically. The asset and every child id are
 * re-scoped to the authenticated family inside the transaction. Only subject
 * tags are replaced, so model-authored topic, work, age, and entity assertions
 * remain intact.
 */
export async function updateFamilyAsset(input: {
  familyId: string;
  edit: FamilyAssetUpdate;
}): Promise<UpdateFamilyAssetResult> {
  return await patchFamilyAsset({
    familyId: input.familyId,
    patch: {
      id: input.edit.id,
      title: input.edit.title,
      resourceKind: input.edit.resourceKind,
      childIds: input.edit.childIds,
      subjectIds: input.edit.subjectIds,
    },
  });
}

/** Applies only the supplied fields, preserving untouched model evidence. */
export async function patchFamilyAsset(input: {
  familyId: string;
  patch: FamilyAssetPatch;
}): Promise<UpdateFamilyAssetResult> {
  const sql = mapDb();
  const result = await sql.begin(async (transaction) => {
    const existingRows = await transaction<
      Array<{
        id: string;
        title: string;
        resource_kind: FamilyAssetResourceKind | null;
      }>
    >`
      select id, title, resource_kind
      from public.family_assets
      where id = ${input.patch.id}
        and family_id = ${input.familyId}
        and deleted_at is null
      for update
    `;
    const existing = existingRows[0];
    if (!existing) return { ok: false, reason: "not-found" } as const;

    const children =
      input.patch.childIds === undefined
        ? null
        : input.patch.childIds.length === 0
          ? []
        : await transaction<{ id: string; name: string }[]>`
            select id, name
            from public.children
            where family_id = ${input.familyId}
              and id in ${transaction(input.patch.childIds)}
          `;
    if (
      children !== null &&
      children.length !== (input.patch.childIds?.length ?? 0)
    ) {
      return { ok: false, reason: "unknown-child" } as const;
    }
    if (
      input.patch.subjectIds?.some((subjectId) => !SUBJECTS_BY_ID.has(subjectId))
    ) {
      return { ok: false, reason: "unknown-subject" } as const;
    }

    await transaction`
      update public.family_assets
      set title = ${input.patch.title ?? existing.title},
          resource_kind = ${
            input.patch.resourceKind === undefined
              ? existing.resource_kind
              : input.patch.resourceKind
          },
          updated_at = now()
      where id = ${input.patch.id}
        and family_id = ${input.familyId}
        and deleted_at is null
    `;

    if (input.patch.childIds !== undefined) {
      await transaction`
        delete from public.family_asset_children
        where asset_id = ${input.patch.id}
          and family_id = ${input.familyId}
      `;
      for (const childId of input.patch.childIds) {
        await transaction`
          insert into public.family_asset_children (family_id, asset_id, child_id)
          values (${input.familyId}, ${input.patch.id}, ${childId})
        `;
      }
    }

    if (input.patch.subjectIds !== undefined) {
      await transaction`
        delete from public.family_asset_tags
        where asset_id = ${input.patch.id}
          and family_id = ${input.familyId}
          and kind = 'subject'
      `;
      for (const subjectId of input.patch.subjectIds) {
        const label = SUBJECTS_BY_ID.get(subjectId);
        if (!label) continue;
        await transaction`
          insert into public.family_asset_tags (
            family_id, asset_id, kind, value, catalog_id, quote, source
          )
          values (
            ${input.familyId}, ${input.patch.id}, 'subject', ${label},
            ${subjectId}, ${label}, 'parent'
          )
        `;
      }
    }
    return { ok: true } as const;
  });
  if (!result.ok) return result;
  const asset = await getFamilyAsset(input.familyId, input.patch.id);
  return asset
    ? { ok: true, asset }
    : { ok: false, reason: "not-found" };
}

/**
 * Removes one independently owned Library original, then retires its row.
 * Both the asset id and its stored Blob URL are re-scoped to the authenticated
 * family before any external delete. The same function serves UI and Eve so
 * failure recovery and telemetry cannot drift between surfaces.
 */
export async function deleteFamilyAsset(input: {
  familyId: string;
  assetId: string;
}): Promise<DeleteFamilyAssetResult> {
  const sql = mapDb();
  const row = await sql.begin(async (transaction) => {
    const rows = await transaction<
      Array<{ url: string; status: FamilyAssetStatus }>
    >`
      select url, status
      from public.family_assets
      where id = ${input.assetId}
        and family_id = ${input.familyId}
        and deleted_at is null
      for update
    `;
    const target = rows[0];
    if (!target) return null;
    await transaction`
      update public.family_assets
      set status = 'processing',
          processing_note = 'Removing original file',
          processing_error_code = null,
          updated_at = now()
      where id = ${input.assetId}
        and family_id = ${input.familyId}
        and deleted_at is null
    `;
    return target;
  });
  if (!row) return { ok: false, reason: "not-found" };

  if (!isFamilyLibraryUrl(row.url, input.familyId)) {
    await sql`
      update public.family_assets
      set status = 'needs_attention',
          processing_error_code = 'blob_url_invalid',
          processing_note = 'The original file could not be removed yet.',
          updated_at = now()
      where id = ${input.assetId}
        and family_id = ${input.familyId}
        and deleted_at is null
    `;
    console.error("family Library delete refused a URL outside its family prefix");
    return { ok: false, reason: "delete-failed" };
  }

  try {
    await del(row.url);
  } catch (error) {
    await sql`
      update public.family_assets
      set status = 'needs_attention',
          processing_error_code = 'blob_delete_failed',
          processing_note = 'The original file could not be removed yet.',
          updated_at = now()
      where id = ${input.assetId}
        and family_id = ${input.familyId}
        and deleted_at is null
    `;
    console.error(
      "library asset delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { ok: false, reason: "delete-failed" };
  }

  await sql`
    update public.family_assets
    set deleted_at = now(),
        processing_note = null,
        processing_error_code = null,
        updated_at = now()
    where id = ${input.assetId}
      and family_id = ${input.familyId}
      and deleted_at is null
  `;
  await emitMapEvent("library.asset_deleted", {
    family_id: input.familyId,
    asset_id: input.assetId,
    prior_status: row.status,
  });
  return { ok: true, priorStatus: row.status };
}
