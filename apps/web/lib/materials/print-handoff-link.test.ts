import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import { parsePrintPdfQuery, printPdfPath, printPageSummary, type PreparedPrintRequest } from "@homa/core";
import { printSigninUrl } from "./print-handoff-link";
import { safeSameOriginPath } from "../safe-redirect";

const request: PreparedPrintRequest = { materialId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Synthetic packet", authorizedPdfPath: "/api/materials/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pdf", pageIndexes: [0, 2], pageCount: 3, copies: 2, includeAnswerKey: false, answerKeyExcluded: true };
function loadSource(path: string, imports: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  vm.runInNewContext(code, { exports, require(name: string) { assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name]; }, URL, Headers, console });
  return exports;
}
test("SMS link round-trips exact approved material, selected original pages and requested copies", () => {
  const url = new URL(printSigninUrl("https://thankshoma.com", request)!);
  assert.equal(url.origin, "https://thankshoma.com"); assert.equal(url.pathname, "/signin");
  assert.equal(url.searchParams.size, 1); assert.equal(url.searchParams.get("next"), printPdfPath(request));
  const target = new URL(url.searchParams.get("next")!, url);
  const restored = parsePrintPdfQuery(request.materialId, target.searchParams)!;
  assert.deepEqual(restored.pageIndexes, [0, 2]); assert.equal(restored.includeAnswerKey, false);
  assert.equal(restored.answerKeyExcluded, true); assert.equal(restored.copies, 2);
  assert.equal(target.pathname, `/api/materials/${request.materialId}/print/pdf`);
  assert.equal(printSigninUrl("https://other.invalid@thankshoma.com", request), null);
  assert.equal(printSigninUrl("https://thankshoma.com?next=evil", request), null);
  assert.equal(printSigninUrl("http://thankshoma.com", request), null);
  assert.equal(printSigninUrl("https://thankshoma.com", { ...request, authorizedPdfPath: "/api/materials/foreign/pdf" }), null);
});
test("actual signin action preserves the selected-PDF path after one normal password sign-in", async () => {
  let signins = 0; const redirected = Symbol("redirect"); let destination: string | undefined;
  const exported = loadSource("../../app/signin/actions.ts", {
    "next/navigation": { redirect(path: string) { destination = path; throw redirected; } },
    "../../lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { signInWithPassword: async (credentials: unknown) => { assert.equal(JSON.stringify(credentials), JSON.stringify({ email: "synthetic@example.com", password: "synthetic-only" })); signins++; return { error: null }; } } }) },
  });
  const form = new FormData(); form.set("email", "synthetic@example.com"); form.set("password", "synthetic-only"); form.set("next", printPdfPath(request));
  const action = exported.signInAction as (state: unknown, form: FormData) => Promise<unknown>;
  await assert.rejects(action({ error: null }, form), error => error === redirected);
  assert.equal(signins, 1); assert.equal(destination, printPdfPath(request));
});
test("actual signed-in proxy redirects the SMS signin wrapper to the same selected-PDF path", async () => {
  const exported = loadSource("../supabase/session-proxy.ts", {
    "next/server": { NextResponse: { redirect: (url: URL) => ({ url: url.href, cookies: { set() {} }, headers: new Headers() }), next: () => ({ cookies: { set() {} }, headers: new Headers() }) } },
    "../safe-redirect": { safeSameOriginPath },
    "../child-progress/assessment-intent": { ASSESSMENT_PENDING_COOKIE: "test", assessmentActionFromQuery: () => null },
  });
  const create = exported.createSessionProxyHandler as (deps: unknown) => (request: unknown) => Promise<{ url: string }>;
  const handler = create({ hasVerifiedClaims: async () => true });
  const url = new URL(printSigninUrl("https://thankshoma.com", request)!);
  const result = await handler({ method: "GET", headers: new Headers(), nextUrl: url, cookies: { getAll: () => [] } });
  assert.equal(result.url, `https://thankshoma.com${printPdfPath(request)}`);
  assert.equal(safeSameOriginPath("//foreign.invalid/steal"), null);
});

test("actual SMS preparation result carries the exact link and summary without a provider send", async () => {
  let calls = 0;
  const material = { id: request.materialId, title: request.title, status: "final", kind: "packet", skill: null, previewUrl: "https://synthetic.invalid/preview.jpg", pdfUrl: "https://synthetic.invalid/file.pdf", pageCount: 3 };
  let prepared: unknown = { ready: true, finalizedNow: false, versionsSuperseded: 0, material, activeMaterial: { ...material, revisesId: null }, printRequest: request };
  class MissingFamilyContextError extends Error {}
  const exported = loadSource("../../agent/tools/prepare_material_print.ts", {
    zod: { z }, "@homa/core": { printPageSummary },
    "../../lib/agent-tool-deadline": { defineBoundedTool: (input: unknown) => input, TOOL_DEADLINE: { fetch: 90_000 } },
    "../../lib/agent-db": { MissingFamilyContextError, resolveAgentAccess: async () => ({ mode: "pinned", familyId: "synthetic-family" }) },
    "../../lib/map/events": { emitMapEvent: () => { throw new Error("Final replay must not emit"); } },
    "../../lib/map/email": { siteUrl: () => "https://thankshoma.com" },
    "../../lib/materials/print-handoff-link": { printSigninUrl },
    "../../lib/materials/print": { prepareMaterialPrintPinned: async (input: { materialId: string; copies: number; includeAnswerKey: boolean; familyId: string }) => { calls++; assert.equal(input.familyId, "synthetic-family"); assert.equal(input.materialId, request.materialId); assert.equal(input.copies, 2); assert.equal(input.includeAnswerKey, false); return prepared; }, prepareMaterialPrintCaller: () => { throw new Error("Wrong access path"); } },
    "../../lib/model-usage": { usageChannelFromAttributes: () => "sms" },
  });
  const tool = exported.default as { execute(input: unknown, ctx: unknown): Promise<Record<string, unknown>> };
  const args = { materialId: request.materialId, copies: 2, includeAnswerKey: false };
  const context = { session: { auth: { current: { attributes: { channel: "sms" } } } } };
  const result = await tool.execute(args, context);
  assert.equal(calls, 1); assert.equal(result.printUrl, printSigninUrl("https://thankshoma.com", request));
  assert.equal(result.printSummary, "Pages 1, 3 of 3. 2 copies requested. Answer key excluded.");
  assert.equal(result.ready, true);
  prepared = { ready: false, note: "Synthetic stale refusal" };
  const refused = await tool.execute(args, context);
  assert.equal(refused.ready, false); assert.equal(refused.printUrl, undefined); assert.equal(refused.note, "Synthetic stale refusal");
});
