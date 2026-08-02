import assert from "node:assert/strict";
import test from "node:test";

import { emitFamilyAssetUsed } from "./family-asset-events";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const ASSET_ID = "00000000-0000-4000-8000-000000000002";

test("a family-scoped Homa use emits the content-free asset event", async () => {
  const emitted: unknown[] = [];
  const result = await emitFamilyAssetUsed(
    { familyId: FAMILY_ID, assetId: ASSET_ID, useKind: "material" },
    {
      assetBelongsToFamily: async () => true,
      emit: async (name, props) => {
        emitted.push({ name, props });
      },
    },
  );
  assert.equal(result, true);
  assert.deepEqual(emitted, [
    {
      name: "library.asset_used",
      props: {
        family_id: FAMILY_ID,
        asset_id: ASSET_ID,
        use_kind: "material",
      },
    },
  ]);
});

test("a foreign or deleted asset is not attributed", async () => {
  let emitted = false;
  const result = await emitFamilyAssetUsed(
    { familyId: FAMILY_ID, assetId: ASSET_ID, useKind: "retrieval" },
    {
      assetBelongsToFamily: async () => false,
      emit: async () => {
        emitted = true;
      },
    },
  );
  assert.equal(result, false);
  assert.equal(emitted, false);
});
