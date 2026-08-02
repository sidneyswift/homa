import { MAP_SUBJECTS } from "@homa/core";

import {
  FAMILY_ASSET_ROW_SELECT,
  type FamilyAssetRow,
  toFamilyAssetView,
} from "./family-asset-upload-store";
import type { FamilyAssetUpdate } from "./family-asset-shelf";
import type { FamilyAssetView } from "./family-assets";
import { mapDb } from "../map/db";

const SUBJECTS_BY_ID = new Map(
  MAP_SUBJECTS.map((subject) => [subject.id, subject.displayName]),
);

export type UpdateFamilyAssetResult =
  | { ok: true; asset: FamilyAssetView }
  | { ok: false; reason: "not-found" | "unknown-child" };

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
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const existing = await transaction<{ id: string }[]>`
      select id
      from public.family_assets
      where id = ${input.edit.id}
        and family_id = ${input.familyId}
        and deleted_at is null
      for update
    `;
    if (!existing[0]) return { ok: false, reason: "not-found" } as const;

    const children =
      input.edit.childIds.length === 0
        ? []
        : await transaction<{ id: string; name: string }[]>`
            select id, name
            from public.children
            where family_id = ${input.familyId}
              and id in ${transaction(input.edit.childIds)}
          `;
    if (children.length !== input.edit.childIds.length) {
      return { ok: false, reason: "unknown-child" } as const;
    }

    const rows = await transaction<FamilyAssetRow[]>`
      update public.family_assets
      set title = ${input.edit.title},
          resource_kind = ${input.edit.resourceKind},
          updated_at = now()
      where id = ${input.edit.id}
        and family_id = ${input.familyId}
        and deleted_at is null
      returning ${transaction.unsafe(FAMILY_ASSET_ROW_SELECT)}
    `;
    const row = rows[0];
    if (!row) return { ok: false, reason: "not-found" } as const;

    await transaction`
      delete from public.family_asset_children
      where asset_id = ${input.edit.id}
        and family_id = ${input.familyId}
    `;
    for (const childId of input.edit.childIds) {
      await transaction`
        insert into public.family_asset_children (family_id, asset_id, child_id)
        values (${input.familyId}, ${input.edit.id}, ${childId})
      `;
    }

    await transaction`
      delete from public.family_asset_tags
      where asset_id = ${input.edit.id}
        and family_id = ${input.familyId}
        and kind = 'subject'
    `;
    for (const subjectId of input.edit.subjectIds) {
      const label = SUBJECTS_BY_ID.get(subjectId);
      if (!label) continue;
      await transaction`
        insert into public.family_asset_tags (
          family_id, asset_id, kind, value, catalog_id, quote, source
        )
        values (
          ${input.familyId}, ${input.edit.id}, 'subject', ${label},
          ${subjectId}, ${label}, 'parent'
        )
      `;
    }

    const childById = new Map(children.map((child) => [child.id, child]));
    return {
      ok: true,
      asset: toFamilyAssetView(row, {
        children: input.edit.childIds.flatMap((id) => {
          const child = childById.get(id);
          return child ? [{ id: child.id, name: child.name }] : [];
        }),
        subjects: input.edit.subjectIds.flatMap((id) => {
          const label = SUBJECTS_BY_ID.get(id);
          return label ? [{ id, label, source: "parent" as const }] : [];
        }),
      }),
    };
  });
}
