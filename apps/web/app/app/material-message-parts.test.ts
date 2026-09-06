import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  materialMessagePartNeedsFallback,
  selectParentVisibleMaterialMessageParts,
} from "./material-message-parts";

function printablePart(material: Record<string, unknown>) {
  return {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "create_printable",
    output: { created: true, material },
  };
}

describe("selectParentVisibleMaterialMessageParts", () => {
  it("keeps one passing card per chain in original part order", () => {
    const selected = selectParentVisibleMaterialMessageParts([
      printablePart({
        id: "math-v1",
        title: "Math facts",
        skill: "addition",
        childName: "Mateo",
        previewUrl: "https://blob.example/math-v1.jpg",
        pdfUrl: "https://blob.example/math-v1.pdf",
        status: "draft",
        revisesId: null,
        reviewPassed: true,
      }),
      { type: "text", text: "I checked both pages." },
      printablePart({
        id: "math-v2",
        title: "Math facts, crowded revision",
        skill: "addition",
        childName: "Mateo",
        previewUrl: "https://blob.example/math-v2.jpg",
        pdfUrl: "https://blob.example/math-v2.pdf",
        status: "draft",
        revisesId: "math-v1",
        reviewPassed: false,
      }),
      printablePart({
        id: "reading-v1",
        title: "Reading practice",
        skill: "short vowels",
        childName: "Mateo",
        previewUrl: "https://blob.example/reading-v1.jpg",
        pdfUrl: "https://blob.example/reading-v1.pdf",
        status: "final",
        revisesId: null,
        reviewPassed: true,
      }),
    ]);

    assert.deepEqual(
      selected.map((entry) => ({
        id: entry.id,
        sourcePartIndex: entry.sourcePartIndex,
        title: entry.material.title,
      })),
      [
        { id: "math-v1", sourcePartIndex: 0, title: "Math facts" },
        {
          id: "reading-v1",
          sourcePartIndex: 3,
          title: "Reading practice",
        },
      ],
    );
  });

  it("supports output-available show and legacy worksheet parts", () => {
    const selected = selectParentVisibleMaterialMessageParts([
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "show_material",
        output: {
          shown: true,
          material: {
            id: "saved-page",
            title: "Saved page",
            skill: null,
            childName: null,
            previewUrl: "https://blob.example/saved.jpg",
            pdfUrl: "https://blob.example/saved.pdf",
            status: "final",
          },
        },
      },
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "create_worksheet",
        output: {
          worksheet: {
            title: "Legacy page",
            previewUrl: "https://blob.example/legacy.jpg",
            pdfUrl: "https://blob.example/legacy.pdf",
          },
        },
      },
      {
        type: "dynamic-tool",
        state: "input-available",
        toolName: "create_printable",
        output: {
          material: {
            id: "still-running",
            title: "Still running",
            previewUrl: "https://blob.example/running.jpg",
            pdfUrl: "https://blob.example/running.pdf",
          },
        },
      },
    ]);

    assert.deepEqual(
      selected.map((entry) => entry.material.title),
      ["Saved page", "Legacy page"],
    );
  });

  it("threads a real material id onto the card for the pdf-open beacon", () => {
    const [selected] = selectParentVisibleMaterialMessageParts([
      printablePart({
        id: "math-v1",
        title: "Math facts",
        skill: "addition",
        childName: "Mateo",
        previewUrl: "https://blob.example/math-v1.jpg",
        pdfUrl: "https://blob.example/math-v1.pdf",
        status: "draft",
        revisesId: null,
        reviewPassed: true,
      }),
    ]);
    assert.equal(selected.material.id, "math-v1");
  });

  it("keeps packet data and rebuilds Family Library links from source ids", () => {
    const [selected] = selectParentVisibleMaterialMessageParts([
      printablePart({
        id: "math-v1",
        title: "Math facts",
        skill: "addition",
        childName: "Mateo",
        previewUrl: "https://blob.example/math-v1.jpg",
        pdfUrl: "https://blob.example/math-v1.pdf",
        pageCount: 2,
        pagePreviewUrls: [
          "https://blob.example/math-v1-p1.jpg",
          "https://blob.example/math-v1-p2.jpg",
        ],
        sources: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            title: "Favorite math workbook",
            libraryUrl: "https://untrusted.example/source",
          },
        ],
        status: "draft",
        reviewPassed: true,
      }),
    ]);
    assert.equal(selected.material.pageCount, 2);
    assert.equal(selected.material.pagePreviewUrls?.length, 2);
    assert.deepEqual(selected.material.sources, [
      {
        id: "30000000-0000-4000-8000-000000000001",
        title: "Favorite math workbook",
        libraryUrl:
          "/app/library?asset=30000000-0000-4000-8000-000000000001",
      },
    ]);
  });

  it("never leaks the synthetic legacy-part id onto the card", () => {
    const [selected] = selectParentVisibleMaterialMessageParts([
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "create_worksheet",
        output: {
          worksheet: {
            title: "Legacy page",
            previewUrl: "https://blob.example/legacy.jpg",
            pdfUrl: "https://blob.example/legacy.pdf",
          },
        },
      },
    ]);
    assert.equal(selected.id, "legacy-part:0");
    assert.equal(selected.material.id, undefined);
  });

  it("requests a Binder fallback only for a successful result with an incomplete card", () => {
    assert.equal(
      materialMessagePartNeedsFallback({
        type: "dynamic-tool",
        state: "output-available",
        toolName: "create_printable",
        output: {
          created: true,
          material: {
            title: "Math facts",
            pdfUrl: "https://blob.example/math.pdf",
          },
        },
      }),
      true,
    );
    assert.equal(
      materialMessagePartNeedsFallback({
        type: "dynamic-tool",
        state: "output-available",
        toolName: "create_printable",
        output: { created: false, note: "Rendering failed" },
      }),
      false,
    );
    assert.equal(
      materialMessagePartNeedsFallback(
        printablePart({
          title: "Math facts",
          previewUrl: "https://blob.example/math.jpg",
          pdfUrl: "https://blob.example/math.pdf",
        }),
      ),
      false,
    );
  });
});

it("within-message cards show the passing revision of a kept material, never its failed intermediate", () => {
  const base = { title: "Synthetic", previewUrl: "https://synthetic.invalid/preview.jpg", pdfUrl: "https://synthetic.invalid/print.pdf", status: "final", reviewPassed: true };
  const parts = [printablePart({ ...base, id: "kept" }), printablePart({ ...base, id: "failed", status: "draft", reviewPassed: false, revisesId: "kept" }), printablePart({ ...base, id: "passing", status: "draft", revisesId: "failed" })];
  assert.deepEqual(selectParentVisibleMaterialMessageParts(parts).map(part => part.id), ["passing"]);
  assert.deepEqual(selectParentVisibleMaterialMessageParts(parts.slice(0, 2)).map(part => part.id), ["kept"]);
});
