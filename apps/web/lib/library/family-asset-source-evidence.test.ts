import assert from "node:assert/strict";
import test from "node:test";

import { TOOL_DEADLINE, ToolDeadlineError } from "../agent-tool-deadline";
import { FAMILY_PDF_EXTRACTION_VERSION } from "./family-asset-read-contract";
import { parseFamilyAssetReferenceSnapshots } from "./family-asset-reference";
import { resolveMaterialFamilySources, type FamilyAssetProvenanceDependencies } from "./family-asset-provenance";
import { resolveFamilySourceEvidence, type FamilySourceEvidenceDependencies } from "./family-asset-source-evidence";
import { familySourceEvidenceProposalSchema, type FamilySourceEvidenceProposal } from "./family-asset-source-evidence-contract";

const FAMILY = "00000000-0000-4000-8000-000000000001";
const ASSET = "00000000-0000-4000-8000-000000000002";
const FOREIGN = "00000000-0000-4000-8000-000000000003";
const SHA = "a".repeat(64);
const QUOTE = "Lesson 12: Compare two groups of up to five counters.";
const proposal = (overrides = {}): FamilySourceEvidenceProposal => ({kind: "pdf_page", assetId: ASSET,
  pageOrdinal: 21, contentSha256: SHA, extractionVersion: FAMILY_PDF_EXTRACTION_VERSION, quote: QUOTE, ...overrides});
function dependencies(overrides: Partial<FamilySourceEvidenceDependencies> = {}): FamilySourceEvidenceDependencies {
  return {
    loadAsset: async (familyId, assetId) => {
      assert.equal(familyId, FAMILY); assert.equal(assetId, ASSET);
      return {id: ASSET, title: "Counter paths", originalName: "counter.pdf", originalUrl: "fixture:original",
        citationUrl: "fixture:citation", libraryUrl: "/app/library", mediaType: "application/pdf", byteSize: 100,
        fileKind: "pdf", resourceKind: "curriculum", authors: [], publisher: null, language: "en", status: "ready",
        processingNote: null, children: [], createdAt: "2026-09-01", updatedAt: "2026-09-01", evidence: [
          {kind: "topic", value: "Compare groups", catalogId: null, quote: QUOTE, sourceLocator: "Unit 12", source: "model"},
          {kind: "work", value: "Counter paths", catalogId: null, quote: "Our counter book", sourceLocator: null, source: "parent"},
        ]};
    },
    loadReady: async (familyId, assetId) => {
      assert.equal(familyId, FAMILY); assert.equal(assetId, ASSET);
      return {ok: true, asset: {id: ASSET, familyId: FAMILY, title: "Counter paths", originalName: "counter.pdf",
        url: "fixture:original", downloadUrl: "fixture:original", mediaType: "application/pdf", byteSize: 100,
        fileKind: "pdf", resourceKind: "curriculum", authors: [], publisher: null, language: "en", atlasId: null,
        contentSha256: SHA, updatedAt: "2026-09-01", uploadedByUserId: null}};
    },
    loadPage: async (source, ordinal) => {
      assert.deepEqual(source, {id: ASSET, familyId: FAMILY, sha256: SHA, url: "fixture:original"});
      assert.equal(ordinal, 21);
      return {ordinal: 21, locator: "Page 21", text: `${QUOTE}\nReview counting three.`, state: "readable", method: "embedded", model: null, gaps: []};
    },
    ...overrides,
  };
}
function materialDependencies(evidence = dependencies()): FamilyAssetProvenanceDependencies {
  return {loadActive: async ({familyId, assetIds}) => {
    assert.equal(familyId, FAMILY); return assetIds.map(id => ({id, title: "Counter paths"}));
  }, loadRevision: async () => [], evidence};
}

test("a physical page quote carries exact current byte identity, method and location", async () => {
  const result = await resolveMaterialFamilySources({familyId: FAMILY, requestedAssetIds: [ASSET], requestedEvidence: [proposal()]}, materialDependencies());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.sources, [{id: ASSET, title: "Counter paths", sourceLocator: "PDF page 21", evidence: [{
    kind: "pdf_page", pageOrdinal: 21, sourceLocator: "Page 21", contentSha256: SHA,
    extractionVersion: FAMILY_PDF_EXTRACTION_VERSION, quote: QUOTE, method: "embedded", state: "readable", gaps: [],
  }]}]);
  assert.deepEqual(parseFamilyAssetReferenceSnapshots(result.sources), result.sources);
});

