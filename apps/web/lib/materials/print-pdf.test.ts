import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument, PDFArray, PDFRawStream, PDFName, decodePDFRawStream } from "pdf-lib";
import { MAX_PRINT_PDF_BYTES, subsetPrintPdf } from "./print-pdf";
import { downloadPreparedPrint } from "./print-download";
import { createPrintDownloadGet } from "./print-download-handler";
import { printPdfPath } from "@homa/core";
import { PRINT_FIXTURE_ID as id, PRINT_FIXTURE_FAMILY as familyId, printFixtureActive as active, printFixtureMaterial as material, printFixtureRequest as request } from "./print-fixture";

async function fixturePdf() {
  const pdf = await PDFDocument.create();
  for (const text of ["CHILD_ONLY", "ANSWER_KEY_SECRET", "PARENT_GUIDE"]) {
    const page = pdf.addPage([612,792]); page.drawText(text, { x: 40, y: 700, size: 24 });
  }
  return pdf.save({ useObjectStreams: false });
}
async function pageStreams(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const streams = page.node.Contents();
    assert.ok(streams instanceof PDFArray);
    return streams.asArray().map((ref) => {
      const stream = pdf.context.lookup(ref); assert.ok(stream instanceof PDFRawStream);
      return Buffer.from(decodePDFRawStream(stream).decode()).toString("ascii");
    }).join("\n");
  });
}
test("real PDF pages exclude answer content and preserve selected geometry/order", async () => {
  const original = await fixturePdf(); const originalText = await pageStreams(original);
  const output = await subsetPrintPdf(original, request, AbortSignal.timeout(5000));
  assert.deepEqual(await pageStreams(output), [originalText[0], originalText[2]]);
  const reopened = await PDFDocument.load(output);
  assert.equal(reopened.getPageCount(), 2);
  assert.deepEqual(reopened.getPages().map((page) => page.getSize()), [{ width: 612, height: 792 }, { width: 612, height: 792 }]);
  const all = await subsetPrintPdf(original, { ...request, pageIndexes: [0,1,2], includeAnswerKey: true, answerKeyExcluded: false }, AbortSignal.timeout(5000));
  assert.deepEqual(await pageStreams(all), originalText);
});
test("refuses empty, corrupt, encrypted and interactive PDFs", async () => {
  const encrypted = await PDFDocument.create(); encrypted.addPage();
  encrypted.context.trailerInfo.Encrypt = encrypted.context.register(encrypted.context.obj({ Filter: "Standard", V: 1, R: 2, Length: 40 }));
  const empty = await PDFDocument.create();
  const interactive = await PDFDocument.load(await fixturePdf()); interactive.getPage(0).node.set(PDFName.of("Annots"), interactive.context.obj([{ Type: "Annot", Subtype: "Link" }]));
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("%PDF-corrupt\n"), await encrypted.save(), await empty.save({ addDefaultPage: false }), await interactive.save()]) await assert.rejects(subsetPrintPdf(bytes, request, AbortSignal.timeout(5000)));
});
test("bounds actual count, selected cardinality, input bytes, and parser lifetime", async () => {
  const pdf = await fixturePdf();
  await assert.rejects(subsetPrintPdf(pdf, { ...request, pageCount: 2 }, AbortSignal.timeout(5000)));
  await assert.rejects(subsetPrintPdf(pdf, { ...request, pageIndexes: Array.from({ length: 241 }, (_v, i) => i) }, AbortSignal.timeout(5000)));
  await assert.rejects(subsetPrintPdf(new Uint8Array(MAX_PRINT_PDF_BYTES + 1), request, AbortSignal.timeout(5000)));
  await assert.rejects(subsetPrintPdf(pdf, request, AbortSignal.abort()));
  // Interrupt an actual worker after start, not merely a resolved fake.
  const controller = new AbortController(); const work = subsetPrintPdf(pdf, request, controller.signal); controller.abort(); await assert.rejects(work);
});
test("download refuses foreign or stale rows before any fetch", async () => {
  let fetched = 0;
  for (const current of [null, { ...active, id: "33333333-3333-4333-8333-333333333333" }, { ...active, status: "draft" as const }]) {
    const result = await downloadPreparedPrint({ request, signal: AbortSignal.timeout(5000), access: { active: async () => current, material: async () => material, bytes: async () => { fetched++; return fixturePdf(); } } });
    assert.equal(result.ready, false);
  }
  assert.equal(fetched, 0);
});
test("download rechecks revision and artifact identity after subset work", async () => {
  for (const kind of ["revision", "url"]) {
    let downloaded = false;
    const result = await downloadPreparedPrint({ request, signal: AbortSignal.timeout(5000), access: {
      active: async () => downloaded && kind === "revision" ? null : active,
      material: async () => downloaded && kind === "url" ? { ...material, pdfUrl: material.pdfUrl + "changed" } : material,
      bytes: async () => { downloaded = true; return fixturePdf(); },
    } });
    assert.equal(result.ready, false);
  }
});
test("authenticated handler binds family/ID, forbids remote/foreign origins, counts fetch and response bytes", async () => {
  const bytes = await fixturePdf(); const db = {};
  let calls = 0;
  const deps = {
    resolveFamily: async () => ({ familyId, userId: "synthetic", supabase: db }) as never,
    material: async (caller: unknown, family: string, selected: string) => { assert.equal(caller, db); assert.equal(family, familyId); assert.equal(selected, id); return material; },
    active: async (_caller: unknown, family: string, selected: string) => { assert.equal(family, familyId); assert.equal(selected, id); return active; },
    fetch: (async (url: unknown, options: RequestInit) => { calls++; assert.equal(url, material.pdfUrl); assert.equal(options.redirect, "error"); return new Response(Uint8Array.from(bytes)); }) as typeof fetch,
  };
  const url = `https://fixture.invalid${printPdfPath(request)}`;
  const get = createPrintDownloadGet(deps);
  const response = await get(new Request(url), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await PDFDocument.load(await response.arrayBuffer())).getPageCount(), 2); assert.equal(calls, 1);
  const noSession = createPrintDownloadGet({ ...deps, resolveFamily: async () => null });
  assert.equal((await noSession(new Request(url), { params: Promise.resolve({ id }) })).status, 401);
  for (const pdfUrl of ["https://attacker.invalid/a.pdf", material.pdfUrl.replace(familyId, "foreign"), "https://u:p@fixture.public.blob.vercel-storage.com/families/" + familyId + "/a.pdf"]) {
    const handler = createPrintDownloadGet({ ...deps, material: async () => ({ ...material, pdfUrl }) });
    assert.equal((await handler(new Request(url), { params: Promise.resolve({ id }) })).status, 409);
  }
  assert.equal(calls, 1);
  const malformed = new URL(url); malformed.searchParams.append("pages", "1");
  assert.equal((await get(new Request(malformed), { params: Promise.resolve({ id }) })).status, 400);
});
test("handler stops on an aborted request, including an in-flight auth lookup", async () => {
  const controller = new AbortController();
  let finishAuth: (() => void) | undefined;
  let read = false;
  const handler = createPrintDownloadGet({ resolveFamily: () => new Promise((resolve) => { finishAuth = () => resolve({ familyId, userId: "synthetic", supabase: {} } as never); }), material: async () => { read = true; return material; }, active: async () => active, fetch: async () => { throw new Error("No fetch"); } });
  const response = handler(new Request(`https://fixture.invalid${printPdfPath(request)}`, { signal: controller.signal }), { params: Promise.resolve({ id }) });
  controller.abort(); assert.equal((await response).status, 504); finishAuth!();
  await new Promise((resolve) => setTimeout(resolve, 1)); assert.equal(read, false);
});
