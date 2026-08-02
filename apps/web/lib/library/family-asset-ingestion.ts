import { MAP_SUBJECTS, RESEARCH_STAGES } from "@homa/core";
import { z } from "zod";

import {
  FAMILY_ASSET_RESOURCE_KINDS,
  type FamilyAssetResourceKind,
  type FamilyAssetStatus,
} from "./family-assets";

export const FAMILY_ASSET_TAG_KINDS = [
  "subject",
  "topic",
  "age_band",
  "theme",
  "work",
  "entity",
] as const;

export type FamilyAssetTagKind = (typeof FAMILY_ASSET_TAG_KINDS)[number];

export const FAMILY_ASSET_AGE_BAND_LABELS = {
  early_years: "Early years",
  early_elem: "Early elementary",
  upper_elem: "Upper elementary",
  middle: "Middle school",
  high: "High school",
} as const satisfies Record<(typeof RESEARCH_STAGES)[number], string>;

const SUBJECT_LABELS_BY_ID = new Map(
  MAP_SUBJECTS.map((subject) => [subject.id, subject.displayName]),
);

const sourceAssertionSchema = z.object({
  quote: z.string().min(1).max(500),
  sourceLocator: z.string().trim().min(1).max(160).nullable(),
});

const titleAssertionSchema = sourceAssertionSchema.extend({
  value: z.string().trim().min(1).max(180),
});

const resourceKindAssertionSchema = sourceAssertionSchema.extend({
  value: z.enum(FAMILY_ASSET_RESOURCE_KINDS),
});

export const familyAssetIngestionTagProposalSchema = sourceAssertionSchema.extend({
  kind: z.enum(FAMILY_ASSET_TAG_KINDS),
  value: z.string().trim().min(1).max(160),
  catalogId: z.string().trim().min(1).max(120).nullable(),
});

/** The model-facing schema is strict so the provider returns a useful shape. */
export const familyAssetIngestionProposalSchema = z.object({
  title: titleAssertionSchema.nullable(),
  resourceKind: resourceKindAssertionSchema.nullable(),
  language: z.string().trim().min(2).max(32).nullable(),
  tags: z.array(familyAssetIngestionTagProposalSchema).max(60),
});

export type FamilyAssetIngestionProposal = z.infer<
  typeof familyAssetIngestionProposalSchema
>;

/**
 * The verifier parses semantic fields independently. This is intentionally
 * more permissive than the model schema, so one malformed assertion cannot
 * discard valid siblings from an otherwise usable response.
 */
const ingestionEnvelopeSchema = z.object({
  title: z.unknown(),
  resourceKind: z.unknown(),
  language: z.string().trim().min(2).max(32).nullable(),
  tags: z.array(z.unknown()).max(60),
});

export interface VerifiedFamilyAssetEvidence {
  quote: string;
  sourceLocator: string | null;
}

export interface VerifiedFamilyAssetTag extends VerifiedFamilyAssetEvidence {
  kind: FamilyAssetTagKind;
  value: string;
  catalogId: string | null;
}

export type DroppedFamilyAssetAssertionReason =
  | "invalid-shape"
  | "quote-not-found";

export interface DroppedFamilyAssetField {
  field: "title" | "resourceKind";
  reason: DroppedFamilyAssetAssertionReason;
}

export type DroppedFamilyAssetTagReason =
  | DroppedFamilyAssetAssertionReason
  | "invalid-catalog-id"
  | "unexpected-catalog-id";

export interface DroppedFamilyAssetTag {
  index: number;
  reason: DroppedFamilyAssetTagReason;
}

export type VerifiedFamilyAssetIngestion =
  | { ok: false; reason: "invalid-proposal" }
  | {
      ok: true;
      title: string | null;
      resourceKind: FamilyAssetResourceKind | null;
      language: string | null;
      fieldEvidence: {
        title: VerifiedFamilyAssetEvidence | null;
        resourceKind: VerifiedFamilyAssetEvidence | null;
      };
      tags: VerifiedFamilyAssetTag[];
      droppedFields: DroppedFamilyAssetField[];
      droppedTags: DroppedFamilyAssetTag[];
    };

function quoteAppearsIn(extractedText: string, quote: string): boolean {
  return quote.length > 0 && extractedText.includes(quote);
}

function canonicalTagValue(
  tag: z.infer<typeof familyAssetIngestionTagProposalSchema>,
): { ok: true; value: string } | { ok: false; reason: DroppedFamilyAssetTagReason } {
  if (tag.kind === "subject") {
    if (tag.catalogId === null) {
      return { ok: false, reason: "invalid-catalog-id" };
    }
    const value = SUBJECT_LABELS_BY_ID.get(tag.catalogId);
    return value
      ? { ok: true, value }
      : { ok: false, reason: "invalid-catalog-id" };
  }
  if (tag.kind === "age_band") {
    if (tag.catalogId === null || !(tag.catalogId in FAMILY_ASSET_AGE_BAND_LABELS)) {
      return { ok: false, reason: "invalid-catalog-id" };
    }
    return {
      ok: true,
      value:
        FAMILY_ASSET_AGE_BAND_LABELS[
          tag.catalogId as keyof typeof FAMILY_ASSET_AGE_BAND_LABELS
        ],
    };
  }
  return tag.catalogId === null
    ? { ok: true, value: tag.value }
    : { ok: false, reason: "unexpected-catalog-id" };
}

