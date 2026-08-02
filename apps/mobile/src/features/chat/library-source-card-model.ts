export interface LibrarySourceCardData {
  id: string;
  title: string;
  libraryUrl: string;
  kindLabel: string | null;
  childNames: string[];
}

const RESOURCE_KIND_LABELS: Record<string, string> = {
  worksheet: "Worksheet",
  book: "Book",
  curriculum: "Curriculum",
  answer_key: "Answer key",
  activity: "Activity",
  reference: "Reference",
  other: "Other",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseLibrarySourceCardPart(
  part: unknown,
): LibrarySourceCardData | null {
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
    asset.title.trim().length === 0 ||
    typeof asset.libraryUrl !== "string"
  ) {
    return null;
  }
  let libraryUrl: URL;
  try {
    libraryUrl = new URL(asset.libraryUrl);
  } catch {
    return null;
  }
  if (libraryUrl.protocol !== "https:" && libraryUrl.protocol !== "http:") {
    return null;
  }
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
    libraryUrl: libraryUrl.toString(),
    kindLabel:
      typeof asset.resourceKind === "string"
        ? RESOURCE_KIND_LABELS[asset.resourceKind] ?? null
        : null,
    childNames,
  };
}
