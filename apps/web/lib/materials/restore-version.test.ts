import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  selectRestorableVersion,
  type RestoreRow,
} from "./restore-version";

function row(index: number, overrides: Partial<RestoreRow> = {}): RestoreRow {
  return {
    id: `version-${index}`,
    family_id: "family-1",
    child_id: null,
    child_name: null,
    title: "Living and non-living things",
    kind: "worksheet",
    skill: "sort living and non-living things",
    subject: "science",
    curriculum: null,
    theme: "Amalia's garden",
    characters: [],
    tags: [],
    html: `<p>Version ${index}</p>`,
    source: "html",
    status: index === 60 ? "final" : "superseded",
    revises: index === 1 ? null : `version-${index - 1}`,
    preview_url: `https://example.test/version-${index}.jpg`,
    created_at: new Date(Date.UTC(2026, 6, 29, 12, index)).toISOString(),
    generation: { pageCount: 1 },
    subject_lesson_id: null,
    ...overrides,
  };
}

describe("selectRestorableVersion", () => {
  const sixtyVersions = Array.from({ length: 60 }, (_value, index) => row(index + 1));

  it("finds a chosen version deep in Amalia's 60-version history", () => {
    const selected = selectRestorableVersion({
      rows: sixtyVersions,
      materialId: "version-60",
      versionOrdinal: 7,
    });
    assert.equal(selected?.id, "version-7");
  });

  it("defaults chat's 'previous version' to the node immediately before the current one", () => {
    const selected = selectRestorableVersion({
      rows: sixtyVersions,
      materialId: "version-60",
    });
    assert.equal(selected?.id, "version-59");
  });

  it("accepts the exact source id selected in the Binder rail", () => {
    const selected = selectRestorableVersion({
      rows: sixtyVersions,
      materialId: "version-60",
      sourceMaterialId: "version-12",
    });
    assert.equal(selected?.id, "version-12");
  });

  it("never crosses into another family's material chain", () => {
    const selected = selectRestorableVersion({
      rows: [...sixtyVersions, row(61, { id: "other", family_id: "family-2", revises: null })],
      materialId: "version-60",
      sourceMaterialId: "other",
    });
    assert.equal(selected, null);
  });

  it("refuses versions from before preview retention and lesson-owned rows", () => {
    assert.equal(
      selectRestorableVersion({
        rows: [
          row(1, { created_at: "2026-07-28T23:59:59.000Z" }),
          row(2),
        ],
        materialId: "version-2",
      }),
      null,
    );
    assert.equal(
      selectRestorableVersion({
        rows: [row(1, { subject_lesson_id: "lesson-1" }), row(2)],
        materialId: "version-2",
      }),
      null,
    );
  });
});
