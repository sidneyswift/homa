import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { restoreMaterialVersionInputSchema } from "./tools/restore_material_version";

describe("restore_material_version input", () => {
  it("uses the previous version when no rail number is named", () => {
    const parsed = restoreMaterialVersionInputSchema.parse({
      materialId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(parsed.versionOrdinal, undefined);
  });

  it("accepts a deep rail number and rejects zero", () => {
    assert.equal(
      restoreMaterialVersionInputSchema.parse({
        materialId: "11111111-1111-4111-8111-111111111111",
        versionOrdinal: 60,
      }).versionOrdinal,
      60,
    );
    assert.equal(
      restoreMaterialVersionInputSchema.safeParse({
        materialId: "11111111-1111-4111-8111-111111111111",
        versionOrdinal: 0,
      }).success,
      false,
    );
  });
});
