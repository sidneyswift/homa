import { selectParentVisibleMaterialRevisions } from "../../lib/materials/parent-visible";
import {
  familyAssetReferencesForSurface,
  parseFamilyAssetReferenceSnapshots,
} from "../../lib/library/family-asset-reference";
import type { MaterialArtifact } from "./material-card";

type MaterialStatus = "draft" | "final" | "superseded";

export interface ParentVisibleMaterialMessagePart {
  id: string;
  revisesId: string | null;
  status: MaterialStatus;
  reviewPass: boolean | null;
  order: number;
  sourcePartIndex: number;
  material: MaterialArtifact;
}

function parsedStatus(value: unknown): MaterialStatus {
  if (value === "final" || value === "superseded") return value;
  return "draft";
}

function parsedReviewPass(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function parseMaterialMessagePart(
  part: unknown,
  sourcePartIndex: number,
): ParentVisibleMaterialMessagePart | null {
  if (typeof part !== "object" || part === null) return null;
  const candidate = part as Record<string, unknown>;
  if (
    candidate.type !== "dynamic-tool" ||
    candidate.state !== "output-available" ||
    (candidate.toolName !== "create_printable" &&
      candidate.toolName !== "show_material" &&
      candidate.toolName !== "create_worksheet")
  ) {
    return null;
  }

  if (typeof candidate.output !== "object" || candidate.output === null) {
    return null;
  }
  const output = candidate.output as Record<string, unknown>;
  const rawMaterial =
    candidate.toolName === "create_worksheet"
      ? output.worksheet
      : output.material;
  if (typeof rawMaterial !== "object" || rawMaterial === null) return null;
  const material = rawMaterial as Record<string, unknown>;
  if (
    typeof material.title !== "string" ||
    typeof material.previewUrl !== "string" ||
    typeof material.pdfUrl !== "string"
  ) {
    return null;
  }

  const id =
    typeof material.id === "string" && material.id.length > 0
      ? material.id
      : `legacy-part:${sourcePartIndex}`;
  const revisesId =
    typeof material.revisesId === "string" && material.revisesId.length > 0
      ? material.revisesId
      : null;

  return {
    id,
    revisesId,
    status: parsedStatus(material.status),
    reviewPass: parsedReviewPass(material.reviewPassed),
    order: sourcePartIndex,
    sourcePartIndex,
    material: {
      // Same resolved id as the message part above (real id, or the
      // legacy-part fallback); MaterialCard only uses it when it names a
      // real material row.
      id: id.startsWith("legacy-part:") ? undefined : id,
      title: material.title,
      ...(typeof material.kind === "string" ? { kind: material.kind } : {}),
      skill: typeof material.skill === "string" ? material.skill : null,
      childName:
        typeof material.childName === "string" ? material.childName : null,
      previewUrl: material.previewUrl,
      pdfUrl: material.pdfUrl,
      ...(typeof material.pageCount === "number"
        ? { pageCount: material.pageCount }
        : {}),
      ...(Array.isArray(material.pagePreviewUrls)
        ? {
            pagePreviewUrls: material.pagePreviewUrls.filter(
              (url): url is string => typeof url === "string",
            ),
          }
        : {}),
      sources: familyAssetReferencesForSurface(
        parseFamilyAssetReferenceSnapshots(material.sources),
      ),
    },
  };
}

/**
 * A successful material effect must never disappear just because its chat
 * card payload is incomplete. The durable page still belongs to Binder, so
 * the renderer can offer that truthful recovery path. Ordinary tool failures
 * stay ordinary failures and do not claim that a page exists.
 */
export function materialMessagePartNeedsFallback(part: unknown): boolean {
  if (typeof part !== "object" || part === null) return false;
  const candidate = part as Record<string, unknown>;
  if (
    candidate.type !== "dynamic-tool" ||
    candidate.state !== "output-available" ||
    typeof candidate.output !== "object" ||
    candidate.output === null
  ) {
    return false;
  }

  const output = candidate.output as Record<string, unknown>;
  const succeeded =
    (candidate.toolName === "create_printable" && output.created === true) ||
    (candidate.toolName === "show_material" && output.shown === true) ||
    (candidate.toolName === "create_worksheet" &&
      typeof output.worksheet === "object" &&
      output.worksheet !== null);

  return succeeded && parseMaterialMessagePart(part, 0) === null;
}

/**
 * Parses material tool outputs and returns one current card per revision chain.
 * The selected entries retain their original message-part positions.
 */
export function selectParentVisibleMaterialMessageParts(
  parts: readonly unknown[],
): ParentVisibleMaterialMessagePart[] {
  const candidates = parts.flatMap((part, sourcePartIndex) => {
    const candidate = parseMaterialMessagePart(part, sourcePartIndex);
    return candidate ? [candidate] : [];
  });
  return selectParentVisibleMaterialRevisions(candidates);
}
