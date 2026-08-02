import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveMaterialFamilySources,
  type FamilyAssetProvenanceDependencies,
} from "./family-asset-provenance";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const SOURCE_A = "00000000-0000-4000-8000-000000000002";
const SOURCE_B = "00000000-0000-4000-8000-000000000003";
const MATERIAL_ID = "00000000-0000-4000-8000-000000000004";

function dependencies(
  overrides: Partial<FamilyAssetProvenanceDependencies> = {},
): FamilyAssetProvenanceDependencies {
  return {
    loadActive: async ({ assetIds }) =>
      assetIds.map((id) => ({
        id,
        title: id === SOURCE_A ? "Forest field guide" : "Pond workbook",
      })),
    loadRevision: async () => [],
    ...overrides,
  };
}

test("explicit family sources are canonical, ordered, and deduplicated", async () => {
  const result = await resolveMaterialFamilySources(
    {
      familyId: FAMILY_ID,
      requestedAssetIds: [SOURCE_B, SOURCE_A, SOURCE_B],
    },
    dependencies(),
  );
  assert.deepEqual(result, {
    ok: true,
    sources: [
      { id: SOURCE_B, title: "Pond workbook" },
      { id: SOURCE_A, title: "Forest field guide" },
    ],
  });
});

test("a foreign, removed, or unknown source fails the whole resolution", async () => {
  const result = await resolveMaterialFamilySources(
    { familyId: FAMILY_ID, requestedAssetIds: [SOURCE_A, SOURCE_B] },
    dependencies({
      loadActive: async () => [{ id: SOURCE_A, title: "Forest field guide" }],
    }),
  );
  assert.deepEqual(result, { ok: false, reason: "unknown-source" });
});

test("a revision inherits canonical source snapshots when the field is omitted", async () => {
  const result = await resolveMaterialFamilySources(
    { familyId: FAMILY_ID, revisesMaterialId: MATERIAL_ID },
    dependencies({
      loadRevision: async () => [
        { id: SOURCE_A, title: "Forest field guide" },
      ],
    }),
  );
  assert.deepEqual(result, {
    ok: true,
    sources: [{ id: SOURCE_A, title: "Forest field guide" }],
  });
});

test("an explicit empty list clears inherited revision sources", async () => {
  let loadedRevision = false;
  const result = await resolveMaterialFamilySources(
    {
      familyId: FAMILY_ID,
      requestedAssetIds: [],
      revisesMaterialId: MATERIAL_ID,
    },
    dependencies({
      loadRevision: async () => {
        loadedRevision = true;
        return [{ id: SOURCE_A, title: "Forest field guide" }];
      },
    }),
  );
  assert.deepEqual(result, { ok: true, sources: [] });
  assert.equal(loadedRevision, false);
});
