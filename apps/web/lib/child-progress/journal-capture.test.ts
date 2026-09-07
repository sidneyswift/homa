import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { ClaimExtractionInput } from "./claim-extraction";
import type { ProposedClaim } from "./claim-validation";
import type { JournalCaptureContext, JournalCaptureResult } from "./journal-capture";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild") as {
  build(options: unknown): Promise<{outputFiles: Array<{text: string}>}>;
};

test("actual capture wires optional context without widening quotes, child scope or lesson behavior", async () => {
  const previousFlag = process.env.HOMA_CLAIM_EXTRACTION_ENABLED;
  const familyId = "00000000-0000-4000-8000-000000000001", childId = "00000000-0000-4000-8000-000000000101", siblingId = "00000000-0000-4000-8000-000000000102";
  const actor = "00000000-0000-4000-8000-000000000002", inbound = "00000000-0000-4000-8000-000000000003";
  const message = "She can do all of that.";
  const previous = {id: "00000000-0000-4000-8000-000000000004", role: "assistant", visibility: "family", member_user_id: actor, channel: "web", content: "Can Maya cut along a straight line?", created_at: "2026-09-05T12:00:00Z", delivered_to_actor: false};
  const request: JournalCaptureContext = {familyId, childId, message, surface: "journal", conversation: {memberUserId: actor, runtimeSessionId: "synthetic-session", inboundMessageId: inbound, channel: "web"}};
  const inputs: ClaimExtractionInput[] = [];
  const reads: string[] = [];
  let proposals: ProposedClaim[] = [];
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.__journalCaptureFixture = {
    extractProgressClaims: async (input: ClaimExtractionInput) => {inputs.push(input); return proposals;},
    mapDb: () => async (chunks: TemplateStringsArray) => {
      const sql = chunks.join("?"); reads.push(sql);
      return sql.includes("from public.children") ? [{id: childId, name: "Maya", birth_date: "2022-08-18"}, {id: siblingId, name: "Nora", birth_date: "2020-01-22"}] : [previous];
    },
  };
  const reset = () => {inputs.length = 0; reads.length = 0; proposals = []; process.env.HOMA_CLAIM_EXTRACTION_ENABLED = "true";};
  try {
    const built = await esbuild.build({entryPoints: [fileURLToPath(new URL("./journal-capture.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", plugins: [{name: "offline-capture-boundaries", setup(build: {
      onResolve(options: {filter: RegExp}, callback: (args: {path: string}) => unknown): void;
      onLoad(options: {filter: RegExp; namespace: string}, callback: () => unknown): void;
    }) {
      build.onResolve({filter: /claim-extraction$|map\/db$/}, args => ({path: args.path, namespace: "fixture"}));
      build.onLoad({filter: /.*/, namespace: "fixture"}, () => ({contents: "export const {extractProgressClaims,mapDb}=globalThis.__journalCaptureFixture;", loader: "js"}));
    }}]});
    const production = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`) as {captureJournalClaims(input: JournalCaptureContext): Promise<JournalCaptureResult>};
    reset();
    assert.deepEqual(await production.captureJournalClaims(request), {claims: [], childIds: []});
    assert.equal(reads.length, 2); assert.equal(inputs.length, 1);
    assert.equal(inputs[0].message, message);
    assert.equal(inputs[0].interpretationContext?.recordingTargetChildId, childId);
    assert.equal(inputs[0].interpretationContext?.previousAssistant?.messageId, previous.id);
    assert.deepEqual(inputs[0].children.map(child => child.childId), [childId, siblingId]);
    reset();
    assert.deepEqual(await production.captureJournalClaims({...request, childId: "foreign"}), {claims: [], childIds: []});
    assert.equal(reads.length, 1); assert.equal(inputs.length, 0);
    reset(); process.env.HOMA_CLAIM_EXTRACTION_ENABLED = "false";
    await production.captureJournalClaims(request); assert.equal(reads.length, 0); assert.equal(inputs.length, 0);
    reset(); await production.captureJournalClaims({...request, surface: "lesson"});
    assert.equal(reads.length, 1); assert.equal(inputs[0].interpretationContext, undefined);
    reset(); proposals = [
      {childId: siblingId, itemId: "fine_motor.cuts-line", answer: "easily", confidence: "high", quote: message},
      {childId, itemId: "fine_motor.cuts-line", answer: "easily", confidence: "high", quote: previous.content},
    ];
    const captured = await production.captureJournalClaims(request);
    assert.deepEqual(captured.childIds, [siblingId]); assert.equal(captured.claims.length, 1); assert.equal(captured.claims[0].quote, message);
  } finally {
    delete globals.__journalCaptureFixture;
    if (previousFlag === undefined) delete process.env.HOMA_CLAIM_EXTRACTION_ENABLED; else process.env.HOMA_CLAIM_EXTRACTION_ENABLED = previousFlag;
  }
});
