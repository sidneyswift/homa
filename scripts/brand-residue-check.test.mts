import assert from "node:assert/strict";
import { test } from "node:test";
import { collectBrandResidueFindings, collectLegacyFontPathResidue } from "./brand-residue-check.mts";

test("brand residue guard has no active findings", () => {
  assert.deepEqual(collectLegacyFontPathResidue(), []);
  assert.deepEqual(collectBrandResidueFindings(), []);
});
