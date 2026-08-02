import assert from "node:assert/strict";
import test from "node:test";

import {
  familyAssetLibraryHref,
  familyAssetReferencesForSurface,
  parseFamilyAssetReferenceSnapshots,
} from "./family-asset-reference";

const ASSET_ID = "00000000-0000-4000-8000-000000000001";

test("family source snapshots reject malformed rows and deduplicate ids", () => {
  assert.deepEqual(
    parseFamilyAssetReferenceSnapshots([
      { id: ASSET_ID, title: "  Forest guide  ", sourceLocator: "  Page 8  " },
      { id: ASSET_ID, title: "Duplicate" },
      { id: "not-a-uuid", title: "Bad" },
      null,
    ]),
    [{ id: ASSET_ID, title: "Forest guide", sourceLocator: "Page 8" }],
  );
});

test("surface references deep-link only active sources", () => {
  const snapshots = [{ id: ASSET_ID, title: "Forest guide" }];
  assert.equal(familyAssetLibraryHref(ASSET_ID), `/app/library?asset=${ASSET_ID}`);
  assert.deepEqual(
    familyAssetReferencesForSurface(snapshots, {
      activeAssetIds: new Set([ASSET_ID]),
      siteRoot: "https://thankshoma.com/",
    }),
    [
      {
        id: ASSET_ID,
        title: "Forest guide",
        libraryUrl: `https://thankshoma.com/app/library?asset=${ASSET_ID}`,
      },
    ],
  );
  assert.equal(
    familyAssetReferencesForSurface(snapshots, {
      activeAssetIds: new Set(),
    })[0]?.libraryUrl,
    null,
  );
});
