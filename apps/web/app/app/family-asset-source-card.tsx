import { Icon } from "../../components/design/Icon";
import { familyAssetLibraryHref } from "../../lib/library/family-asset-reference";
import {
  FAMILY_ASSET_RESOURCE_KIND_LABELS,
} from "../../lib/library/family-asset-shelf";
import type { FamilyAssetResourceKind } from "../../lib/library/family-assets";

export interface FamilyAssetSourceCardData {
  id: string;
  title: string;
  libraryUrl: string;
  kindLabel: string | null;
  childNames: string[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseFamilyAssetSourceCardPart(
  part: unknown,
): FamilyAssetSourceCardData | null {
  if (!part || typeof part !== "object") return null;
  const candidate = part as Record<string, unknown>;
  if (
    candidate.type !== "dynamic-tool" ||
    candidate.state !== "output-available" ||
    candidate.toolName !== "get_family_asset" ||
    !candidate.output ||
    typeof candidate.output !== "object"
  ) {
    return null;
  }
  const output = candidate.output as Record<string, unknown>;
  if (output.found !== true || !output.asset || typeof output.asset !== "object") {
    return null;
  }
  const asset = output.asset as Record<string, unknown>;
  if (
    typeof asset.id !== "string" ||
    !UUID_PATTERN.test(asset.id) ||
    typeof asset.title !== "string" ||
    asset.title.trim().length === 0
  ) {
    return null;
  }
  const resourceKind =
    typeof asset.resourceKind === "string" &&
    asset.resourceKind in FAMILY_ASSET_RESOURCE_KIND_LABELS
      ? (asset.resourceKind as FamilyAssetResourceKind)
      : null;
  const childNames = Array.isArray(asset.children)
    ? asset.children.flatMap((child) => {
        if (!child || typeof child !== "object") return [];
        const name = (child as Record<string, unknown>).name;
        return typeof name === "string" && name.trim().length > 0
          ? [name.trim()]
          : [];
      })
    : [];
  return {
    id: asset.id,
    title: asset.title.trim(),
    libraryUrl: familyAssetLibraryHref(asset.id),
    kindLabel: resourceKind
      ? FAMILY_ASSET_RESOURCE_KIND_LABELS[resourceKind]
      : null,
    childNames,
  };
}

export function FamilyAssetSourceCard({
  source,
}: {
  source: FamilyAssetSourceCardData;
}) {
  const detail = [
    source.kindLabel,
    source.childNames.length > 0
      ? `for ${source.childNames.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon name="book" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Library source
          </p>
          <p className="mt-0.5 break-words font-display text-lg font-semibold text-strong">
            {source.title}
          </p>
          {detail ? <p className="mt-0.5 text-sm text-muted">{detail}</p> : null}
        </div>
      </div>
      <a
        href={source.libraryUrl}
        className="mt-3 inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
      >
        Open in Library
      </a>
    </div>
  );
}