/**
 * The model proposes meaning. This verifier gives that proposal no authority:
 * it validates closed catalogs and proves every semantic quote exists verbatim
 * in extracted source text. One bad assertion is dropped without discarding
 * valid siblings.
 */
export function verifyFamilyAssetIngestion(
  proposal: unknown,
  extractedText: string,
): VerifiedFamilyAssetIngestion {
  const envelope = ingestionEnvelopeSchema.safeParse(proposal);
  if (!envelope.success) return { ok: false, reason: "invalid-proposal" };

  const droppedFields: DroppedFamilyAssetField[] = [];
  let title: string | null = null;
  let titleEvidence: VerifiedFamilyAssetEvidence | null = null;
  if (envelope.data.title !== null) {
    const parsedTitle = titleAssertionSchema.safeParse(envelope.data.title);
    if (!parsedTitle.success) {
      droppedFields.push({ field: "title", reason: "invalid-shape" });
    } else if (!quoteAppearsIn(extractedText, parsedTitle.data.quote)) {
      droppedFields.push({ field: "title", reason: "quote-not-found" });
    } else {
      title = parsedTitle.data.value;
      titleEvidence = {
        quote: parsedTitle.data.quote,
        sourceLocator: parsedTitle.data.sourceLocator,
      };
    }
  }

  let resourceKind: FamilyAssetResourceKind | null = null;
  let resourceKindEvidence: VerifiedFamilyAssetEvidence | null = null;
  if (envelope.data.resourceKind !== null) {
    const parsedResourceKind = resourceKindAssertionSchema.safeParse(
      envelope.data.resourceKind,
    );
    if (!parsedResourceKind.success) {
      droppedFields.push({ field: "resourceKind", reason: "invalid-shape" });
    } else if (!quoteAppearsIn(extractedText, parsedResourceKind.data.quote)) {
      droppedFields.push({ field: "resourceKind", reason: "quote-not-found" });
    } else {
      resourceKind = parsedResourceKind.data.value;
      resourceKindEvidence = {
        quote: parsedResourceKind.data.quote,
        sourceLocator: parsedResourceKind.data.sourceLocator,
      };
    }
  }

  const tags: VerifiedFamilyAssetTag[] = [];
  const droppedTags: DroppedFamilyAssetTag[] = [];
  for (const [index, rawTag] of envelope.data.tags.entries()) {
    const parsedTag = familyAssetIngestionTagProposalSchema.safeParse(rawTag);
    if (!parsedTag.success) {
      droppedTags.push({ index, reason: "invalid-shape" });
      continue;
    }
    const tag = parsedTag.data;
    if (!quoteAppearsIn(extractedText, tag.quote)) {
      droppedTags.push({ index, reason: "quote-not-found" });
      continue;
    }
    const canonical = canonicalTagValue(tag);
    if (!canonical.ok) {
      droppedTags.push({ index, reason: canonical.reason });
      continue;
    }
    tags.push({ ...tag, value: canonical.value });
  }

  return {
    ok: true,
    title,
    resourceKind,
    language: envelope.data.language,
    fieldEvidence: {
      title: titleEvidence,
      resourceKind: resourceKindEvidence,
    },
    tags,
    droppedFields,
    droppedTags,
  };
}

export const FAMILY_ASSET_INGESTION_FAILURE_KINDS = [
  "unreadable",
  "encrypted",
  "corrupt",
  "unsupported",
] as const;

export type FamilyAssetIngestionFailureKind =
  (typeof FAMILY_ASSET_INGESTION_FAILURE_KINDS)[number];

export interface FamilyAssetIngestionFailureOutcome {
  status: Extract<FamilyAssetStatus, "needs_attention" | "failed">;
  errorCode: string;
  processingNote: string;
  preserveOriginal: true;
}

const FAMILY_ASSET_INGESTION_FAILURE_OUTCOMES = {
  unreadable: {
    status: "needs_attention",
    errorCode: "content_unreadable",
    processingNote:
      "Your original is still in your Library. Homa could not read the words in it. Upload a copy with clearer text.",
    preserveOriginal: true,
  },
  encrypted: {
    status: "needs_attention",
    errorCode: "content_encrypted",
    processingNote:
      "Your original is still in your Library. Remove the password, then upload the file again so Homa can read it.",
    preserveOriginal: true,
  },
  corrupt: {
    status: "failed",
    errorCode: "content_corrupt",
    processingNote:
      "Your original is still in your Library. Homa could not open it. Try opening it on your device. If it opens, save it as a PDF and upload the PDF. If it does not, download or scan a new copy.",
    preserveOriginal: true,
  },
  unsupported: {
    status: "needs_attention",
    errorCode: "content_format_unsupported",
    processingNote:
      "Your original is still in your Library. Homa cannot read this file type. If you want Homa to use it, upload a PDF instead.",
    preserveOriginal: true,
  },
} as const satisfies Record<
  FamilyAssetIngestionFailureKind,
  FamilyAssetIngestionFailureOutcome
>;

export function familyAssetIngestionFailureOutcome(
  kind: FamilyAssetIngestionFailureKind,
): FamilyAssetIngestionFailureOutcome {
  return FAMILY_ASSET_INGESTION_FAILURE_OUTCOMES[kind];
}
