import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { finalizeMaterialCaller, findMaterialsCaller, planMaterialFinalization } from "./library";
import { PRINT_STALE_MESSAGE } from "@homa/core";
const family = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const older = { id: "11111111-1111-4111-8111-111111111111", status: "draft" as const, revises: null, pdf_url: "fixture:old", preview_url: "fixture:preview", title: "Synthetic old draft", approved_at: null, created_at: "2026-09-06T12:00:00.000Z", review_pass: "true" };
const newer = { ...older, id: "22222222-2222-4222-8222-222222222222", revises: older.id, created_at: "2026-09-06T12:01:00.000Z" };
test("opt-in precondition refuses an older draft while explicit Keep stays compatible", () => {
  assert.equal(planMaterialFinalization([older,newer], older.id).result.finalized, true);
  const refused = planMaterialFinalization([older,newer], older.id, { requireCurrentVisible: true });
  assert.equal(refused.result.finalized, false); assert.equal(refused.result.note, PRINT_STALE_MESSAGE); assert.deepEqual(refused.draftRowsToDelete, []);
  assert.equal(planMaterialFinalization([older,newer], newer.id, { requireCurrentVisible: true }).result.finalized, true);
});
test("current predicate permits a passing revision of a final, preserves failed-review exclusion and UUID ties", () => {
  assert.equal(planMaterialFinalization([{ ...older, status: "final", approved_at: older.created_at },newer], older.id, { requireCurrentVisible: true }).result.finalized, false);
  assert.equal(planMaterialFinalization([{ ...older, status: "final", approved_at: older.created_at },newer], newer.id, { requireCurrentVisible: true }).result.finalized, true);
  assert.equal(planMaterialFinalization([{ ...older, status: "final", approved_at: older.created_at, review_pass: "false" },{ ...newer, review_pass: "false" }], older.id, { requireCurrentVisible: true }).result.finalized, true);
  assert.equal(planMaterialFinalization([older,{ ...newer, review_pass: "false" }], older.id, { requireCurrentVisible: true }).result.finalized, true);
  assert.equal(planMaterialFinalization([older,{ ...newer, created_at: older.created_at }], older.id, { requireCurrentVisible: true }).result.finalized, false);
  assert.equal(planMaterialFinalization([{ ...older, created_at: undefined }], older.id, { requireCurrentVisible: true }).result.finalized, false);
  assert.equal(planMaterialFinalization([{ ...older, revises: older.id }], older.id, { requireCurrentVisible: true }).result.finalized, false);
});
test("caller sends opt-in flag and refuses a missing overload without legacy writes", async () => {
  let args: unknown;
  const db = { rpc: async (_name: string, input: unknown) => { args = input; return { data: null, error: { code: "PGRST202", message: "Could not find finalize_family_material" } }; }, from: () => { throw new Error("must never use legacy fallback"); } } as unknown as SupabaseClient;
  const result = await finalizeMaterialCaller(db, family, older.id, async () => { throw new Error("no cleanup"); }, () => false, { requireCurrentVisible: true });
  assert.equal(result.finalized, false); assert.deepEqual(args, { p_family_id: family, p_material_id: older.id, p_require_current_visible: true });
});
test("caller requires the transaction receipt before cleanup or success", async () => {
  for (const current_visible of [false, undefined]) {
    const db = { rpc: async () => ({ data: [{ finalized: true, transitioned: true, title: older.title, versions_superseded: 1, draft_urls: ["fixture:old"], current_visible }], error: null }) } as unknown as SupabaseClient;
    const result = await finalizeMaterialCaller(db, family, older.id, async () => { throw new Error("must not clean"); }, () => false, { requireCurrentVisible: true });
    assert.equal(result.finalized, false);
  }
});

test("the actual Binder caller search keeps the final while a newer draft is available for review", async () => {
  const rows = [{ ...older, status: "final", kind: "worksheet", created_at: older.created_at, page_count: 1, characters: [] }, { ...newer, kind: "worksheet", page_count: 1, characters: [] }];
  const filters: [string, unknown][] = [];
  const query = { select() { return this; }, eq(key: string, value: unknown) { filters.push([key, value]); return this; }, is() { return this; }, order() { return this; }, limit(value: number) { assert.equal(value, 3000); return this; }, then(resolve: (value: unknown) => void) { resolve({ data: rows, error: null }); } };
  const db = { from(table: string) { assert.equal(table, "materials"); return query; } } as unknown as SupabaseClient;
  const found = await findMaterialsCaller(db, family, { status: "final", limit: 10 });
  assert.deepEqual(found.map(row => row.id), [older.id]); assert.deepEqual(filters, [["family_id", family]]);
});
