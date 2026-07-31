import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  DIMENSION_LABELS,
  dimensionCoverage,
  humanizeKey,
  readAnalysis,
  toReadableNode,
  type ReadableNode,
} from "./library-reader";

/**
 * The library detail view's reader (/admin/library/<id>). The binding
 * property under test is completeness: the corpus has no schema, so the
 * reader must render whatever a drop carries rather than the keys we
 * happened to think of. The corpus sweep at the bottom is what actually
 * enforces that.
 */

function labels(nodes: ReadableNode[]): string[] {
  return nodes.map((node) => node.label);
}

/** Every scalar the tree ends up holding, at any depth. */
function leafValues(nodes: ReadableNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind === "text") out.push(node.value);
    else if (node.kind === "chips") out.push(...node.values);
    else if (node.kind === "section") out.push(...leafValues(node.children));
    else for (const item of node.items) out.push(...leafValues(item.children));
  }
  return out;
}

describe("humanizeKey", () => {
  it("turns camelCase into a sentence", () => {
    assert.equal(humanizeKey("printFormat"), "Print format");
    assert.equal(humanizeKey("ageBand"), "Age band");
    assert.equal(humanizeKey("whiteSpaceRatio"), "White space ratio");
  });

  it("keeps the corpus's acronyms upper case", () => {
    assert.equal(humanizeKey("pdfScanPageCount"), "PDF scan page count");
    assert.equal(humanizeKey("sourceUrl"), "Source URL");
  });

  it("handles snake and kebab keys too", () => {
    assert.equal(humanizeKey("grade_level"), "Grade level");
    assert.equal(humanizeKey("age-band"), "Age band");
  });
});

describe("toReadableNode", () => {
  it("renders scalars as text, with booleans in words", () => {
    assert.deepEqual(toReadableNode("pageCount", 310), {
      kind: "text",
      label: "Page count",
      value: "310",
    });
    assert.deepEqual(toReadableNode("colorOptional", true), {
      kind: "text",
      label: "Color optional",
      value: "yes",
    });
  });

  it("renders a scalar array as chips", () => {
    const node = toReadableNode("coreContent", ["body parts", "five senses"]);
    assert.equal(node?.kind, "chips");
    assert.deepEqual(node.kind === "chips" ? node.values : [], ["body parts", "five senses"]);
  });

  it("renders a nested object as a section, recursively", () => {
    const node = toReadableNode("layout", { structure: "grid", spacing: { ink: "light" } });
    assert.equal(node?.kind, "section");
    if (node?.kind !== "section") return;
    assert.equal(node.label, DIMENSION_LABELS.layout);
    assert.deepEqual(labels(node.children), ["Structure", "Spacing"]);
  });

  it("names list entries from their own content rather than an index", () => {
    const node = toReadableNode("topics", [
      { name: "Counting to ten", kind: "conceptual" },
      { slug: "math.compare", kind: "procedural" },
      // A mapped taxonomy topic carries only id and kind, which is the
      // most common list in the corpus.
      { id: "ela.phonological-awareness", kind: "procedural" },
    ]);
    assert.equal(node?.kind, "entries");
    if (node?.kind !== "entries") return;
    assert.deepEqual(
      node.items.map((item) => item.heading),
      ["Counting to ten", "math.compare", "ela.phonological-awareness"],
    );
  });

  it("falls back to an ordinal only when the entry names itself no other way", () => {
    const node = toReadableNode("things", [{ kind: "procedural", weight: 2 }]);
    assert.equal(node?.kind === "entries" ? node.items[0].heading : null, "Item 1");
  });

  it("drops empty values instead of rendering blank rows", () => {
    assert.equal(toReadableNode("callouts", []), null);
    assert.equal(toReadableNode("notes", ""), null);
    assert.equal(toReadableNode("theming", {}), null);
    assert.equal(toReadableNode("publisher", null), null);
    assert.equal(toReadableNode("nested", { a: [], b: "" }), null);
  });

  it("renames the six ingestion dimensions into plain questions", () => {
    assert.equal(toReadableNode("aboutness", { x: 1 })?.label, "What it is about");
    assert.equal(toReadableNode("skillTargeting", { x: 1 })?.label, "What it teaches");
    assert.equal(toReadableNode("difficulty", { x: 1 })?.label, "How hard it is");
  });
});

describe("readAnalysis", () => {
  it("leads with the named dimensions in the skill's own order", () => {
    const nodes = readAnalysis({
      id: "ref-a",
      zzzExtra: "last",
      printFormat: { pageSize: "letter" },
      overview: { description: "a thing" },
      aboutness: { subjects: ["insects"] },
    });
    assert.deepEqual(labels(nodes), [
      "Overview",
      "What it is about",
      "How it prints",
      "Zzz extra",
    ]);
  });

  it("omits the header keys the page already shows", () => {
    const nodes = readAnalysis({
      id: "ref-a",
      title: "T",
      droppedBy: "sid",
      sourceMessageTs: "123.456",
      custom: "kept",
    });
    assert.deepEqual(labels(nodes), ["Custom"]);
  });

  it("keeps an unknown key rather than dropping it", () => {
    const nodes = readAnalysis({ id: "a", somethingNobodyPlannedFor: "value" });
    assert.deepEqual(labels(nodes), ["Something nobody planned for"]);
  });
});

describe("dimensionCoverage", () => {
  it("reports which of the six dimensions a record actually carries", () => {
    const coverage = dimensionCoverage({ layout: { structure: "grid" }, theming: {} });
    const byLabel = Object.fromEntries(coverage.map((d) => [d.label, d.present]));
    assert.equal(byLabel.Layout, true);
    assert.equal(byLabel.Theming, false, "an empty object is not coverage");
    assert.equal(byLabel.Aboutness, false);
  });

  it("accepts the overall* variant a multi-page drop uses", () => {
    const coverage = dimensionCoverage({ overallLayout: { structure: "sectioned" } });
    assert.equal(coverage.find((d) => d.label === "Layout")?.present, true);
  });

  it("reports nothing present for an unread record", () => {
    assert.ok(dimensionCoverage(null).every((d) => !d.present));
  });
});

describe("the real .cosmo corpus", () => {
  function cosmoDir(): string | null {
    for (const candidate of [
      path.join(process.cwd(), ".cosmo"),
      path.join(process.cwd(), "..", "..", ".cosmo"),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  it("renders every real analysis document without losing its content", async (t) => {
    const root = cosmoDir();
    if (!root) return t.skip("no .cosmo corpus on this checkout");

    const dir = path.join(root, "references");
    const names = (await readdir(dir)).filter((n) => n.startsWith("ref-") && n.endsWith(".json"));
    assert.ok(names.length > 100);

    let renderedSomething = 0;
    for (const name of names) {
      const doc = JSON.parse(await readFile(path.join(dir, name), "utf8"));
      const nodes = readAnalysis(doc);
      if (nodes.length > 0) renderedSomething += 1;

      // No node may carry an empty label, which would render as a
      // headless block the reader cannot interpret.
      for (const node of nodes) {
        assert.ok(node.label.trim().length > 0, `${name} produced an unlabelled section`);
      }

      // Nothing the reader shows may be the literal "[object Object]",
      // the classic sign that a nested value was stringified instead of
      // walked.
      for (const value of leafValues(nodes)) {
        assert.ok(!value.includes("[object Object]"), `${name} stringified a nested object`);
      }
    }
    assert.ok(
      renderedSomething > names.length * 0.9,
      "the reader produced nothing for too many real documents",
    );
  });
});
