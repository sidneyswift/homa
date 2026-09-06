import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareWithAccess, selectedPrintPages, type PrintAccess } from "./print-preparation";
import { PRINT_FIXTURE_ID as id, printFixtureActive as active, printFixtureMaterial as material } from "./print-fixture";

const options = { materialId: id, copies: 2, includeAnswerKey: false };
function access(changes: Partial<PrintAccess> = {}): PrintAccess {
  return { active: async () => active, material: async () => material, finalize: async () => { throw new Error("unexpected finalization"); }, ...changes };
}
for (const [name, count, roles, expected] of [
  ["single answer key", 1, ["answer_key"], []], ["single child", 1, ["child"], [0]],
  ["single legacy", 1, null, [0]], ["no answer key", 2, ["child", "parent_guide"], [0,1]],
  ["noncontiguous", 4, ["child", "answer_key", "child", "answer_key"], [0,2]],
  ["only answer keys", 2, ["answer_key", "answer_key"], []], ["unlabelled packet", 2, null, null],
  ["partial roles", 2, ["child"], null], ["invalid count", 0, [], null], ["fraction count", 1.5, null, null],
] as const) test(`selection: ${name}`, () => assert.deepEqual(selectedPrintPages({ pageCount: count, pageRoles: roles, includeAnswerKey: false }), expected));
test("keeps no-answer-key file without claiming exclusion", async () => {
  const result = await prepareWithAccess({ ...options, access: access({ active: async () => ({ ...active, pageRoles: ["child", "child", "parent_guide"] }) }) });
  assert.equal(result.ready, true); if (!result.ready) return;
  assert.equal(result.printRequest.answerKeyExcluded, false);
  assert.equal(result.printRequest.includeAnswerKey, false);
  assert.deepEqual(result.printRequest.pageIndexes, [0,1,2]);
});
test("rejects impossible selection before finalization", async () => {
  let finalized = 0;
  for (const roles of [null, ["answer_key", "answer_key", "answer_key"]] as const) {
    const result = await prepareWithAccess({ ...options, access: access({ active: async () => ({ ...active, status: "draft", pageRoles: roles ? [...roles] : null }), finalize: async () => { finalized++; throw new Error("must not run"); } }) });
    assert.equal(result.ready, false);
  }
  assert.equal(finalized, 0);
});
test("finalizes exactly the selected draft and rechecks its final identity", async () => {
  let finalized = false;
  const result = await prepareWithAccess({ ...options, access: access({ active: async () => ({ ...active, status: finalized ? "final" : "draft" }), finalize: async () => { finalized = true; return { finalized: true, transitioned: true, versionsSuperseded: 1, note: "Kept" }; } }) });
  assert.equal(result.ready, true); if (!result.ready) return;
  assert.equal(result.finalizedNow, true); assert.equal(result.versionsSuperseded, 1);
  assert.deepEqual(result.printRequest.pageIndexes, [0,2]);
});
test("stale/foreign lookup never substitutes or finalizes", async () => {
  for (const current of [null, { ...active, id: "33333333-3333-4333-8333-333333333333" }]) assert.equal((await prepareWithAccess({ ...options, access: access({ active: async () => current }) })).ready, false);
});
test("rejects stale, page-shape changes and wrong final row after preparation", async () => {
  for (const after of [null, { ...active, pageRoles: ["child", "child", "answer_key"] as const }, { ...active, status: "draft" as const }]) {
    let calls = 0;
    assert.equal((await prepareWithAccess({ ...options, access: access({ active: async () => ++calls === 1 ? active : after ? { ...after, pageRoles: after.pageRoles ? [...after.pageRoles] : null } : null }) })).ready, false);
  }
  assert.equal((await prepareWithAccess({ ...options, access: access({ material: async () => ({ ...material, id: "33333333-3333-4333-8333-333333333333" }) }) })).ready, false);
});
