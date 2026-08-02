import { MAP_SUBJECTS } from "@homa/core";
import { z } from "zod";

import {
  FAMILY_ASSET_RESOURCE_KINDS,
  FAMILY_ASSET_STATUSES,
  type FamilyAssetChild,
  type FamilyAssetResourceKind,
  type FamilyAssetStatus,
  type FamilyAssetView,
} from "./family-assets";

export const FAMILY_ASSET_WHOLE_FAMILY_CHILD = "family";

export const FAMILY_ASSET_DELETE_CONSEQUENCE =
  "Homa will delete the saved original and its Library details: title, resource type, author, publisher, children, and subjects. The file on your device stays. Anything already in Binder stays there.";

const SUBJECT_IDS = new Set(MAP_SUBJECTS.map((subject) => subject.id));

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

const uniqueUuidArray = z
  .array(z.string().uuid())
  .max(50)
  .refine(uniqueStrings, "IDs must be unique");

const subjectIdSchema = z
  .string()
  .refine((value) => SUBJECT_IDS.has(value), "Unknown subject");

export const familyAssetUpdateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(180),
    resourceKind: z.enum(FAMILY_ASSET_RESOURCE_KINDS).nullable(),
    childIds: uniqueUuidArray,
    subjectIds: z
      .array(subjectIdSchema)
      .max(MAP_SUBJECTS.length)
      .refine(uniqueStrings, "Subjects must be unique"),
  })
  .strict();

export type FamilyAssetUpdate = z.infer<typeof familyAssetUpdateSchema>;

export interface FamilyAssetFilter {
  query: string;
  resourceKind: FamilyAssetResourceKind | null;
  childId: string | null;
  subjectId: string | null;
  status: FamilyAssetStatus | null;
}

export interface FamilyAssetFilterOptions {
  resourceKinds: FamilyAssetResourceKind[];
  children: FamilyAssetChild[];
  subjects: Array<{ id: string; label: string }>;
  statuses: FamilyAssetStatus[];
}

export interface FamilyLibraryAccess {
  canUpload: boolean;
  redirectToTrial: boolean;
}

export function familyLibraryAccess(input: {
  walled: boolean;
  hasExistingRecords: boolean;
}): FamilyLibraryAccess {
  return {
    canUpload: !input.walled,
    redirectToTrial: input.walled && !input.hasExistingRecords,
  };
}

function searchText(asset: FamilyAssetView): string {
  return [
    asset.title,
    asset.originalName,
    asset.publisher,
    ...asset.authors,
    ...asset.children.map((child) => child.name),
    ...asset.subjects.map((subject) => subject.label),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase();
}

export function filterFamilyAssets(
  assets: readonly FamilyAssetView[],
  filter: FamilyAssetFilter,
): FamilyAssetView[] {
  const terms = filter.query
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/u)
    .filter(Boolean);

  return assets.filter((asset) => {
    if (filter.resourceKind && asset.resourceKind !== filter.resourceKind) {
      return false;
    }
    if (filter.status && asset.status !== filter.status) return false;
    if (filter.subjectId && !asset.subjects.some((item) => item.id === filter.subjectId)) {
      return false;
    }
    if (filter.childId === FAMILY_ASSET_WHOLE_FAMILY_CHILD) {
      if (asset.children.length > 0) return false;
    } else if (
      filter.childId &&
      !asset.children.some((child) => child.id === filter.childId)
    ) {
      return false;
    }
    if (terms.length === 0) return true;
    const haystack = searchText(asset);
    return terms.every((term) => haystack.includes(term));
  });
}

