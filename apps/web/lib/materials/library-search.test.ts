import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { z } from "zod";
import { MATERIAL_KINDS } from "./kinds";
import { findMaterialsCaller } from "./library";
import { selectMaterialPages, splitPageBodies } from "./page-shell";

test("actual caller query preserves literal title characters and family scope", async () => {
  let request: URL | undefined;
  const db = createClient("http://material-test.invalid", "synthetic", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => { request = new URL(String(input)); return Response.json([]); } },
  });
  await findMaterialsCaller(db, "synthetic-family", { title: "100%_A*B\\C.[D]", limit: 6 });
  assert.equal(request?.searchParams.get("family_id"), "eq.synthetic-family");
  assert.equal(request?.searchParams.get("deleted_at"), "is.null");
  assert.equal(request?.searchParams.get("title"), "imatch.100%_A\\*B\\\\C\\.\\[D\\]");
});

test("actual tool schema bounds title and both access modes pass it without guessed metadata", async () => {
  const source = readFileSync(new URL("../../agent/tools/find_materials.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const mode of ["caller", "pinned"] as const) {
    const reads: Array<{ family: string; filters: Record<string, unknown> }> = [];
    const search = async (family: string, filters: Record<string, unknown>) => { reads.push({ family, filters }); return []; };
    const modules: Record<string, unknown> = {
      zod: { z },
      "../../lib/agent-tool-deadline": { defineBoundedTool: (tool: unknown) => tool, TOOL_DEADLINE: { quick: 15000 } },
      "../../lib/agent-db": { MissingFamilyContextError: class extends Error {}, resolveAgentAccess: async () => ({ mode, familyId: "owned-family", db: "owned-client" }) },
      "../../lib/materials/artifact-store": { MATERIAL_KINDS },
      "../../lib/materials/library": { findMaterialsPinned: search, findMaterialsCaller: async (db: unknown, family: string, filters: Record<string, unknown>) => { assert.equal(db, "owned-client"); return search(family, filters); } },
      "../../lib/materials/page-shell": { selectMaterialPages, splitPageBodies },
    };
    const exports: Record<string, unknown> = {};
    vm.runInNewContext(code, { exports, require(name: string) { assert.ok(name in modules); return modules[name]; }, console });
    const tool = exports.default as { inputSchema: z.ZodType<Record<string, unknown>>; execute(input: unknown, context: unknown): Promise<{ note: string }> };
    assert.equal(tool.inputSchema.safeParse({ title: " " }).success, false);
    assert.equal(tool.inputSchema.safeParse({ title: "a".repeat(241) }).success, false);
    const input = tool.inputSchema.parse({ title: " Letter Sounds Workbook " });
    const result = await tool.execute(input, { session: { auth: { current: { attributes: {} } } } });
    assert.equal(reads.length, 2, "kept miss retains the existing unfinalized check");
    assert.ok(reads.every((r) => r.family === "owned-family" && r.filters.title === "Letter Sounds Workbook" && r.filters.subject === undefined && r.filters.theme === undefined));
    assert.ok(!result.note.includes("Design fresh"));
  }
});
