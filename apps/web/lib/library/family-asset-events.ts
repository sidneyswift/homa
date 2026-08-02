import type { EventProps } from "@homa/core";

import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";

export type FamilyAssetUseKind = EventProps<"library.asset_used">["use_kind"];

interface FamilyAssetUseDependencies {
  assetBelongsToFamily: (assetId: string, familyId: string) => Promise<boolean>;
  emit: (
    name: "library.asset_used",
    props: EventProps<"library.asset_used">,
  ) => Promise<void>;
}

async function emitFamilyAssetUseEvent(
  name: "library.asset_used",
  props: EventProps<"library.asset_used">,
): Promise<void> {
  await emitMapEvent("library.asset_used", props);
}

const defaultDependencies: FamilyAssetUseDependencies = {
  async assetBelongsToFamily(assetId, familyId) {
    const sql = mapDb();
    const rows = await sql<{ one: number }[]>`
      select 1 as one
      from public.family_assets
      where id = ${assetId}
        and family_id = ${familyId}
        and deleted_at is null
      limit 1
    `;
    return rows.length === 1;
  },
  emit: emitFamilyAssetUseEvent,
};

/**
 * The single event boundary for a real Homa use of a family source. Callers
 * still perform their own retrieval, then this helper independently proves
 * the asset belongs to that family before attribution.
 */
export async function emitFamilyAssetUsed(
  input: { familyId: string; assetId: string; useKind: FamilyAssetUseKind },
  dependencies: FamilyAssetUseDependencies = defaultDependencies,
): Promise<boolean> {
  if (!(await dependencies.assetBelongsToFamily(input.assetId, input.familyId))) {
    return false;
  }
  await dependencies.emit("library.asset_used", {
    family_id: input.familyId,
    asset_id: input.assetId,
    use_kind: input.useKind,
  });
  return true;
}
