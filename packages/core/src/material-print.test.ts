import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PRINT_PAGES, parseMaterialPrintPart, parsePreparedPrintRequest, parsePreparedPrintResponse, parsePrintPdfQuery, printPageSummary, printPdfPath, refreshPrintHandoff } from "./material-print";

const id = "11111111-1111-4111-8111-111111111111";
const request = { materialId: id, title: "Synthetic name practice", authorizedPdfPath: `/api/materials/${id}/pdf`, pageIndexes: [0, 2], pageCount: 3, copies: 2, includeAnswerKey: false, answerKeyExcluded: true };
const output = { ready: true, material: { id, title: request.title, pageCount: 3, status: "final" }, printRequest: request };
const part = { type: "dynamic-tool", state: "output-available", toolName: "prepare_material_print", output };
test("prepared receipt round trips exact indexes, count, copies and option", () => {
  assert.deepEqual(parsePreparedPrintRequest(request), request);
  const query = new URL(printPdfPath(request), "https://fixture.invalid").searchParams;
  assert.deepEqual(parsePrintPdfQuery(id, query), { ...request, title: "Prepared PDF" });
  assert.equal(printPageSummary(request), "Pages 1, 3 of 3. 2 copies requested. Answer key excluded.");
  assert.equal(printPageSummary({ ...request, pageIndexes: [0,1,2], answerKeyExcluded: false }), "Pages 1-3 of 3. 2 copies requested.");
});
for (const [name, change] of Object.entries({
  "foreign path": { authorizedPdfPath: "/api/materials/22222222-2222-4222-8222-222222222222/pdf" },
  "external path": { authorizedPdfPath: "https://fixture.invalid/file.pdf" },
  "protocol relative": { authorizedPdfPath: "//fixture.invalid/file.pdf" },
  "route suffix": { authorizedPdfPath: `/api/materials/${id}/pdf?anything=1` },
  "invalid ID": { materialId: "../../different" },
  "duplicate index": { pageIndexes: [0,0] }, "out of range": { pageIndexes: [0,3] },
  "descending": { pageIndexes: [2,0] }, "empty": { pageIndexes: [] },
  "fraction": { pageIndexes: [0.5] }, "too many pages": { pageCount: MAX_PRINT_PAGES + 1 },
  "zero copies": { copies: 0 }, "too many copies": { copies: 21 },
  "lying exclusion": { answerKeyExcluded: false }, "contradictory option": { includeAnswerKey: true },
})) test(`receipt refuses ${name}`, () => assert.equal(parsePreparedPrintRequest({ ...request, ...change }), null));
test("legacy receipts remain parseable only with coherent exclusion", () => {
  const { includeAnswerKey: _ignored, ...legacy } = request;
  assert.deepEqual(parsePreparedPrintRequest(legacy), legacy);
  assert.equal(parsePreparedPrintRequest({ ...legacy, pageIndexes: [0], pageCount: 1 }), null);
});
test("tool handoff requires ready, exact material ID, title, pages and final", () => {
  assert.deepEqual(parseMaterialPrintPart(part), { ready: true, request });
  for (const change of [{ ready: undefined }, { ready: false, note: "The exact version is stale." }, { material: { ...output.material, id: "22222222-2222-4222-8222-222222222222" } }, { material: { ...output.material, status: "draft" } }, { material: { ...output.material, pageCount: 99 } }]) assert.equal(parseMaterialPrintPart({ ...part, output: { ...output, ...change } })?.ready, false);
  assert.equal(parseMaterialPrintPart({ ...part, state: "input-available" }), null);
  assert.equal(parsePreparedPrintResponse(output, "22222222-2222-4222-8222-222222222222").ready, false);
});
test("query rejects repeats, extra keys, malformed numbers and oversized indexes", () => {
  for (const mutate of [(q: URLSearchParams) => q.append("copies", "1"), (q: URLSearchParams) => q.set("foreignFamily", "x"), (q: URLSearchParams) => q.set("pageCount", "3junk"), (q: URLSearchParams) => q.set("pages", "0,"), (q: URLSearchParams) => q.set("pages", "0,".repeat(1000)), (q: URLSearchParams) => q.set("includeAnswerKey", "yes")]) {
    const q = new URL(printPdfPath(request), "https://fixture.invalid").searchParams; mutate(q); assert.equal(parsePrintPdfQuery(id, q), null);
  }
});
test("explicit re-preparation preserves options and refuses changed selection", async () => {
  let calls = 0;
  const result = await refreshPrintHandoff(request, async (askedId, options) => { calls++; assert.equal(askedId, id); assert.deepEqual(options, { copies: 2, includeAnswerKey: false }); return output; });
  assert.equal(calls, 1); assert.equal(result.ready, true);
  assert.deepEqual(await refreshPrintHandoff(request, async () => ({ ready: false, note: "Stale, show it again." })), { ready: false, note: "Stale, show it again." });
  assert.equal((await refreshPrintHandoff(request, async () => ({ ...output, printRequest: { ...request, pageIndexes: [0] } }))).ready, false);
  assert.equal((await refreshPrintHandoff(request, async () => { throw new Error("offline"); })).ready, false);
});
