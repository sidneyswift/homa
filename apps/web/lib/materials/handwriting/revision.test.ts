import assert from "node:assert/strict";
import { test } from "node:test";

import { prepareHandwritingDocument, type HandwritingPage } from "./document";
import { prepareHandwritingRevision, evaluateHandwritingRevision, legacySvgSources, type HandwritingRevisionSource } from "./revision";
import { evaluateSizeFloor } from "../size-floor";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const old = prepareHandwritingDocument([{ body: "<!-- homa:handwriting old -->", fresh: true, handwritingRows: [{ id: "old", text: "Amalia", style: "pale", capHeight: 128 }] }]);
const render = { status: "verified", pdfSha256: "a".repeat(64), pageCount: 1, pageWidthPoints: 612, pageHeightPoints: 792, placements: [{ page: 1, id: "old", documentRowId: "1/old", x: 60, y: 60, width: 700, height: 248, guideHeightPoints: 96 }] };
const source: HandwritingRevisionSource = { id, html: old.bodies[0], handwritingRows: old.receipts, handwritingRender: render };
const nextPage = (capHeight = 128, page = 1): HandwritingPage => ({ body: "<!-- homa:handwriting new -->", fresh: true, handwritingRows: [{ id: "new", text: "Amalia", style: "dotted", capHeight, predecessor: { kind: "guided", page, rowId: "old" } }] });
const plan = (pages: HandwritingPage[], prior = source, allowSizeReduction = false) => prepareHandwritingRevision({ source: prior, pages, current: prepareHandwritingDocument(pages), allowSizeReduction });
const geom = { page: 1, contentHeightIn: 4, overflowIn: 0, fillPercent: 42, largestTextPx: 28, largestImageIn: { widthIn: 7.29, heightIn: 2.58 }, largestBoxIn: null };

test("128 to112 is caught although the unchanged image-area floor passes", () => {
  assert.equal(evaluateSizeFloor({ revised: { status: "ok", geometry: [geom] }, imagePage: false, next: [{ ...geom, largestImageIn: { widthIn: 7.29, heightIn: 2.26 } }], freshPages: new Set([1]) }).findings.length, 0);
  assert.throws(() => plan([nextPage(112)]), /reduced a saved cap/);
  assert.throws(() => plan([nextPage(127)]), /reduced a saved cap/);
  assert.equal(plan([nextPage(128)]).guided[0].reduced, false);
});
test("a page-count change cannot hide a row's physical reduction", () => {
  const spacer: HandwritingPage = { body: "<p>Practice later</p>", fresh: true };
  assert.throws(() => plan([spacer, nextPage(112)]), /reduced a saved cap/);
  assert.equal(plan([spacer, nextPage(128)]).guided[0].nextDocumentRowId, "2/new");
});
test("renaming the row without predecessor cannot evade coverage", () => {
  const row = nextPage(); delete row.handwritingRows![0].predecessor;
  assert.throws(() => plan([row]), /Every saved guided row/);
  assert.throws(() => plan([nextPage(128, 2)]), /does not exist/);
});
test("a carried row is covered only by exact source material and saved page", () => {
  const carry: HandwritingPage = { body: source.html, fresh: false, carriedRows: old.receipts, carriedPage: 1, carriedMaterialId: id };
  assert.equal(plan([carry]).omittedGuidedRows.length, 0);
  assert.throws(() => plan([{ ...carry, carriedMaterialId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]), /Every saved guided row/);
});
test("canonical JSONB object order is irrelevant, mutations are not", () => {
  const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  assert.equal(plan([nextPage()], { ...source, handwritingRows: reorder(old.receipts), handwritingRender: reorder(render) }).guided.length, 1);
  const mutated = structuredClone(old.receipts); mutated[0].composition.capHeight = 100;
  assert.throws(() => plan([nextPage()], { ...source, handwritingRows: mutated }), /differs from its server receipt/);
});
test("missing or inconsistent saved print proof refuses", () => {
  assert.throws(() => plan([nextPage()], { ...source, handwritingRender: null }), /print receipt is missing/);
  assert.throws(() => plan([nextPage()], { ...source, handwritingRender: { ...render, placements: [{ ...render.placements[0], guideHeightPoints: 84 }] } }), /differs from its composition/);
});
test("explicit existing size authorization records exact reductions and omissions", () => {
  assert.equal(plan([nextPage(112)], source, true).guided[0].reduced, true);
  assert.deepEqual(plan([{ body: "<p>Other work</p>", fresh: true }], source, true).omittedGuidedRows, ["1/old"]);
});
const svg = '<svg viewBox="0 0 700 132" preserveAspectRatio="none"><line x1="0" y1="2" x2="700" y2="2"/><line x1="0" y1="66" x2="700" y2="66"/><line x1="0" y1="130" x2="700" y2="130"/><text x="16" y="129">Amalia</text></svg>';
const legacy: HandwritingRevisionSource = { id, html: `<h1>Keep me</h1>${svg}<p>Unchanged</p>` };
const legacyPage = (): HandwritingPage => ({ body: '<h1>Keep me</h1><!-- homa:handwriting new --><p>Unchanged</p>', fresh: true, handwritingRows: [{ id: "new", text: "Amalia", style: "pale", capHeight: 128, predecessor: { kind: "legacy-svg", page: 1, svgOrdinal: 1 } }] });
test("legacy correspondence binds exact source outside the selected SVG", () => {
  assert.equal(plan([legacyPage()], legacy).legacyTargets.length, 1);
  assert.throws(() => plan([{ ...legacyPage(), body: legacyPage().body.replace("Keep me", "Different") }], legacy), /exact surrounding saved HTML/);
  assert.throws(() => plan([legacyPage(), { body: "<p>Extra</p>", fresh: true }], legacy), /keep its page correspondence/);
  assert.throws(() => legacySvgSources('<svg><svg></svg></svg>'), /cannot be matched/);
});
test("no legacy source/font proof means no exemption, even with size authorization", () => {
  const pages = [legacyPage()]; const current = prepareHandwritingDocument(pages); const p = plan(pages, legacy, true);
  assert.throws(() => evaluateHandwritingRevision({ plan: p, current, previousGeometry: [geom], currentOrdinaryGeometry: [geom], genericFindings: [] }), /normal size floor remains/);
});
