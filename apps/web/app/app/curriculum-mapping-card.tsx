import { BookOpenCheck } from "lucide-react";

import { FAMILY_CURRICULUM_UNIT_REVIEW_LABELS } from "../../lib/library/family-assets";

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
  units: CurriculumMappingCardUnit[];
  placements: CurriculumMappingCardPlacement[];
  restoredFrom: number | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UNIT_KINDS = new Set(["week", "lesson", "day", "chapter", "unit"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maximum ? text : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function parseUnit(value: unknown): CurriculumMappingCardUnit | null {
  if (!value || typeof value !== "object") return null;
  const unit = value as Record<string, unknown>;
  const ordinal = boundedInteger(unit.ordinal, 1, 5_000);
  const unitLabel = boundedText(unit.unitLabel, 120);
  const sourceLocator = boundedText(unit.sourceLocator, 160);
  const summary = boundedText(unit.summary, 500);
  const confidence =
    typeof unit.confidence === "string" && CONFIDENCES.has(unit.confidence)
      ? (unit.confidence as CurriculumMappingCardUnit["confidence"])
      : null;
  const subjectNames = Array.isArray(unit.subjectNames)
    ? unit.subjectNames.flatMap((name) => {
        const parsed = boundedText(name, 120);
        return parsed ? [parsed] : [];
      })
    : [];
  if (
    ordinal === null ||
    !unitLabel ||
    !sourceLocator ||
    !summary ||
    !confidence ||
    subjectNames.length === 0 ||
    subjectNames.length > 5
  ) {
    return null;
  }
  return { ordinal, unitLabel, sourceLocator, confidence, subjectNames, summary };
}

function parsePlacement(value: unknown): CurriculumMappingCardPlacement | null {
  if (!value || typeof value !== "object") return null;
  const placement = value as Record<string, unknown>;
  const unitOrdinal = boundedInteger(placement.unitOrdinal, 1, 5_000);
  const week = boundedInteger(placement.week, 1, 4);
  const unitLabel = boundedText(placement.unitLabel, 120);
  const childName = boundedText(placement.childName, 120);
  const subjectName = boundedText(placement.subjectName, 120);
  const activityText = boundedText(placement.activityText, 500);
  if (
    unitOrdinal === null ||
    week === null ||
    !unitLabel ||
    !childName ||
    !subjectName ||
    !activityText
  ) {
    return null;
  }
  return { unitOrdinal, unitLabel, childName, subjectName, week, activityText };
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
  const draftId = boundedText(preview.draftId, 36);
  const revision = boundedInteger(preview.revision, 1, 100);
  const sourceTitle = boundedText(preview.sourceTitle, 180);
  const declaredUnitCount = boundedInteger(preview.declaredUnitCount, 1, 5_000);
  const decompositionQuality =
    preview.decompositionQuality === "full" || preview.decompositionQuality === "partial"
      ? preview.decompositionQuality
      : null;
  const unitKind =
    typeof preview.unitKind === "string" && UNIT_KINDS.has(preview.unitKind)
      ? (preview.unitKind as CurriculumMappingCardData["unitKind"])
      : null;
  const notes = preview.notes === null ? null : boundedText(preview.notes, 500);
  const restoredFrom =
    preview.restoredFrom === null
      ? null
      : boundedInteger(preview.restoredFrom, 1, 100);
  const units = Array.isArray(preview.units)
    ? preview.units.map(parseUnit).filter((unit): unit is CurriculumMappingCardUnit => unit !== null)
    : [];
  const placements = Array.isArray(preview.placements)
    ? preview.placements
        .map(parsePlacement)
        .filter((placement): placement is CurriculumMappingCardPlacement => placement !== null)
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
    units,
    placements,
    restoredFrom,
  };
}

function pluralUnit(kind: CurriculumMappingCardData["unitKind"], count: number): string {
  if (count === 1) return kind;
  return kind === "day" ? "days" : `${kind}s`;
}

export function CurriculumMappingCard({ card }: { card: CurriculumMappingCardData }) {
  const foundLabel =
    card.decompositionQuality === "partial"
      ? `${card.units.length} of ${card.declaredUnitCount} ${pluralUnit(card.unitKind, card.declaredUnitCount)} found`
      : `${card.units.length} ${pluralUnit(card.unitKind, card.units.length)} found`;
  const plannerLabel = `${card.placements.length} Planner ${card.placements.length === 1 ? "addition" : "additions"}`;
  const unitHeading = pluralUnit(card.unitKind, card.units.length);
  const unitHeadingLabel = `${unitHeading[0]?.toUpperCase() ?? ""}${unitHeading.slice(1)}`;
  return (
    <section className="w-full max-w-xl overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
      <header className="border-b border-border-subtle bg-brand-soft px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card text-brand">
            <BookOpenCheck size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {card.restoredFrom
                ? `Review before saving · Restored version ${card.restoredFrom}`
                : "Review before saving"}
            </p>
            <h3 className="mt-0.5 break-words font-display text-xl font-semibold text-strong">
              {card.sourceTitle}
            </h3>
            <p className="mt-1 text-sm text-body">
              {foundLabel} · {plannerLabel}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-strong">
          This review has not changed Library or Planner.
        </p>
      </header>

      {card.notes ? (
        <div className="border-b border-[var(--gold-300)] bg-[var(--warning-soft)] px-4 py-3 text-sm leading-6 text-body sm:px-5">
          <span className="font-semibold">Homa couldn&apos;t read the whole file:</span>{" "}
          {card.notes}
        </div>
      ) : null}

      <div className="space-y-5 px-4 py-4 sm:px-5">
        <section aria-labelledby={`curriculum-units-${card.draftId}-${card.revision}`}>
          <h4
            id={`curriculum-units-${card.draftId}-${card.revision}`}
            className="font-display text-lg font-semibold text-strong"
          >
            {unitHeadingLabel}
          </h4>
          <ol className="mt-3 divide-y divide-border-subtle rounded-md border border-border-subtle">
            {card.units.map((unit) => (
              <li key={unit.ordinal} className="px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-strong">{unit.unitLabel}</p>
                  <p className="text-xs text-muted">{unit.sourceLocator}</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-body">{unit.summary}</p>
                <p className="mt-1 text-xs text-muted">
                  {unit.subjectNames.join(" · ")} · {FAMILY_CURRICULUM_UNIT_REVIEW_LABELS[unit.confidence]}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby={`planner-changes-${card.draftId}-${card.revision}`}>
          <h4
            id={`planner-changes-${card.draftId}-${card.revision}`}
            className="font-display text-lg font-semibold text-strong"
          >
            Planner additions
          </h4>
          {card.placements.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              None. Saving these units will leave Planner unchanged.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {card.placements.map((placement, index) => (
                <li
                  key={`${placement.unitOrdinal}:${placement.childName}:${placement.subjectName}:${placement.week}:${index}`}
                  className="rounded-md bg-page px-3 py-3"
                >
                  <p className="text-sm font-semibold text-strong">
                    {placement.childName} · {placement.subjectName} · Week {placement.week} in Planner
                  </p>
                  <p className="mt-1 text-sm leading-6 text-body">
                    {placement.activityText}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    From {card.sourceTitle} · {placement.unitLabel}
                    {card.units.find((unit) => unit.ordinal === placement.unitOrdinal)
                      ?.sourceLocator
                      ? ` · ${card.units.find((unit) => unit.ordinal === placement.unitOrdinal)?.sourceLocator}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="border-t border-border-subtle bg-page px-4 py-3 text-sm leading-6 text-body sm:px-5">
        {card.placements.length === 0
          ? "Tell Homa what to change, or say “Save these units.”"
          : "Tell Homa what to change, or say “Save these units and Planner additions.”"}
      </footer>
    </section>
  );
}
