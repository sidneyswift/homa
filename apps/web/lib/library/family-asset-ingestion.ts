import { MAP_SUBJECTS, RESEARCH_STAGES } from "@homa/core";
import { z } from "zod";

import {
  FAMILY_ASSET_RESOURCE_KINDS,
  type FamilyAssetResourceKind,
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

const SUBJECT_IDS = new Set(MAP_SUBJECTS.map((subject) => subject.id));
const AGE_BANDS = new Set<string>(RESEARCH_STAGES);

const ingestionEnvelopeSchema = z.object({
  title: z.string().trim().min(1).max(180).nullable(),
  resourceKind: z.enum(FAMILY_ASSET_RESOURCE_KINDS),
  language: z.string().trim().min(2).max(32).nullable(),
  tags: z.array(z.unknown()).max(60),
});

const ingestionTagSchema = z.object({
  kind: z.enum(FAMILY_ASSET_TAG_KINDS),
  value: z.string().trim().min(1).max(160),
  catalogId: z.string().trim().min(1).max(120).nullable(),
  quote: z.string().min(1).max(500),
  sourceLocator: z.string().trim().min(1).max(160).nullable(),
});

export interface VerifiedFamilyAssetTag {
  kind: FamilyAssetTagKind;
  value: string;
  catalogId: string | null;
  quote: string;
  sourceLocator: string | null;
}

export type DroppedFamilyAssetTagReason =
  | "invalid-shape"
  | "quote-not-found"
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
      resourceKind: FamilyAssetResourceKind;
      language: string | null;
      tags: VerifiedFamilyAssetTag[];
      droppedTags: DroppedFamilyAssetTag[];
    };

function catalogIdIsValid(tag: z.infer<typeof ingestionTagSchema>): boolean {
  if (tag.kind === "subject") {
    return tag.catalogId !== null && SUBJECT_IDS.has(tag.catalogId);
  }
  if (tag.kind === "age_band") {
    return tag.catalogId !== null && AGE_BANDS.has(tag.catalogId);
  }
  return tag.catalogId === null;
}

/**
 * The model proposes meaning. This verifier gives that proposal no authority:
 * it validates closed catalogs and proves every tag quote exists verbatim in
 * extracted source text. One bad tag is dropped without discarding good tags.
 */
export function verifyFamilyAssetIngestion(
  proposal: unknown,
  extractedText: string,
): VerifiedFamilyAssetIngestion {
  const envelope = ingestionEnvelopeSchema.safeParse(proposal);
  if (!envelope.success) return { ok: false, reason: "invalid-proposal" };

  const tags: VerifiedFamilyAssetTag[] = [];
  const droppedTags: DroppedFamilyAssetTag[] = [];
  for (const [index, rawTag] of envelope.data.tags.entries()) {
    const parsedTag = ingestionTagSchema.safeParse(rawTag);
    if (!parsedTag.success) {
      droppedTags.push({ index, reason: "invalid-shape" });
      continue;
    }
    const tag = parsedTag.data;
    if (!extractedText.includes(tag.quote)) {
      droppedTags.push({ index, reason: "quote-not-found" });
      continue;
    }
    if (!catalogIdIsValid(tag)) {
      droppedTags.push({
        index,
        reason:
          tag.kind === "subject" || tag.kind === "age_band"
            ? "invalid-catalog-id"
            : "unexpected-catalog-id",
      });
      continue;
    }
    tags.push(tag);
  }

  return {
    ok: true,
    title: envelope.data.title,
    resourceKind: envelope.data.resourceKind,
    language: envelope.data.language,
    tags,
    droppedTags,
  };
}
