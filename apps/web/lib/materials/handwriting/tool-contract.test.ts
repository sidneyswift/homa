import assert from "node:assert/strict";
import test from "node:test";

import { createPrintableInputSchema, buildPrintableGenerationInput, subjectLessonPrintableRestriction, storedPrintableHtmlLimitNote } from "../../../agent/tools/create_printable";
import { prepareHandwritingDocument } from "./document";
import { validatePrintableHtml, joinPageBodies } from "../page-shell";

const html = "<h1>My name</h1><!-- homa:handwriting maya -->";
const row = { id: "maya", text: "Maya", style: "pale", capHeight: 96 };
test("actual tool schema retains typed rows on single pages and fresh packet pages", () => {
  const input = createPrintableInputSchema.parse({ title: "My name", recipe: "name-tracing-page", html, handwritingRows: [row], forgedReceipt: "ignored" });
  assert.deepEqual(input.handwritingRows, [row]);
  assert.equal("forgedReceipt" in input, false);
  const packet = createPrintableInputSchema.parse({ title: "Two pages", pages: [{ html, handwritingRows: [row] }, { fromMaterialId: "11111111-1111-4111-8111-111111111111", pageIndex: 3 }] });
  assert.equal(packet.pages?.[0].handwritingRows?.[0].text, "Maya");
  assert.equal(packet.pages?.[1].pageIndex, 3);
  assert.equal(buildPrintableGenerationInput(input, "html", {}).recipe, "name-tracing-page");
  assert.equal(subjectLessonPrintableRestriction(input, {}), null);
  assert.throws(() => createPrintableInputSchema.parse({ ...input, handwritingRows: [{ ...row, receipt: "forged" }] }));
});
test("encoded row text remains subject to the existing visible-text brand gate", () => {
  const prepared = prepareHandwritingDocument([{ body: html, fresh: true, handwritingRows: [{ ...row, style: "pale", text: "behind" }] }]);
  assert.notEqual(validatePrintableHtml(prepared.bodies[0], prepared.receipts.map((receipt) => receipt.input.text).join(" ")), null);
});

test("actual model-input and stored-source caps apply after outline embedding", () => {
  const styles = ["model", "pale", "dotted", "independent"] as const;
  const handwritingRows = styles.map((style, i) => ({ id: `row-${i}`, text: style === "independent" ? "" : "Amalia", style, capHeight: 96 }));
  const pageHtml = "<h1>My name</h1>" + handwritingRows.map((row) => `<!-- homa:handwriting ${row.id} -->`).join("");
  const input = createPrintableInputSchema.parse({ title: "My name", html: pageHtml, handwritingRows });
  const single = prepareHandwritingDocument([{ body: input.html!, fresh: true, handwritingRows: input.handwritingRows }]);
  assert.ok(JSON.stringify(input).length < 1_000);
  assert.equal(storedPrintableHtmlLimitNote(single.bodies[0]), null);
  assert.equal(storedPrintableHtmlLimitNote(joinPageBodies([single.bodies[0], single.bodies[0]])), null);
  const many = Array.from({ length: 12 }, (_, page) => ({ html: pageHtml.replaceAll("row-", `page-${page}-row-`), handwritingRows: handwritingRows.map((row) => ({ ...row, id: `page-${page}-${row.id}` })) }));
  const packet = createPrintableInputSchema.parse({ title: "Many names", pages: many });
  const expanded = prepareHandwritingDocument(packet.pages!.map((page) => ({ body: page.html!, fresh: true, handwritingRows: page.handwritingRows })));
  assert.ok(JSON.stringify(packet).length < 10_000);
  assert.match(storedPrintableHtmlLimitNote(joinPageBodies(expanded.bodies))!, /storage cap/);
  assert.equal(storedPrintableHtmlLimitNote("x".repeat(118_000)), null);
  assert.notEqual(storedPrintableHtmlLimitNote("x".repeat(118_001)), null);
  assert.equal(createPrintableInputSchema.safeParse({ title: "Over input cap", html: "x".repeat(100_001) }).success, false);
});

test("actual tool accepts only exact predecessor selectors, never model authority", () => {
  const input = createPrintableInputSchema.parse({ title: "Correct my name", revisesId: "11111111-1111-4111-8111-111111111111", html, handwritingRows: [{ ...row, predecessor: { kind: "guided", page: 2, rowId: "original" } }] });
  assert.deepEqual(input.handwritingRows?.[0].predecessor, { kind: "guided", page: 2, rowId: "original" });
  for (const predecessor of [
    { kind: "guided", page: 2, rowId: "original", familyId: "forged" },
    { kind: "guided", page: 2, rowId: "original", capHeight: 64 },
    { kind: "legacy-svg", page: 1, svgOrdinal: 0 },
    { kind: "legacy-svg", page: 13, svgOrdinal: 1 },
    { kind: "legacy-svg", page: 1, svgOrdinal: 1, fontSha256: "forged" },
  ]) assert.throws(() => createPrintableInputSchema.parse({ ...input, handwritingRows: [{ ...row, predecessor }] }));
});
