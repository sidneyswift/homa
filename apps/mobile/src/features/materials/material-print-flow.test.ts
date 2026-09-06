import assert from "node:assert/strict";
import { test } from "node:test";
import { runPrintHandoff } from "./material-print-flow";
const materialId = "11111111-1111-4111-8111-111111111111";
const request = { materialId, title: "Synthetic worksheet", authorizedPdfPath: `/api/materials/${materialId}/pdf`, pageIndexes: [0,2], pageCount: 3, copies: 2, includeAnswerKey: false, answerKeyExcluded: true };
test("native explicit handoff re-prepares and maps original indexes to subset output", async () => {
  const order: string[] = [];
  const result = await runPrintHandoff(request, {
    prepare: async (id, options) => { order.push("prepare"); assert.equal(id, materialId); assert.deepEqual(options, { copies: 2, includeAnswerKey: false }); return { ready: true, printRequest: request }; },
    present: async (input) => { order.push("present"); assert.match(input.path, /\/print\/pdf\?/u); assert.deepEqual(input.pageIndexes, [0,1]); assert.equal(input.requestedCopies, 2); return { status: "canceled" }; },
  });
  assert.deepEqual(order, ["prepare", "present"]); assert.equal(result.status, "canceled");
});
test("stale, foreign, ready-false, changed and offline replies never open the native sheet", async () => {
  let opens = 0;
  for (const body of [{ ready: false, note: "This is stale." }, { printRequest: request }, { ready: true, printRequest: { ...request, materialId: "22222222-2222-4222-8222-222222222222" } }, { ready: true, printRequest: { ...request, pageIndexes: [0] } }]) {
    const result = await runPrintHandoff(request, { prepare: async () => body, present: async () => { opens++; return { status: "completed" }; } }); assert.equal(result.status, "failed");
  }
  assert.equal(opens, 0);
});
test("only the native returned result determines the terminal status", async () => {
  for (const status of ["completed", "canceled", "failed"] as const) {
    const result = await runPrintHandoff(request, { prepare: async () => ({ ready: true, printRequest: request }), present: async () => ({ status }) }); assert.equal(result.status, status); assert.doesNotMatch(result.message, /paper printed/u);
  }
});