test("partial source quotes preserve gaps and never become complete page proof", async () => {
  const base = dependencies();
  const result = await resolveFamilySourceEvidence(FAMILY, [proposal()], dependencies({loadPage: async (...args) => ({
    ...(await base.loadPage(...args))!, method: "vision", state: "partial", gaps: ["Lower diagram is illegible."],
  })}));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.byAsset.get(ASSET)?.[0], {kind: "pdf_page", pageOrdinal: 21,
    sourceLocator: "Page 21", contentSha256: SHA, extractionVersion: FAMILY_PDF_EXTRACTION_VERSION,
    quote: QUOTE, method: "vision", state: "partial", gaps: ["Lower diagram is illegible."]});
});

for (const [label, change] of Object.entries({
  "invented quote": {quote: "Lesson 12 teaches multiplication."},
  "different edition bytes": {contentSha256: "b".repeat(64)},
  "wrong extraction version": {extractionVersion: "unverified-v9"},
  "lesson number is not physical page": {pageOrdinal: 12},
})) test(`rejects ${label}`, async () => {
  const base = dependencies();
  const d = dependencies({loadPage: async (source, ordinal) => ordinal === 21 ? base.loadPage(source, ordinal) : null});
  assert.deepEqual(await resolveFamilySourceEvidence(FAMILY, [proposal(change)], d), {ok: false});
});

for (const state of ["blank", "unreadable"] as const) test(`rejects ${state} even with a quote present`, async () => {
  const base = dependencies();
  assert.deepEqual(await resolveFamilySourceEvidence(FAMILY, [proposal()], dependencies({loadPage: async (...args) => ({
    ...(await base.loadPage(...args))!, state,
  })})), {ok: false});
});

test("missing/computing/stale cache page cannot be replaced by a model's plausible quote", async () => {
  assert.deepEqual(await resolveFamilySourceEvidence(FAMILY, [proposal()], dependencies({loadPage: async () => null})), {ok: false});
});

test("wrong returned family or source id fails before page lookup", async () => {
  const base = dependencies();
  for (const patch of [{familyId: FOREIGN}, {id: FOREIGN}]) {
    let reads = 0;
    const result = await resolveFamilySourceEvidence(FAMILY, [proposal()], dependencies({loadReady: async (...args) => {
      const source = await base.loadReady(...args); assert.equal(source.ok, true);
      return source.ok ? {...source, asset: {...source.asset, ...patch}} : source;
    }, loadPage: async () => { reads++; return null; }}));
    assert.deepEqual(result, {ok: false}); assert.equal(reads, 0);
  }
});

test("unknown/not-ready/not-curriculum/unit source fails closed", async () => {
  for (const reason of ["not-found", "not-ready", "not-curriculum", "curriculum-unit"] as const)
    assert.deepEqual(await resolveFamilySourceEvidence(FAMILY, [proposal()], dependencies({loadReady: async () => ({ok: false, reason})})), {ok: false});
});

test("recorded evidence retains its actual origin, and never claims a fresh page read", async () => {
  const result = await resolveFamilySourceEvidence(FAMILY, [
    {kind: "recorded_evidence", assetId: ASSET, sourceLocator: "Unit 12", quote: QUOTE},
    {kind: "recorded_evidence", assetId: ASSET, sourceLocator: null, quote: "Our counter book"},
  ], dependencies());
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.byAsset.get(ASSET), [
    {kind: "recorded_evidence", sourceLocator: "Unit 12", quote: QUOTE, source: "model"},
    {kind: "recorded_evidence", sourceLocator: null, quote: "Our counter book", source: "parent"},
  ]);
});

test("title match, wrong saved locator, and different returned asset are not source proof", async () => {
  const base = dependencies();
  for (const quote of ["Counter paths", QUOTE]) assert.deepEqual(await resolveFamilySourceEvidence(FAMILY,
    [{kind: "recorded_evidence", assetId: ASSET, sourceLocator: "Page 12", quote}], base), {ok: false});
  assert.deepEqual(await resolveFamilySourceEvidence(FAMILY, [{kind: "recorded_evidence", assetId: ASSET, sourceLocator: "Unit 12", quote: QUOTE}],
    dependencies({loadAsset: async (...args) => ({...(await base.loadAsset(...args))!, id: FOREIGN})})), {ok: false});
});

