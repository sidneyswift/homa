export interface CurriculumMappingCardUnit {
  ordinal: number;
  unitLabel: string;
  sourceLocator: string;
  confidence: "high" | "medium" | "low";
  subjectNames: string[];
  summary: string;
}

export interface CurriculumMappingCardPlacement {
  unitOrdinal: number;
  unitLabel: string;
  childName: string;
  subjectName: string;
  week: number;
  activityText: string;
}

export interface CurriculumMappingCardData {
  draftId: string;
  revision: number;
  sourceTitle: string;
  decompositionQuality: "full" | "partial";
  unitKind: "week" | "lesson" | "day" | "chapter" | "unit";
  declaredUnitCount: number;
  notes: string | null;
  restoredFrom: number | null;
  units: CurriculumMappingCardUnit[];
  placements: CurriculumMappingCardPlacement[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UNIT_KINDS = new Set(["week", "lesson", "day", "chapter", "unit"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const parsed = value.trim();
  return parsed.length > 0 && parsed.length <= maximum ? parsed : null;
}

function integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function unit(value: unknown): CurriculumMappingCardUnit | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const ordinal = integer(candidate.ordinal, 1, 5_000);
  const unitLabel = text(candidate.unitLabel, 120);
  const sourceLocator = text(candidate.sourceLocator, 160);
  const summary = text(candidate.summary, 500);
  const confidence =
    typeof candidate.confidence === "string" && CONFIDENCES.has(candidate.confidence)
      ? (candidate.confidence as CurriculumMappingCardUnit["confidence"])
      : null;
  const subjectNames = Array.isArray(candidate.subjectNames)
    ? candidate.subjectNames.flatMap((name) => {
        const parsed = text(name, 120);
        return parsed ? [parsed] : [];
      })
    : [];
  return ordinal !== null &&
    unitLabel &&
    sourceLocator &&
    summary &&
    confidence &&
    subjectNames.length > 0 &&
    subjectNames.length <= 5
    ? { ordinal, unitLabel, sourceLocator, confidence, subjectNames, summary }
    : null;
}

function placement(value: unknown): CurriculumMappingCardPlacement | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const unitOrdinal = integer(candidate.unitOrdinal, 1, 5_000);
  const week = integer(candidate.week, 1, 4);
  const unitLabel = text(candidate.unitLabel, 120);
  const childName = text(candidate.childName, 120);
  const subjectName = text(candidate.subjectName, 120);
  const activityText = text(candidate.activityText, 500);
  return unitOrdinal !== null &&
    week !== null &&
    unitLabel &&
    childName &&
    subjectName &&
    activityText
    ? { unitOrdinal, unitLabel, childName, subjectName, week, activityText }
    : null;
}

export function parseCurriculumMappingCardPart(
  part: unknown,
): CurriculumMappingCardData | null {
  if (!part || typeof part !== "object") return null;
  const candidate = part as Record<string, unknown>;
  if (
    candidate.type !== "dynamic-tool" ||
    candidate.state !== "output-available" ||
    candidate.toolName !== "preview_curriculum_mapping" ||
    !candidate.output ||
    typeof candidate.output !== "object"
  ) {
    return null;
  }
  const output = candidate.output as Record<string, unknown>;
  if (output.previewed !== true || !output.preview || typeof output.preview !== "object") {
    return null;
  }
  const preview = output.preview as Record<string, unknown>;
  const draftId = text(preview.draftId, 36);
  const revision = integer(preview.revision, 1, 100);
  const sourceTitle = text(preview.sourceTitle, 180);
  const declaredUnitCount = integer(preview.declaredUnitCount, 1, 5_000);
  const decompositionQuality =
    preview.decompositionQuality === "full" || preview.decompositionQuality === "partial"
      ? preview.decompositionQuality
      : null;
  const unitKind =
    typeof preview.unitKind === "string" && UNIT_KINDS.has(preview.unitKind)
      ? (preview.unitKind as CurriculumMappingCardData["unitKind"])
      : null;
  const notes = preview.notes === null ? null : text(preview.notes, 500);
  const restoredFrom =
    preview.restoredFrom === null
      ? null
      : integer(preview.restoredFrom, 1, 100);
  const units = Array.isArray(preview.units)
    ? preview.units.map(unit).filter((entry): entry is CurriculumMappingCardUnit => entry !== null)
    : [];
  const placements = Array.isArray(preview.placements)
    ? preview.placements
        .map(placement)
        .filter((entry): entry is CurriculumMappingCardPlacement => entry !== null)
    : [];
  if (
    !draftId ||
    !UUID_PATTERN.test(draftId) ||
    revision === null ||
    !sourceTitle ||
    declaredUnitCount === null ||
    !decompositionQuality ||
    !unitKind ||
    (preview.notes !== null && notes === null) ||
    (preview.restoredFrom !== null && restoredFrom === null) ||
    !Array.isArray(preview.units) ||
    units.length !== preview.units.length ||
    units.length === 0 ||
    units.length > 120 ||
    !Array.isArray(preview.placements) ||
    placements.length !== preview.placements.length ||
    placements.length > 40
  ) {
    return null;
  }
  return {
    draftId,
    revision,
    sourceTitle,
    decompositionQuality,
    unitKind,
    declaredUnitCount,
    notes,
    restoredFrom,
    units,
    placements,
  };
}
