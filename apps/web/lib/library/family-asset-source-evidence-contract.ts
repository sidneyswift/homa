import { z } from "zod";

import { FAMILY_PDF_EXTRACTION_VERSION, FAMILY_PDF_SOURCE_MAX_PAGES } from "./family-asset-read-contract";

export const MAX_FAMILY_SOURCE_EVIDENCE = 24;
const quote = z.string().min(1).max(500).describe("A verbatim quote from the returned source, not a summary.");
const locator = z.string().min(1).max(160).nullable().describe("The exact saved sourceLocator, or null when no location was recorded.");
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u).describe("The full contentSha256 returned by the source reader.");

export const familySourceEvidenceProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pdf_page").describe("A completed canonical physical PDF page from read_family_curriculum."),
    assetId: z.uuid().describe("The same owned original included in sourceFamilyAssetIds."),
    pageOrdinal: z.int().min(1).max(FAMILY_PDF_SOURCE_MAX_PAGES).describe("Physical PDF ordinal returned by the reader, not a printed page or lesson number."),
    contentSha256: sha256,
    extractionVersion: z.literal(FAMILY_PDF_EXTRACTION_VERSION).describe("The extractionVersion returned by the reader."),
    quote,
  }).strict(),
  z.object({
    kind: z.literal("recorded_evidence").describe("An exact existing evidence entry from get_family_asset, including saved units. This does not claim a fresh page read."),
    assetId: z.uuid().describe("The same owned asset included in sourceFamilyAssetIds."),
    sourceLocator: locator,
    quote,
  }).strict(),
]);
export type FamilySourceEvidenceProposal = z.infer<typeof familySourceEvidenceProposalSchema>;

export const verifiedFamilySourceEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({kind: z.literal("pdf_page"), pageOrdinal: z.int().min(1).max(FAMILY_PDF_SOURCE_MAX_PAGES),
    sourceLocator: z.string().min(1).max(160), contentSha256: sha256,
    extractionVersion: z.string().min(1).max(80), quote,
    method: z.enum(["embedded", "vision"]), state: z.enum(["readable", "partial"]),
    gaps: z.array(z.string().max(500)).max(12),
  }).strict(),
  z.object({kind: z.literal("recorded_evidence"), sourceLocator: locator, quote,
    source: z.enum(["model", "parent", "import", "system"]),
  }).strict(),
]);
export type VerifiedFamilySourceEvidence = z.infer<typeof verifiedFamilySourceEvidenceSchema>;

/** Historical snapshots retain their original extraction version and method. */
export function parseVerifiedFamilySourceEvidence(value: unknown): VerifiedFamilySourceEvidence[] {
  const parsed = z.array(verifiedFamilySourceEvidenceSchema).max(MAX_FAMILY_SOURCE_EVIDENCE).safeParse(value);
  return parsed.success ? parsed.data : [];
}