export function familyAssetFilterOptions(
  assets: readonly FamilyAssetView[],
): FamilyAssetFilterOptions {
  const presentKinds = new Set(
    assets
      .map((asset) => asset.resourceKind)
      .filter((kind): kind is FamilyAssetResourceKind => kind !== null),
  );
  const presentStatuses = new Set(assets.map((asset) => asset.status));
  const children = new Map<string, FamilyAssetChild>();
  const subjects = new Map<string, string>();
  for (const asset of assets) {
    for (const child of asset.children) children.set(child.id, child);
    for (const subject of asset.subjects) subjects.set(subject.id, subject.label);
  }
  return {
    resourceKinds: FAMILY_ASSET_RESOURCE_KINDS.filter((kind) =>
      presentKinds.has(kind),
    ),
    children: [...children.values()].sort(
      (first, second) =>
        first.name.localeCompare(second.name) || first.id.localeCompare(second.id),
    ),
    subjects: [...subjects.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort(
        (first, second) =>
          first.label.localeCompare(second.label) || first.id.localeCompare(second.id),
      ),
    statuses: FAMILY_ASSET_STATUSES.filter((status) => presentStatuses.has(status)),
  };
}

export const FAMILY_ASSET_RESOURCE_KIND_LABELS: Record<
  FamilyAssetResourceKind,
  string
> = {
  worksheet: "Worksheet",
  book: "Book",
  curriculum: "Curriculum",
  answer_key: "Answer key",
  activity: "Activity",
  reference: "Reference",
  other: "Other",
};

export const FAMILY_ASSET_STATUS_LABELS: Record<FamilyAssetStatus, string> = {
  ready: "Ready",
  processing: "Organizing details",
  needs_attention: "Needs attention",
  failed: "Could not organize",
};

export interface FamilyAssetStatusCopy {
  label: string;
  detail: string;
  tone: "ready" | "processing" | "attention" | "failed";
}

const LEGACY_EDIT_MODE_DETAILS = new Map([
  [
    "Your original is saved and ready to download. Open Edit details to add or correct the title, resource type, children, and subjects.",
    "Your original is saved and ready to download. Add or correct the title, resource type, children, and subjects below.",
  ],
  [
    "Your original is saved and ready to download. This file is too large for Homa to organize its Library details automatically. Use Edit details to add them yourself.",
    "Your original is saved and ready to download. This file is too large for Homa to organize its Library details automatically. Add them below instead.",
  ],
]);

function currentStatusDetail(note: string | null, fallback: string): string {
  if (!note) return fallback;
  return LEGACY_EDIT_MODE_DETAILS.get(note) ?? note;
}

export function familyAssetStatusCopy(
  asset: Pick<FamilyAssetView, "status" | "processingNote">,
): FamilyAssetStatusCopy {
  if (asset.status === "ready") {
    return {
      label: FAMILY_ASSET_STATUS_LABELS.ready,
      detail: "Your original is saved and ready to download.",
      tone: "ready",
    };
  }
  if (asset.status === "processing") {
    return {
      label: FAMILY_ASSET_STATUS_LABELS.processing,
      detail: currentStatusDetail(
        asset.processingNote,
        "Your original is saved and ready to download. Homa is organizing its Library details.",
      ),
      tone: "processing",
    };
  }
  if (asset.status === "needs_attention") {
    return {
      label: FAMILY_ASSET_STATUS_LABELS.needs_attention,
      detail: currentStatusDetail(
        asset.processingNote,
        "Your original is saved and ready to download. Add or correct the title, resource type, children, and subjects below.",
      ),
      tone: "attention",
    };
  }
  return {
    label: FAMILY_ASSET_STATUS_LABELS.failed,
    detail: currentStatusDetail(
      asset.processingNote,
      "Your original is saved and ready to download. Homa could not organize its Library details.",
    ),
    tone: "failed",
  };
}

export function familyAssetSourceLabel(
  asset: Pick<
    FamilyAssetView,
    "sourceUploadId" | "sourceAttachmentId" | "parentAssetId"
  >,
): string {
  if (asset.sourceAttachmentId) return "Saved from chat";
  if (asset.parentAssetId) return "Part of a curriculum";
  if (asset.sourceUploadId) return "Uploaded from your device";
  return "Added to your Library";
}

export function stableFamilyAssetDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}