test("at most 24 proposals, exact quote bounds, and declared source membership are checked before reads", async () => {
  let reads = 0;
  const d = materialDependencies(); d.loadActive = async () => {reads++; return [];};
  for (const input of [
    {requestedAssetIds: [ASSET], requestedEvidence: Array.from({length: 25}, () => proposal())},
    {requestedEvidence: [proposal()]},
    {requestedAssetIds: [FOREIGN], requestedEvidence: [proposal()]},
    {requestedAssetIds: [ASSET], requestedEvidence: [proposal({quote: "x".repeat(501)})]},
  ]) assert.deepEqual(await resolveMaterialFamilySources({familyId: FAMILY, ...input}, d), {ok: false, reason: "invalid-source-evidence"});
  assert.equal(reads, 0);
  assert.equal(familySourceEvidenceProposalSchema.safeParse(proposal({pageOrdinal: 241})).success, false);
});

test("repeated quotes share one canonical page lookup and exact repeated evidence deduplicates", async () => {
  let reads = 0; const base = dependencies();
  const result = await resolveFamilySourceEvidence(FAMILY, [proposal(), proposal(), proposal({quote: "Review counting three."})],
    dependencies({loadPage: async (...args) => {reads++; return base.loadPage(...args);}}));
  assert.equal(reads, 1); assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.byAsset.get(ASSET)?.length, 2);
});

test("revision omission inherits verified historical source even when original was removed; explicit empty clears", async () => {
  const initial = await resolveMaterialFamilySources({familyId: FAMILY, requestedAssetIds: [ASSET], requestedEvidence: [proposal()]}, materialDependencies());
  assert.equal(initial.ok, true); if (!initial.ok) return;
  const d = materialDependencies(); d.loadRevision = async () => initial.sources;
  d.loadActive = async () => {throw new Error("Removed source must not be reread for inherited snapshot");};
  assert.deepEqual(await resolveMaterialFamilySources({familyId: FAMILY, revisesMaterialId: FOREIGN}, d), initial);
  assert.deepEqual(await resolveMaterialFamilySources({familyId: FAMILY, revisesMaterialId: FOREIGN, requestedAssetIds: [], requestedEvidence: []}, d), {ok: true, sources: []});
});

test("legacy source snapshots still parse, malformed nested proof is not promoted", () => {
  assert.deepEqual(parseFamilyAssetReferenceSnapshots([{id: ASSET, title: "Counter paths", evidence: [{kind: "pdf_page", quote: QUOTE}]}]), [{id: ASSET, title: "Counter paths"}]);
});

test("failed source read rejects before a caller can proceed to rendering", async () => {
  let rendered = false;
  await assert.rejects(async () => {
    await resolveMaterialFamilySources({familyId: FAMILY, requestedAssetIds: [ASSET], requestedEvidence: [proposal()]},
      materialDependencies(dependencies({loadPage: async () => {throw new Error("bounded source read failed");}})));
    rendered = true;
  }, /bounded source read failed/u);
  assert.equal(rendered, false);
});


test("malformed canonical gap metadata is refused rather than saved as valid proof", async () => {
  const base = dependencies();
  assert.deepEqual(await resolveFamilySourceEvidence(FAMILY, [proposal()], dependencies({loadPage: async (...args) => ({
    ...(await base.loadPage(...args))!, gaps: Array.from({length: 13}, () => "gap"),
  })})), {ok: false});
});

test("the real inner deadline fails before rendering; a late read remains read-only", async (t) => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  const base = dependencies();
  let release!: () => void; let entered!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  const reachedPage = new Promise<void>(resolve => {entered = resolve;});
  let rendered = false;
  const operation = resolveMaterialFamilySources({familyId: FAMILY, requestedAssetIds: [ASSET], requestedEvidence: [proposal()]},
    materialDependencies(dependencies({loadPage: async (...args) => {
      entered(); await pending; return base.loadPage(...args);
    }}))).then(result => {rendered = result.ok;});
  const rejected = assert.rejects(operation, ToolDeadlineError);
  await reachedPage;
  t.mock.timers.tick(TOOL_DEADLINE.quick);
  await rejected;
  release();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(rendered, false);
});
