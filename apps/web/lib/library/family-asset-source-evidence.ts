import { TOOL_DEADLINE, withToolDeadline } from "../agent-tool-deadline";
import { FAMILY_PDF_EXTRACTION_VERSION } from "./family-asset-read-contract";
import { getFamilyAssetSource } from "./family-asset-retrieval";
import { getReadyFamilyCurriculum } from "./family-curriculum-source";
import { pdfPageCache } from "./pdf-page-cache";
import {
  familySourceEvidenceProposalSchema, MAX_FAMILY_SOURCE_EVIDENCE, verifiedFamilySourceEvidenceSchema,
  type FamilySourceEvidenceProposal, type VerifiedFamilySourceEvidence,
} from "./family-asset-source-evidence-contract";

export interface FamilySourceEvidenceDependencies {
  loadAsset: typeof getFamilyAssetSource;
  loadReady: typeof getReadyFamilyCurriculum;
  loadPage: typeof pdfPageCache.get;
}
const DEFAULT_DEPENDENCIES: FamilySourceEvidenceDependencies = {
  loadAsset: getFamilyAssetSource,
  loadReady: getReadyFamilyCurriculum,
  loadPage: pdfPageCache.get,
};
type Result = {ok: true; byAsset: Map<string, VerifiedFamilySourceEvidence[]>} | {ok: false};

/** Verifies bounded source evidence before rendering. Reads only: no new OCR,
 * cache leases, metadata corrections, source bind, or progress/Planner writes.
 * The inner deadline rejects before the caller can start an expensive render;
 * a late socket reply can only finish these bounded read-only checks.
 */
export async function resolveFamilySourceEvidence(
  familyId: string,
  proposed: readonly FamilySourceEvidenceProposal[],
  dependencies: FamilySourceEvidenceDependencies = DEFAULT_DEPENDENCIES,
): Promise<Result> {
  if (proposed.length > MAX_FAMILY_SOURCE_EVIDENCE ||
    proposed.some((entry) => !familySourceEvidenceProposalSchema.safeParse(entry).success)) return {ok: false};
  if (!proposed.length) return {ok: true, byAsset: new Map()};
  return withToolDeadline(TOOL_DEADLINE.quick, async () => {
    const byAsset = new Map<string, VerifiedFamilySourceEvidence[]>();
    const assets = new Map<string, Awaited<ReturnType<typeof getFamilyAssetSource>>>();
    const ready = new Map<string, Awaited<ReturnType<typeof getReadyFamilyCurriculum>>>();
    const pages = new Map<string, Awaited<ReturnType<typeof pdfPageCache.get>>>();
    for (const entry of proposed) {
      let verified: VerifiedFamilySourceEvidence;
      if (entry.kind === "recorded_evidence") {
        if (!assets.has(entry.assetId)) assets.set(entry.assetId, await dependencies.loadAsset(familyId, entry.assetId));
        const asset = assets.get(entry.assetId);
        const evidence = asset?.evidence.find((row) => row.quote === entry.quote && row.sourceLocator === entry.sourceLocator);
        if (asset?.id !== entry.assetId || !evidence) return {ok: false} as const;
        verified = {kind: "recorded_evidence", sourceLocator: evidence.sourceLocator, quote: evidence.quote, source: evidence.source};
      } else {
        if (!ready.has(entry.assetId)) ready.set(entry.assetId, await dependencies.loadReady(familyId, entry.assetId));
        const source = ready.get(entry.assetId);
        if (!source?.ok || source.asset.familyId !== familyId || source.asset.id !== entry.assetId ||
          source.asset.mediaType.split(";", 1)[0].trim().toLowerCase() !== "application/pdf" ||
          source.asset.contentSha256 !== entry.contentSha256 || entry.extractionVersion !== FAMILY_PDF_EXTRACTION_VERSION) return {ok: false} as const;
        const key = `${entry.assetId}:${entry.pageOrdinal}`;
        if (!pages.has(key)) pages.set(key, await dependencies.loadPage({id: entry.assetId, familyId,
          url: source.asset.url, sha256: entry.contentSha256}, entry.pageOrdinal));
        const page = pages.get(key);
        if (!page || page.ordinal !== entry.pageOrdinal || page.locator !== `Page ${entry.pageOrdinal}` ||
          (page.state !== "readable" && page.state !== "partial") || !page.text.includes(entry.quote)) return {ok: false} as const;
        verified = {kind: "pdf_page", pageOrdinal: page.ordinal, sourceLocator: page.locator,
          contentSha256: entry.contentSha256, extractionVersion: FAMILY_PDF_EXTRACTION_VERSION,
          quote: entry.quote, method: page.method, state: page.state, gaps: page.gaps};
      }
      if (!verifiedFamilySourceEvidenceSchema.safeParse(verified).success) return {ok: false} as const;
      const entries = byAsset.get(entry.assetId) ?? [];
      if (!entries.some((saved) => JSON.stringify(saved) === JSON.stringify(verified))) entries.push(verified);
      byAsset.set(entry.assetId, entries);
    }
    return {ok: true, byAsset} as const;
  }, true);
}
