import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialPrintPost } from "./print-route";
import { PRINT_FIXTURE_ID as id, PRINT_FIXTURE_FAMILY as familyId, printFixtureActive as active, printFixtureMaterial as material, printFixtureRequest as printRequest } from "./print-fixture";
const db = {};
const auth = async () => ({ familyId, userId: "synthetic", supabase: db }) as never;
const params = { params: Promise.resolve({ id }) };
function request(body: string) { return new Request(`https://fixture.invalid/api/materials/${id}/print`, { method: "POST", headers: { "content-type": "application/json" }, body }); }
test("prepare route rejects unauthenticated, malformed and extra-scope requests before effects", async () => {
  let called = false;
  const deps = { resolveFamily: auth, prepare: async () => { called = true; return { ready: false as const, note: "Not found" }; }, emit: async () => {} };
  assert.equal((await createMaterialPrintPost({ ...deps, resolveFamily: async () => null })(request("{}"), params)).status, 401);
  for (const body of ["bad-json", "null", '{"copies":0}', '{"copies":21}', '{"includeAnswerKey":"false"}', '{"familyId":"foreign"}']) assert.equal((await createMaterialPrintPost(deps)(request(body), params)).status, 400);
  assert.equal(called, false);
});
test("preparation uses only authenticated scope and preserves refusal exactly", async () => {
  let input: unknown;
  const post = createMaterialPrintPost({ resolveFamily: auth, prepare: async (value) => { input = value; return { ready: false, note: "The version is stale. Show it again." }; }, emit: async () => { throw new Error("no event on refusal"); } });
  const response = await post(request('{"copies":2,"includeAnswerKey":false}'), params);
  assert.equal(response.status, 409); assert.deepEqual(input, { db, familyId, materialId: id, copies: 2, includeAnswerKey: false });
  assert.deepEqual(await response.json(), { ready: false, note: "The version is stale. Show it again." });
});
test("re-preparing a final row returns the receipt without duplicate finalization event", async () => {
  let events = 0;
  const post = createMaterialPrintPost({ resolveFamily: auth, prepare: async () => ({ ready: true, finalizedNow: false, versionsSuperseded: 0, material, activeMaterial: active, printRequest }), emit: async () => { events++; } });
  assert.deepEqual(await (await post(request('{"copies":2,"includeAnswerKey":false}'), params)).json(), { ready: true, printRequest });
  assert.equal(events, 0);
});
