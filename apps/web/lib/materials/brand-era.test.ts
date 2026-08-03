import assert from "node:assert/strict";
import test from "node:test";

import {
  hasCurrentMaterialBrand,
  materialArtifactBrand,
  MATERIAL_BRAND_ERA,
  MATERIAL_TARGET_PROFILE,
} from "./brand-era";

test("generated material metadata uses the approved Quiet print profile", () => {
  assert.deepEqual(materialArtifactBrand(), {
    designEra: "quiet-authority-v1",
    targetProfile: "artifact-print",
  });
  assert.equal(MATERIAL_BRAND_ERA, "quiet-authority-v1");
  assert.equal(MATERIAL_TARGET_PROFILE, "artifact-print");
});

test("historical rows without brand metadata remain distinguishable", () => {
  assert.equal(hasCurrentMaterialBrand(undefined), false);
  assert.equal(hasCurrentMaterialBrand({ designEra: "warm-playful-baseline" }), false);
  assert.equal(
    hasCurrentMaterialBrand({
      designEra: "quiet-authority-v1",
      targetProfile: "artifact-print",
    }),
    true,
  );
});
