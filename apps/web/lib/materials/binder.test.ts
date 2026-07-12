import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MaterialSummary } from "./library";
import type { ChildRecord } from "../family";
import {
  coverMaterials,
  filterMaterials,
  isDefaultFilter,
  kindOptions,
  scopedToViewContext,
  toBinderMaterials,
} from "./binder";

function material(overrides: Partial<MaterialSummary> = {}): MaterialSummary {
  return {
    id: "mat-1",
    title: "Ocean animals letter practice",
    kind: "worksheet",
    status: "final",
    source: "html",
    skill: "letter sounds",
    subject: "Reading",
    curriculum: null,
    theme: "ocean",
    characters: [],
    childId: "child-maya",
    previewUrl: "https://example.com/preview.jpg",
    pdfUrl: "https://example.com/file.pdf",
    createdAt: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

function child(overrides: Partial<ChildRecord> = {}): ChildRecord {
  return {
    id: "child-maya",
    family_id: "family-1",
    name: "Maya",
    birth_month: "2019-03",
    profile: {},
    ...overrides,
  };
}

describe("toBinderMaterials", () => {
  it("resolves the child's name from the family's own children", () => {
    const [binderMaterial] = toBinderMaterials([material()], [child()]);
    assert.equal(binderMaterial.childName, "Maya");
  });

  it("keeps a family-shared material's child name null, not a lookup miss", () => {
    const [binderMaterial] = toBinderMaterials([material({ childId: null })], [child()]);
    assert.equal(binderMaterial.childId, null);
    assert.equal(binderMaterial.childName, null);
  });
});

describe("scopedToViewContext", () => {
  const shared = toBinderMaterials(
    [material({ id: "shared" , childId: null }), material({ id: "mayas", childId: "child-maya" }), material({ id: "theos", childId: "child-theo" })],
    [child(), child({ id: "child-theo", name: "Theo" })],
  );

  it("shows every material in the whole-family view", () => {
    const scoped = scopedToViewContext(shared, { kind: "family" });
    assert.deepEqual(scoped.map((item) => item.id).sort(), ["mayas", "shared", "theos"]);
  });

  it("keeps one child's own materials plus family-shared ones, not a sibling's", () => {
    const scoped = scopedToViewContext(shared, { kind: "child", childId: "child-maya" });
    assert.deepEqual(scoped.map((item) => item.id).sort(), ["mayas", "shared"]);
  });
});

describe("kindOptions", () => {
  it("lists only the kinds present, in the fixed display order", () => {
    const materials = toBinderMaterials(
      [material({ id: "a", kind: "game" }), material({ id: "b", kind: "worksheet" })],
      [child()],
    );
    assert.deepEqual(kindOptions(materials), ["worksheet", "game"]);
  });
});

describe("filterMaterials", () => {
  const materials = toBinderMaterials(
    [
      material({ id: "a", title: "Ocean letters", kind: "worksheet", subject: "Reading" }),
      material({ id: "b", title: "Shape hunt", kind: "game", subject: "Math", theme: "shapes" }),
    ],
    [child()],
  );

  it("narrows by kind first", () => {
    const filtered = filterMaterials(materials, { kind: "game", query: "" });
    assert.deepEqual(filtered.map((item) => item.id), ["b"]);
  });

  it("matches a search term against title, subject, theme, or skill", () => {
    const filtered = filterMaterials(materials, { kind: null, query: "shapes" });
    assert.deepEqual(filtered.map((item) => item.id), ["b"]);
  });

  it("combines kind and search", () => {
    const filtered = filterMaterials(materials, { kind: "worksheet", query: "shapes" });
    assert.deepEqual(filtered, []);
  });
});

describe("isDefaultFilter", () => {
  it("is true only with no kind and an empty query", () => {
    assert.equal(isDefaultFilter({ kind: null, query: "" }), true);
    assert.equal(isDefaultFilter({ kind: null, query: "  " }), true);
    assert.equal(isDefaultFilter({ kind: "worksheet", query: "" }), false);
    assert.equal(isDefaultFilter({ kind: null, query: "ocean" }), false);
  });
});

describe("coverMaterials", () => {
  it("picks the newest items first, capped at count", () => {
    const materials = toBinderMaterials(
      [
        material({ id: "old", createdAt: "2026-07-01T00:00:00.000Z" }),
        material({ id: "new", createdAt: "2026-07-11T00:00:00.000Z" }),
        material({ id: "mid", createdAt: "2026-07-05T00:00:00.000Z" }),
      ],
      [child()],
    );
    assert.deepEqual(
      coverMaterials(materials, 2).map((item) => item.id),
      ["new", "mid"],
    );
  });
});
