import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveActiveObject,
  type ActiveObjectReader,
  type ActiveObjectRecord,
} from "./active-object";

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MATERIAL_ID = "11111111-1111-4111-8111-111111111111";

function reader(records: ReadonlyMap<string, ActiveObjectRecord>): ActiveObjectReader {
  return {
    async read(familyId, reference) {
      return records.get(`${familyId}:${reference.kind}:${reference.objectId}`) ?? null;
    },
  };
}

const record: ActiveObjectRecord = {
  kind: "material",
  objectId: MATERIAL_ID,
  version: "v2",
  summary: { title: "Mia's fraction garden", childId: "child-1" },
};

describe("authenticated active object resolution", () => {
  it("returns bounded context for the exact family object", async () => {
    const result = await resolveActiveObject(
      FAMILY_A,
      { kind: "material", objectId: MATERIAL_ID, version: "v2" },
      reader(new Map([[`${FAMILY_A}:material:${MATERIAL_ID}`, record]])),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.contextMarkdown, /Mia's fraction garden/u);
    assert.match(result.contextMarkdown, new RegExp(MATERIAL_ID, "u"));
    assert.ok(result.contextMarkdown.length < 4_000);
  });

  it("rejects a stale visible-object version", async () => {
    const result = await resolveActiveObject(
      FAMILY_A,
      { kind: "material", objectId: MATERIAL_ID, version: "v1" },
      reader(new Map([[`${FAMILY_A}:material:${MATERIAL_ID}`, record]])),
    );
    assert.deepEqual(result, { ok: false, reason: "stale" });
  });

  it("fails closed after the visible object is deleted", async () => {
    const result = await resolveActiveObject(
      FAMILY_A,
      { kind: "material", objectId: MATERIAL_ID, version: "v2" },
      reader(new Map()),
    );
    assert.deepEqual(result, { ok: false, reason: "missing" });
  });

  it("fails closed when another family owns the object", async () => {
    const result = await resolveActiveObject(
      FAMILY_A,
      { kind: "material", objectId: MATERIAL_ID, version: "v2" },
      reader(new Map([[`${FAMILY_B}:material:${MATERIAL_ID}`, record]])),
    );
    assert.deepEqual(result, { ok: false, reason: "missing" });
  });
});
