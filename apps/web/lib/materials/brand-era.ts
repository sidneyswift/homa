import { DESIGN_CONTRACT_VERSION } from "@homa/design/contract";

/**
 * The design identity attached to generated material artifacts. This is
 * metadata, not a visual layer: it lets a durable-artifact dry run tell a
 * current Quiet revision from an older byte lineage without rewriting or
 * guessing from pixels.
 */
export const MATERIAL_BRAND_ERA = DESIGN_CONTRACT_VERSION;
export const MATERIAL_TARGET_PROFILE = "artifact-print" as const;

export interface MaterialArtifactBrand {
  designEra: typeof DESIGN_CONTRACT_VERSION;
  targetProfile: typeof MATERIAL_TARGET_PROFILE;
}

export function materialArtifactBrand(): MaterialArtifactBrand {
  return {
    designEra: MATERIAL_BRAND_ERA,
    targetProfile: MATERIAL_TARGET_PROFILE,
  };
}

/**
 * Old rows intentionally return false. They remain valid provenance and can
 * be migrated or retained by the durable-artifact policy, but they must not
 * be mistaken for a newly generated Quiet artifact.
 */
export function hasCurrentMaterialBrand(value: unknown): value is MaterialArtifactBrand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MaterialArtifactBrand>;
  return (
    candidate.designEra === MATERIAL_BRAND_ERA
    && candidate.targetProfile === MATERIAL_TARGET_PROFILE
  );
}
