import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activeMaterialContext,
  parseActiveMaterialReference,
  parseMaterialPageRoles,
  selectActiveMaterial,
} from "./active-material";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";

describe("voice active material adapter", () => {
  it("accepts only the narrow typed client reference", () => {
    assert.deepEqual(parseActiveMaterialReference({ kind: "material", id: V1 }), {
      kind: "material",
      id: V1,
    });
    assert.equal(parseActiveMaterialReference({ kind: "plan", id: V1 }), null);
    assert.equal(parseActiveMaterialReference({ kind: "material", id: "other-family" }), null);
  });

  it("resolves only the current parent-visible revision", () => {
    const rows = [
      {
        id: V1,
        title: "First try",
        status: "draft" as const,
        revises: null,
        created_at: "2026-08-01T10:00:00Z",
        review_pass: "true",
        page_count: 2,
        page_roles: ["child", "answer_key"],
      },
      {
        id: V2,
        title: "Shorter directions",
        status: "draft" as const,
        revises: V1,
        created_at: "2026-08-01T11:00:00Z",
        review_pass: "true",
        page_count: 2,
        page_roles: ["child", "answer_key"],
      },
    ];
    assert.equal(selectActiveMaterial(rows, V1), null);
    assert.equal(selectActiveMaterial(rows, V2)?.revisesId, V1);
    const selected = selectActiveMaterial(rows, V2);
    assert.equal(selected?.createdAt, "2026-08-01T11:00:00Z");
    assert.match(activeMaterialContext(selected!), /2:answer_key/u);
  });

  it("rejects page-role metadata unless every page has a closed role", () => {
    assert.deepEqual(parseMaterialPageRoles(["child", "answer_key"], 2), [
      "child",
      "answer_key",
    ]);
    assert.equal(parseMaterialPageRoles(["child"], 2), null);
    assert.equal(parseMaterialPageRoles(["child", "solutions"], 2), null);
  });
});
