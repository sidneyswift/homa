import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectParentVisibleMaterialMessageParts } from "./material-message-parts";

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
});
