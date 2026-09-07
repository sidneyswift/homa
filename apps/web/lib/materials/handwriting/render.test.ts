import assert from "node:assert/strict";
import test from "node:test";

import { prepareHandwritingDocument } from "./document";
import { renderPrintableHtml, closePrintableRenderer, SUBJECT_LESSON_RENDER_POLICY } from "../render-page";
import { prepareJobHandwritingPack } from "../../jobs/pack";
import { wrapPrintableDocument } from "../page-shell";

// Local Chromium and PDF raster only. No network assets or credentials.
const enabled = process.env.HOMA_HANDWRITING_RENDER_TEST === "1";
test("guided rows pass the actual print renderer and hostile framing fails before delivery", { skip: !enabled, timeout: 120_000 }, async (t) => {
  const row = { id: "amalia", text: "Amalia", style: "pale" as const, capHeight: 96 };
  const prepared = prepareHandwritingDocument([{ body: "<h1 style='margin:0;height:40px'>My name</h1><!-- homa:handwriting amalia -->", fresh: true, handwritingRows: [row] }]);
  const body = prepared.bodies[0];
  try {
    await assert.rejects(renderPrintableHtml(wrapPrintableDocument([body], "")), /stored server receipts/);
    const good = await renderPrintableHtml(wrapPrintableDocument([body], ""), SUBJECT_LESSON_RENDER_POLICY, prepared.expectations);
    assert.equal(good.renderer, "pdfjs-raster");
    assert.equal(good.pageCount, 1);
    assert.equal(good.handwriting?.placements[0].guideHeightPoints, 72);
    assert.equal(good.handwriting?.placements[0].width, 700);
    assert.equal(good.handwriting?.placements[0].height, 186);
    const cases = [
      ["ancestor scale", `<div style="transform:scale(.8)">${body}</div>`],
      ["print-only scale", `<style>@media print { img { width:350px !important; height:93px !important; } }</style>${body}`],
      ["ancestor crop", `<div style="height:100px;overflow:hidden">${body}</div>`],
      ["paper bottom crop", `<div style="padding-top:800px">${body}</div>`],
      ["mask", `<div style="clip-path:inset(20px)">${body}</div>`],
      ["dimmed ink", `<div style="opacity:.5">${body}</div>`],
      ["image replacement", body.replace("src=\"data:image", "src=\"data:invalid")],
      ["CSS content replacement", `<style>img { content:url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='700'%20height='186'/%3E") }</style>${body}`],
      ["rounded image crop", `<style>img { border-radius:100px }</style>${body}`],
      ["shifted paper", `<style>.homa-sheet-page { margin-left:100px }</style>${body}`],
      ["fixed row repeated on paper", `<div style="position:fixed">${body}</div>`],
      ["page margin shrink", `<style>@page { margin:1in }</style>${body}`],
      ["page size change", `<style>@page { size:A4 }</style>${body}`],
      ["CSS animation", `<style>@keyframes tiny { to { opacity:.5 } } img { animation:tiny 1s infinite }</style>${body}`],
      ["executable carried packet", `<svg onload="document.querySelector('img').width=20"></svg>${body}`],
      ["unexpanded hidden placeholder", `<style>${body}</style>`],
    ];
    for (const [name, html] of cases) await t.test(name, async () => {
      await assert.rejects(renderPrintableHtml(wrapPrintableDocument([html], ""), SUBJECT_LESSON_RENDER_POLICY, prepared.expectations));
    });
    await t.test("job pack offsets authenticated receipts and allows repeated local row IDs across materials", async () => {
      const first = { id: "11111111-1111-4111-8111-111111111111", title: "First", html: body, handwriting_rows: prepared.receipts };
      const other = prepareHandwritingDocument([{ body: "<h1>My name</h1><!-- homa:handwriting amalia -->", fresh: true, handwritingRows: [{ ...row, text: "Maya", style: "dotted" }] }]);
      const second = { id: "22222222-2222-4222-8222-222222222222", title: "Second", html: other.bodies[0], handwriting_rows: other.receipts };
      const pack = prepareJobHandwritingPack([first, second])!;
      assert.deepEqual(pack.bodies, [first.html, second.html]);
      assert.deepEqual(pack.receipts.map((receipt) => receipt.documentRowId), ["1/amalia", "2/amalia"]);
      assert.deepEqual(pack.receipts.map((receipt) => receipt.carriedFrom?.materialId), [first.id, second.id]);
      const printed = await renderPrintableHtml(wrapPrintableDocument(pack.bodies, ""), SUBJECT_LESSON_RENDER_POLICY, pack.expectations);
      assert.equal(printed.pageCount, 2);
      assert.deepEqual(printed.handwriting?.placements.map((placement) => [placement.documentRowId, placement.guideHeightPoints]), [["1/amalia", 72], ["2/amalia", 72]]);
      assert.throws(() => prepareJobHandwritingPack([first, { ...second, handwriting_rows: first.handwriting_rows }]), /differs/);
      assert.throws(() => prepareJobHandwritingPack([{ ...first, html: first.html + first.html }]), /differs/);
      assert.equal(prepareJobHandwritingPack([{ id: first.id, title: "Legacy", html: "<p>Original plain material</p>" }]), null);
      const executable = "<svg onload='document.body.style.zoom=.5'></svg><p>Legacy activity</p>";
      const mixed = prepareJobHandwritingPack([{ id: second.id, title: "Legacy", html: executable }, first])!;
      assert.equal(mixed.bodies[0], executable);
      await assert.rejects(renderPrintableHtml(wrapPrintableDocument(mixed.bodies, ""), SUBJECT_LESSON_RENDER_POLICY, mixed.expectations), /static page content/);
    });
    await t.test("static carried page preserves HTML and actual packet order", async () => {
      const legacy = "<h1>Unchanged page one</h1><svg width='100' height='300'><path d='M0 0L100 300' stroke='black'/></svg>";
      const next = prepareHandwritingDocument([{ body: legacy, fresh: false }, { body, fresh: false, carriedRows: prepared.receipts, carriedPage: 1 }]);
      assert.equal(next.bodies[0], legacy);
      assert.equal(next.bodies[1], body);
      const pdf = await renderPrintableHtml(wrapPrintableDocument(next.bodies, ""), SUBJECT_LESSON_RENDER_POLICY, next.expectations);
      assert.equal(pdf.pageCount, 2);
      assert.equal(pdf.handwriting?.placements[0].page, 2);
      assert.ok(pdf.pageGeometry[0].fillPercent > 25, "SVG painted bottom contributes to the existing empty-page guard");
    });
  } finally { await closePrintableRenderer(); }
});
