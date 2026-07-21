import type { ChildRecord } from "../../lib/family";
import {
  MATERIAL_KINDS,
  type MaterialKind,
  type MaterialSummary,
} from "../../lib/materials";

/**
 * The Binder's pure view-model, ported from
 * apps/web/lib/materials/binder.ts (keep the rules in sync with that
 * file until a shared package exists). Pure functions so binder-view
 * stays render-only and every rule (search, chips, the cover pick) is
 * testable without a device.
 *
 * One deliberate difference from web: no scopedToViewContext. The web
 * sidebar's family/child view-context cookie has no mobile twin yet, so
 * the mobile Binder always shows the whole family's keepers.
 */

export interface BinderMaterial {
  id: string;
  title: string;
  kind: MaterialKind;
  subject: string | null;
  theme: string | null;
  skill: string | null;
  childId: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  createdAt: string;
  /** PDF pages (1 for classic single-page materials). */
  pageCount: number;
  /** Per-page previews for multi-page materials, page 1 first. */
  pagePreviewUrls: string[] | null;
}

/**
 * Attaches each material's child name (null stays null: a family-shared
 * material, not a lookup miss, since childId already came from the
 * caller's own RLS-scoped read).
 */
export function toBinderMaterials(
  materials: readonly MaterialSummary[],
  children: readonly ChildRecord[],
): BinderMaterial[] {
  const nameById = new Map(children.map((child) => [child.id, child.name]));
  return materials.map((material) => ({
    id: material.id,
    title: material.title,
    kind: material.kind,
    subject: material.subject,
    theme: material.theme,
    skill: material.skill,
    childId: material.childId,
    childName: material.childId
      ? (nameById.get(material.childId) ?? null)
      : null,
    previewUrl: material.previewUrl,
    pdfUrl: material.pdfUrl,
    createdAt: material.createdAt,
    pageCount: material.pageCount,
    pagePreviewUrls: material.pagePreviewUrls,
  }));
}

export const KIND_LABELS: Record<MaterialKind, string> = {
  worksheet: "Worksheet",
  coloring: "Coloring page",
  flashcards: "Flash cards",
  reader: "Reader",
  poster: "Poster",
  infographic: "Infographic",
  game: "Game",
  packet: "Packet",
  other: "Other",
};

/**
 * The kinds actually present, in the app's fixed display order (never
 * alphabetical or by count: a chip row that reorders itself as items
 * change would feel unstable to scan).
 */
export function kindOptions(
  materials: readonly BinderMaterial[],
): MaterialKind[] {
  const present = new Set(materials.map((material) => material.kind));
  return MATERIAL_KINDS.filter((kind) => present.has(kind));
}

/**
 * Subjects are free text on materials (the agent writes "Reading",
 * "math", "Handwriting"...), so chips group case-insensitively and
 * display the first spelling seen. Alphabetical by key on purpose: the
 * kinds row has a fixed vocabulary order, free text does not, and an
 * alphabetical row stays stable as new items arrive.
 */
export interface SubjectOption {
  key: string;
  label: string;
}

export function subjectKey(subject: string): string {
  return subject.trim().toLowerCase();
}

export function subjectOptions(
  materials: readonly BinderMaterial[],
): SubjectOption[] {
  const byKey = new Map<string, string>();
  for (const material of materials) {
    const raw = material.subject?.trim();
    if (!raw) continue;
    const key = subjectKey(raw);
    if (!byKey.has(key)) byKey.set(key, raw);
  }
  return [...byKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export interface BinderFilter {
  kind: MaterialKind | null;
  subject: string | null;
  query: string;
}

/** True filter, no filter: no kind, no subject, and an empty query. */
export function isDefaultFilter(filter: BinderFilter): boolean {
  return (
    filter.kind === null &&
    filter.subject === null &&
    filter.query.trim().length === 0
  );
}

/**
 * Kind and subject narrow first (chip rows), then a plain substring
 * search over the fields a parent would actually remember: title,
 * subject, theme, skill.
 */
export function filterMaterials(
  materials: readonly BinderMaterial[],
  filter: BinderFilter,
): BinderMaterial[] {
  const needle = filter.query.trim().toLowerCase();
  return materials.filter((material) => {
    if (filter.kind && material.kind !== filter.kind) return false;
    if (
      filter.subject &&
      (!material.subject || subjectKey(material.subject) !== filter.subject)
    ) {
      return false;
    }
    if (!needle) return true;
    return [material.title, material.subject, material.theme, material.skill]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(needle));
  });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface BinderCover {
  eyebrow: string;
  heading: string;
  items: BinderMaterial[];
}

/**
 * The "this week" cover, kept honest: when anything was kept in the
 * trailing seven days the cover shows only those items, and the eyebrow
 * and heading agree with each other. Nothing recent falls back to the
 * newest keepers rather than calling old items this week's.
 */
export function binderCover(
  materials: readonly BinderMaterial[],
  nowMs: number,
  count: number,
): BinderCover {
  const newestFirst = [...materials].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const thisWeek = newestFirst.filter(
    (material) => nowMs - new Date(material.createdAt).getTime() <= WEEK_MS,
  );
  if (thisWeek.length > 0) {
    return {
      eyebrow: "This week",
      heading: "What you've kept this week",
      items: thisWeek.slice(0, count),
    };
  }
  return {
    eyebrow: "Newest",
    heading: "The newest things you've kept",
    items: newestFirst.slice(0, count),
  };
}

/**
 * Names only the narrowing the parent actually applied (web's editor
 * gate, 2026-07-12: "these filters" over one filter sent the reader
 * hunting for a switch that was never on).
 */
export function noResultsMessage(filter: BinderFilter): string {
  const chipNames = [
    filter.kind !== null ? "type" : null,
    filter.subject !== null ? "subject" : null,
  ].filter((name): name is string => name !== null);
  if (chipNames.length === 0) {
    return "Nothing matches that search. Try a different word.";
  }
  if (filter.query.trim().length === 0) {
    return "Nothing kept matches both of those together. Set type or subject back to All.";
  }
  const named = chipNames.join(" and ");
  const filterWord = chipNames.length === 1 ? "filter" : "filters";
  return `Nothing matches that search with the ${named} ${filterWord} on. Try a different word, or set ${named} back to All.`;
}
