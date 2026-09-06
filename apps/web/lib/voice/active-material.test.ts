import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { z } from "zod";
import { printPdfPath, PRINT_STALE_MESSAGE } from "@homa/core";
import { prepareMaterialPrintCaller } from "../materials/print";
import { getMaterialCaller } from "../materials/library";
import { createPrintDownloadGet } from "../materials/print-download-handler";
import { selectParentVisibleMaterialRevisions } from "../materials/parent-visible";

import {
  activeMaterialContext,
  parseActiveMaterialReference,
  parseMaterialPageRoles,
  selectActiveMaterial,
  resolveActiveMaterialCaller,
} from "./active-material";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";

describe("voice active material adapter", () => {
  it("accepts only the narrow typed client reference", () => {
    assert.deepEqual(parseActiveMaterialReference({ kind: "material", id: V1 }), {
      kind: "material",
      id: V1,
    });
    assert.equal(parseActiveMaterialReference({ kind: "plan", id: V1 }), null);
    assert.equal(parseActiveMaterialReference({ kind: "material", id: "other-family" }), null);
  });

  it("resolves only the current parent-visible revision", () => {
    const rows = [
      {
        id: V1,
        title: "First try",
        status: "draft" as const,
        revises: null,
        created_at: "2026-08-01T10:00:00Z",
        review_pass: "true",
        page_count: 2,
        page_roles: ["child", "answer_key"],
      },
      {
        id: V2,
        title: "Shorter directions",
        status: "draft" as const,
        revises: V1,
        created_at: "2026-08-01T11:00:00Z",
        review_pass: "true",
        page_count: 2,
        page_roles: ["child", "answer_key"],
      },
    ];
    assert.equal(selectActiveMaterial(rows, V1), null);
    assert.equal(selectActiveMaterial(rows, V2)?.revisesId, V1);
    const selected = selectActiveMaterial(rows, V2);
    assert.equal(selected?.createdAt, "2026-08-01T11:00:00Z");
    assert.match(activeMaterialContext(selected!), /2:answer_key/u);
  });

  it("rejects page-role metadata unless every page has a closed role", () => {
    assert.deepEqual(parseMaterialPageRoles(["child", "answer_key"], 2), [
      "child",
      "answer_key",
    ]);
    assert.equal(parseMaterialPageRoles(["child"], 2), null);
    assert.equal(parseMaterialPageRoles(["child", "solutions"], 2), null);
  });
});

it("current active authorization accepts a passing descendant of a final and refuses the old ID", () => {
  const final = { id: V1, title: "Kept", status: "final" as const, revises: null, created_at: "2026-09-06T12:00:00Z", review_pass: "false", page_count: 1, page_roles: ["child"] };
  const draft = { ...final, id: V2, title: "Revised", status: "draft" as const, revises: V1, created_at: "2026-09-06T12:01:00Z", review_pass: "true" };
  assert.equal(selectActiveMaterial([final, draft], V1), null);
  assert.equal(selectActiveMaterial([final, draft], V2)?.id, V2);
  assert.equal(selectActiveMaterial([final, { ...draft, review_pass: "false" }], V1)?.id, V1);
  assert.equal(selectActiveMaterial([final, { ...draft, review_pass: "false" }], V2), null);
});


const INVENTORY_FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function inventoryRows(length: number) {
  return Array.from({ length }, (_,index) => ({
    id: index === 0 ? V1 : `00000000-0000-4000-8000-${String(index).padStart(12,"0")}`,
    title: "Synthetic kept worksheet", status: "final" as const, revises: null,
    created_at: "2026-09-06T12:00:00Z", review_pass: "true",
    page_count: 1, page_roles: ["child"],
  }));
}

it("actual caller requires exact same-read inventory count, including a lower server cap", async () => {
  for (const [name, returned, total, expected] of [
    ["normal complete", 1, 1, V1], ["exact 3000 complete", 3000, 3000, V1],
    ["3001 family clipped to 3000", 3000, 3001, null],
    ["server clips below requested limit", 1000, 1001, null],
    ["absent count", 1, null, null], ["smaller count than rows", 2, 1, null],
  ] as const) {
    let reads = 0;
    const db = createClient("http://active-material-test.invalid", "synthetic", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, options) => {
        reads++;
        const url = new URL(String(input));
        assert.equal(url.origin, "http://active-material-test.invalid");
        assert.equal(url.pathname, "/rest/v1/materials");
        assert.equal(url.searchParams.get("family_id"), `eq.${INVENTORY_FAMILY}`);
        assert.equal(url.searchParams.get("limit"), "3000");
        assert.equal(new Headers(options?.headers).get("prefer"), "count=exact");
        return Response.json(inventoryRows(returned), {
          headers: total === null ? {} : { "content-range": `0-${returned-1}/${total}` },
        });
      } },
    });
    assert.equal((await resolveActiveMaterialCaller(db, INVENTORY_FAMILY, V1))?.id ?? null, expected, name);
    assert.equal(reads, 1, `${name}: incomplete inventory never triggers a silent retry`);
  }
});

