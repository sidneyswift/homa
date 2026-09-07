import { parseVerifiedFamilySourceEvidence, type VerifiedFamilySourceEvidence } from "./family-asset-source-evidence-contract";

export const MAX_FAMILY_ASSET_REFERENCES = 5;

export interface FamilyAssetReferenceSnapshot {
  id: string;
  title: string;
  sourceLocator?: string | null;
  evidence?: VerifiedFamilySourceEvidence[];
}

export interface FamilyAssetReference extends FamilyAssetReferenceSnapshot {
  /** Null means the source was removed from Library after this output used it. */
  libraryUrl: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseFamilyAssetReferenceSnapshots(
  value: unknown,
): FamilyAssetReferenceSnapshot[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const references: FamilyAssetReferenceSnapshot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !UUID_PATTERN.test(row.id) ||
      typeof row.title !== "string" ||
      row.title.trim().length === 0
    ) {
      continue;
    }
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const sourceLocator =
      row.sourceLocator === null
        ? null
        : typeof row.sourceLocator === "string" && row.sourceLocator.trim().length > 0
          ? row.sourceLocator.trim().slice(0, 160)
          : undefined;
    const evidence = parseVerifiedFamilySourceEvidence(row.evidence);
    references.push({
      id: row.id,
      title: row.title.trim().slice(0, 180),
      ...(sourceLocator !== undefined ? { sourceLocator } : {}),
      ...(evidence.length ? { evidence } : {}),
    });
    if (references.length === MAX_FAMILY_ASSET_REFERENCES) break;
  }
  return references;
}

export function familyAssetLibraryHref(assetId: string): string {
  return `/app/library?asset=${encodeURIComponent(assetId)}`;
}

export function familyAssetReferencesForSurface(
  snapshots: readonly FamilyAssetReferenceSnapshot[],
  options: {
    activeAssetIds?: ReadonlySet<string>;
    siteRoot?: string;
  } = {},
): FamilyAssetReference[] {
  const siteRoot = options.siteRoot?.replace(/\/$/u, "") ?? "";
  return snapshots.map((source) => ({
    ...source,
    libraryUrl:
      options.activeAssetIds && !options.activeAssetIds.has(source.id)
        ? null
        : `${siteRoot}${familyAssetLibraryHref(source.id)}`,
  }));
}
