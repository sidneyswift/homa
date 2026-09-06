import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { softDeleteMaterialCaller } from "./library";
import { insertRestoredMaterialCaller } from "./restore-record";

function rpcClient(data: unknown, error: { message: string } | null = null) {
  const calls: { name: string; args: unknown }[] = [];
  return {
    calls,
    db: { rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data, error };
    } } as unknown as SupabaseClient,
  };
}

describe("Binder removal receipts", () => {
  it("uses the family-scoped chain operation and accepts an idempotent removal", async () => {
    for (const result of ["removed", "already_removed"]) {
      const { db, calls } = rpcClient([{ result, versions_removed: 3 }]);
      assert.equal((await softDeleteMaterialCaller(db, "family", "material")).deleted, true);
      assert.deepEqual(calls, [{ name: "remove_family_material_chain", args: {
        p_family_id: "family", p_material_id: "material",
      } }]);
    }
  });

  it("never claims deletion for missing, protected, malformed or failed results", async () => {
    for (const data of [[{ result: "not_found" }], [{ result: "unsupported" }], [], null, [{ result: "unexpected" }]]) {
      assert.equal((await softDeleteMaterialCaller(rpcClient(data).db, "family", "material")).deleted, false);
    }
    const { db } = rpcClient(null, { message: "fixture RPC unavailable" });
    assert.equal((await softDeleteMaterialCaller(db, "family", "material")).deleted, false);
  });
});

describe("atomic caller restore record", () => {
  const input = {
    familyId: "family", sourceMaterialId: "source", expectedDeletedAt: "2026-09-06 12:00:00.123456+00",
    pdfUrl: "https://example.test/restored.pdf", previewUrl: "https://example.test/restored.jpg",
    generation: { restore: { sourceMaterialId: "source" } }, channel: "web" as const,
  };
  it("passes the original visibility snapshot without rounding and returns only a durable ID", async () => {
    const { db, calls } = rpcClient("new-version");
    assert.deepEqual(await insertRestoredMaterialCaller(db, input), { id: "new-version" });
    assert.deepEqual(calls, [{ name: "restore_family_material_version", args: {
      p_family_id: input.familyId, p_source_material_id: input.sourceMaterialId,
      p_expected_deleted_at: input.expectedDeletedAt, p_pdf_url: input.pdfUrl,
      p_preview_url: input.previewUrl, p_generation: input.generation,
    } }]);
  });
  it("does not claim restoration after a concurrent removal or a database error", async () => {
    assert.equal(await insertRestoredMaterialCaller(rpcClient(null).db, input), null);
    assert.equal(await insertRestoredMaterialCaller(rpcClient(null, { message: "unavailable" }).db, input), null);
  });
});
