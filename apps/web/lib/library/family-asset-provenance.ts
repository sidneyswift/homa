import { mapDb } from "../map/db";
import {
  MAX_FAMILY_ASSET_REFERENCES,
  parseFamilyAssetReferenceSnapshots,
  type FamilyAssetReferenceSnapshot,
} from "./family-asset-reference";

interface FamilyAssetReferenceRow {
  id: string;
  title: string;
}

interface MaterialFamilySourceRow {
  family_sources: unknown;
}

export interface FamilyAssetProvenanceDependencies {
  loadActive(input: {
    familyId: string;
    assetIds: readonly string[];
  }): Promise<FamilyAssetReferenceRow[]>;
  loadRevision(input: {
    familyId: string;
    materialId: string;
  }): Promise<unknown>;
}

const DEFAULT_DEPENDENCIES: FamilyAssetProvenanceDependencies = {
  async loadActive(input) {
    const sql = mapDb();
    return await sql<FamilyAssetReferenceRow[]>`
      select id, title
      from public.family_assets
      where family_id = ${input.familyId}
        and id in ${sql(input.assetIds)}
        and deleted_at is null
    `;
  },
  async loadRevision(input) {
    const sql = mapDb();
    const rows = await sql<MaterialFamilySourceRow[]>`
      select generation->'familySources' as family_sources
      from public.materials
      where id = ${input.materialId}
        and family_id = ${input.familyId}
      limit 1
    `;
    return rows[0]?.family_sources ?? null;
  },
};

export type MaterialFamilySourceResolution =
  | { ok: true; sources: FamilyAssetReferenceSnapshot[] }
  | { ok: false; reason: "unknown-source" | "too-many-sources" };

/**
 * Resolves source identity before an expensive render. Explicit ids must be
 * active in this family. An omitted list on a revision inherits the prior
 * canonical snapshots, including a source later removed from Library.
 */
export async function resolveMaterialFamilySources(
  input: {
    familyId: string;
    requestedAssetIds?: readonly string[];
    revisesMaterialId?: string | null;
  },
  dependencies: FamilyAssetProvenanceDependencies = DEFAULT_DEPENDENCIES,
): Promise<MaterialFamilySourceResolution> {
  if (input.requestedAssetIds === undefined) {
    if (!input.revisesMaterialId) return { ok: true, sources: [] };
    const inherited = await dependencies.loadRevision({
      familyId: input.familyId,
      materialId: input.revisesMaterialId,
    });
    return {
      ok: true,
      sources: parseFamilyAssetReferenceSnapshots(inherited),
    };
  }

  const assetIds = [...new Set(input.requestedAssetIds)];
  if (assetIds.length > MAX_FAMILY_ASSET_REFERENCES) {
    return { ok: false, reason: "too-many-sources" };
  }
  if (assetIds.length === 0) return { ok: true, sources: [] };

  const rows = await dependencies.loadActive({
    familyId: input.familyId,
    assetIds,
  });
  const byId = new Map(rows.map((row) => [row.id, row.title]));
  if (byId.size !== assetIds.length) {
    return { ok: false, reason: "unknown-source" };
  }
  return {
    ok: true,
    sources: assetIds.map((id) => ({ id, title: byId.get(id)! })),
  };
}
