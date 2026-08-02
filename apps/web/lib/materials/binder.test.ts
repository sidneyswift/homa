import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { MaterialSummary } from "./library";
import type { ChildRecord } from "../family";
import {
  binderCover,
  coverMaterials,
  filterMaterials,
  isDefaultFilter,
  kindOptions,
  noResultsMessage,
  scopedToViewContext,
  subjectOptions,
  toBinderMaterials,
} from "./binder";

const BINDER_PAGE_SOURCE = readFileSync(
  new URL("../../app/app/binder/page.tsx", import.meta.url),
  "utf8",
);

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
    pageCount: 1,
    pagePreviewUrls: null,
    sources: [],
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
    avatar_url: null,
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

describe("Binder final-material contract", () => {
  it("keeps the page read scoped to final materials", () => {
    assert.match(BINDER_PAGE_SOURCE, /findMaterialsCaller/u);
    assert.match(
      BINDER_PAGE_SOURCE,
      /status: "final",\s+limit: MAX_FINAL_MATERIALS/u,
    );
    assert.doesNotMatch(BINDER_PAGE_SOURCE, /status: "draft"/u);
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

describe("subjectOptions", () => {
  it("dedupes case-insensitively, keeps the first spelling, sorts alphabetically", () => {
    const materials = toBinderMaterials(
      [
        material({ id: "a", subject: "Reading" }),
        material({ id: "b", subject: "reading" }),
        material({ id: "c", subject: "Math" }),
        material({ id: "d", subject: null }),
        material({ id: "e", subject: "  " }),
      ],
      [child()],
    );
    assert.deepEqual(subjectOptions(materials), [
      { key: "math", label: "Math" },
      { key: "reading", label: "Reading" },
    ]);
  });
});

describe("filterMaterials", () => {
  const materials = toBinderMaterials(
    [
      material({ id: "a", title: "Ocean letters", kind: "worksheet", subject: "Reading" }),
      material({ id: "b", title: "Shape hunt", kind: "game", subject: "Math", theme: "shapes" }),
      material({ id: "c", title: "Number bugs", kind: "worksheet", subject: "math" }),
    ],
    [child()],
  );

  it("narrows by kind first", () => {
    const filtered = filterMaterials(materials, { kind: "game", subject: null, query: "" });
    assert.deepEqual(filtered.map((item) => item.id), ["b"]);
  });

  it("narrows by subject across spellings of the same subject", () => {
    const filtered = filterMaterials(materials, { kind: null, subject: "math", query: "" });
    assert.deepEqual(filtered.map((item) => item.id), ["b", "c"]);
  });

  it("excludes materials without a subject when a subject is chosen", () => {
    const withBlank = toBinderMaterials([material({ id: "z", subject: null })], [child()]);
    const filtered = filterMaterials(withBlank, { kind: null, subject: "math", query: "" });
    assert.deepEqual(filtered, []);
  });

  it("matches a search term against title, subject, theme, or skill", () => {
    const filtered = filterMaterials(materials, { kind: null, subject: null, query: "shapes" });
    assert.deepEqual(filtered.map((item) => item.id), ["b"]);
  });

  it("combines kind, subject, and search", () => {
    const filtered = filterMaterials(materials, {
      kind: "worksheet",
      subject: "math",
      query: "bugs",
    });
    assert.deepEqual(filtered.map((item) => item.id), ["c"]);
    assert.deepEqual(
      filterMaterials(materials, { kind: "worksheet", subject: null, query: "shapes" }),
      [],
    );
  });
});

describe("isDefaultFilter", () => {
  it("is true only with no kind, no subject, and an empty query", () => {
    assert.equal(isDefaultFilter({ kind: null, subject: null, query: "" }), true);
    assert.equal(isDefaultFilter({ kind: null, subject: null, query: "  " }), true);
    assert.equal(isDefaultFilter({ kind: "worksheet", subject: null, query: "" }), false);
    assert.equal(isDefaultFilter({ kind: null, subject: "math", query: "" }), false);
    assert.equal(isDefaultFilter({ kind: null, subject: null, query: "ocean" }), false);
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

describe("binderCover", () => {
  const now = Date.parse("2026-07-12T12:00:00.000Z");

  it("shows only the trailing week under a This week eyebrow when anything is that fresh", () => {
    const materials = toBinderMaterials(
      [
        material({ id: "fresh", createdAt: "2026-07-11T00:00:00.000Z" }),
        material({ id: "stale", createdAt: "2026-06-01T00:00:00.000Z" }),
      ],
      [child()],
    );
    const cover = binderCover(materials, now, 3);
    assert.equal(cover.eyebrow, "This week");
    assert.equal(cover.heading, "What you've kept this week");
    assert.deepEqual(cover.items.map((item) => item.id), ["fresh"]);
  });

  it("caps the this-week items at count, newest first", () => {
    const materials = toBinderMaterials(
      [
        material({ id: "a", createdAt: "2026-07-09T00:00:00.000Z" }),
        material({ id: "b", createdAt: "2026-07-11T00:00:00.000Z" }),
        material({ id: "c", createdAt: "2026-07-10T00:00:00.000Z" }),
      ],
      [child()],
    );
    assert.deepEqual(
      binderCover(materials, now, 2).items.map((item) => item.id),
      ["b", "c"],
    );
  });

  it("falls back to the newest keepers when nothing is recent, label and heading agreeing", () => {
    const materials = toBinderMaterials(
      [
        material({ id: "old", createdAt: "2026-06-01T00:00:00.000Z" }),
        material({ id: "older", createdAt: "2026-05-01T00:00:00.000Z" }),
      ],
      [child()],
    );
    const cover = binderCover(materials, now, 3);
    assert.equal(cover.eyebrow, "Newest");
    assert.equal(cover.heading, "The newest things you've kept");
    assert.deepEqual(cover.items.map((item) => item.id), ["old", "older"]);
  });
});

describe("noResultsMessage", () => {
  it("blames only the search when no chips are on", () => {
    assert.equal(
      noResultsMessage({ kind: null, subject: null, query: "dragons" }),
      "Nothing matches that search. Try a different word.",
    );
  });

  it("names just the one chip that is actually on", () => {
    assert.equal(
      noResultsMessage({ kind: "worksheet", subject: null, query: "dragons" }),
      "Nothing matches that search with the type filter on. Try a different word, or set type back to All.",
    );
    assert.equal(
      noResultsMessage({ kind: null, subject: "math", query: "dragons" }),
      "Nothing matches that search with the subject filter on. Try a different word, or set subject back to All.",
    );
  });

  it("names both chips when both are on", () => {
    assert.equal(
      noResultsMessage({ kind: "worksheet", subject: "math", query: "dragons" }),
      "Nothing matches that search with the type and subject filters on. Try a different word, or set type and subject back to All.",
    );
  });

  it("covers the chips-only cross, which needs both chips to go empty", () => {
    assert.equal(
      noResultsMessage({ kind: "worksheet", subject: "math", query: "  " }),
      "Nothing kept matches both of those together. Set type or subject back to All.",
    );
  });
});
