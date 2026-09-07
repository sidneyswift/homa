import assert from "node:assert/strict";
import test from "node:test";

import { createPrintableInputSchema } from "../../agent/tools/create_printable";
import { resolveMaterialFamilySources } from "../../lib/library/family-asset-provenance";
import type { FamilySourceEvidenceProposal } from "../../lib/library/family-asset-source-evidence-contract";
import { CASES, CHILD, FAMILY, PAGES, SHA, SHARED, VERSION, fixtureDependencies, fixtureSource } from "./fixtures";

test("controlled next-five case has valid authoring schema and real verified provenance for each physical page", async () => {
  const scenario = CASES.find(row => row.id === "next-five")!;
  const sourceFamilyEvidence: FamilySourceEvidenceProposal[] = scenario.requiredPages.map(pageOrdinal => ({
    kind: "pdf_page", assetId: SHARED, pageOrdinal, contentSha256: SHA, extractionVersion: VERSION,
    quote: PAGES[pageOrdinal].split(". ").slice(0, 2).join(". "),
  }));
  const input = createPrintableInputSchema.parse({title: "Amalia's next five lessons", childId: CHILD,
    pages: scenario.requiredPages.map(pageOrdinal => ({html: `<style>p{font-size:20pt}</style><p>Synthetic lesson fixture ${pageOrdinal}</p>`})),
    pageRoles: ["child", "child", "child", "child", "child"], sourceFamilyAssetIds: [SHARED], sourceFamilyEvidence});
  const result = await resolveMaterialFamilySources({familyId: FAMILY, requestedAssetIds: input.sourceFamilyAssetIds,
    requestedEvidence: input.sourceFamilyEvidence}, {evidence: fixtureDependencies(scenario), loadRevision: async () => [],
    loadActive: async ({familyId, assetIds}) => familyId === FAMILY ? assetIds.filter(id => id === SHARED).map(id => ({id, title: fixtureSource().title})) : []});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.sources[0].evidence?.length, 5);
    assert.equal(result.sources[0].sourceLocator, "PDF page 21, PDF page 22, PDF page 23, PDF page 24, PDF page 25");
  }
});

test("controlled illegible-page fixture cannot verify a guessed lesson quote", async () => {
  const scenario = CASES.find(row => row.id === "partial-read")!;
  const result = await resolveMaterialFamilySources({familyId: FAMILY, requestedAssetIds: [SHARED], requestedEvidence: [{
    kind: "pdf_page", assetId: SHARED, pageOrdinal: 21, contentSha256: SHA, extractionVersion: VERSION,
    quote: "Lesson 12: Compare two groups of up to five counters.",
  }]}, {evidence: fixtureDependencies(scenario), loadRevision: async () => [], loadActive: async () => [{id: SHARED, title: fixtureSource().title}]});
  assert.deepEqual(result, {ok: false, reason: "invalid-source-evidence"});
});