it("actual pinned function requires the window count from its one family-scoped statement", async () => {
  const source = readFileSync(new URL("./active-material.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [name, returned, total, expected] of [
    ["normal complete", 1, "1", V1], ["exact 3000 complete", 3000, "3000", V1],
    ["3001 family clipped to 3000", 3000, "3001", null],
    ["truncated subset", 1000, "1001", null],
    ["absent count", 1, undefined, null], ["malformed count", 1, "not-a-count", null],
    ["smaller count than rows", 2, "1", null],
  ] as const) {
    let reads = 0;
    const sql = async (parts: TemplateStringsArray, ...values: unknown[]) => {
      reads++;
      const query = parts.join("?").replace(/\s+/gu, " ");
      assert.match(query, /\(count\(\*\) over \(\)\)::text as inventory_count/u);
      assert.match(query, /where family_id = \? order by created_at asc limit \?/u);
      assert.deepEqual(values, [INVENTORY_FAMILY, 3000]);
      return inventoryRows(returned).map(row => ({ ...row, inventory_count: total }));
    };
    const modules: Record<string, unknown> = {
      zod: { z }, "../material-revision-handoff": { ACTIVE_MATERIAL_HEADER: "synthetic" },
      "../materials/parent-visible": { selectParentVisibleMaterialRevisions },
      "../map/db": { mapDb: () => sql },
    };
    const exports: Record<string, unknown> = {};
    vm.runInNewContext(code, { exports, console, require(name: string) {
      assert.ok(Object.hasOwn(modules, name), `Unexpected import ${name}`); return modules[name];
    } });
    const resolve = exports.resolveActiveMaterialPinned as (family: string, id: string) => Promise<{ id: string } | null>;
    assert.equal((await resolve(INVENTORY_FAMILY,V1))?.id ?? null, expected, name);
    assert.equal(reads, 1, `${name}: no separate count snapshot or unbounded retry`);
  }
});


it("actual preparation and selected PDF route refuse an old receipt from a truncated inventory before artifact fetch", async () => {
  for (const [total, serverLimit] of [[3001,3000],[1001,1000]]) {
    const kept = { ...inventoryRows(1)[0]!, family_id: INVENTORY_FAMILY,
      kind: "worksheet", source: "html", characters: [],
      pdf_url: `https://fixture.public.blob.vercel-storage.com/families/${INVENTORY_FAMILY}/materials/synthetic.pdf`,
      preview_url: "fixture:preview" };
    const all = [kept, ...inventoryRows(total-1).slice(1),
      { ...kept, id: V2, revises: V1, status: "draft" as const, created_at: "2026-09-06T12:01:00Z" }];
    assert.equal(all.length, total);
    assert.equal(selectActiveMaterial(all,V1), null, "complete lineage correctly identifies the old final as stale");
    const db = createClient("http://active-material-test.invalid", "synthetic", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input,options) => {
        const url = new URL(String(input));
        assert.equal(options?.method, "GET");
        assert.equal(url.origin, "http://active-material-test.invalid");
        assert.equal(url.pathname, "/rest/v1/materials");
        assert.equal(url.searchParams.get("family_id"), `eq.${INVENTORY_FAMILY}`);
        if (url.searchParams.has("id")) {
          assert.equal(url.searchParams.get("id"), `eq.${V1}`); return Response.json(kept);
        }
        assert.equal(url.searchParams.get("limit"), "3000");
        assert.equal(new Headers(options?.headers).get("prefer"), "count=exact");
        return Response.json(all.slice(0,serverLimit), { headers: { "content-range": `0-${serverLimit-1}/${total}` } });
      } },
    });
    const prepared = await prepareMaterialPrintCaller({ db, familyId: INVENTORY_FAMILY, materialId: V1, copies: 1, includeAnswerKey: true });
    assert.equal(prepared.ready, false);
    if (prepared.ready) throw new Error("Truncated inventory cannot prepare a print");
    assert.equal(prepared.note, PRINT_STALE_MESSAGE);
    let fetched = 0;
    const get = createPrintDownloadGet({
      resolveFamily: async () => ({ familyId: INVENTORY_FAMILY, userId: "synthetic", supabase: db }),
      material: getMaterialCaller, active: resolveActiveMaterialCaller,
      fetch: async () => { fetched++; throw new Error("Incomplete inventory must not fetch an artifact"); },
    });
    const oldRequest = { materialId: V1, title: kept.title, authorizedPdfPath: `/api/materials/${V1}/pdf`, pageCount: 1, pageIndexes: [0], copies: 1, includeAnswerKey: true, answerKeyExcluded: false };
    const response = await get(new Request(`https://fixture.invalid${printPdfPath(oldRequest)}`), { params: Promise.resolve({ id: V1 }) });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).ready, false);
    assert.equal(fetched, 0, "replaying a formerly ready card cannot reach PDF bytes");
  }
});
