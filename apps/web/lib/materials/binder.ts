import { MATERIAL_KINDS, type MaterialKind } from "./kinds";
import type { MaterialSummary } from "./library";
import type { ChildRecord } from "../family";
import type { ViewContext } from "../view-context";

/**
 * The Binder (binder design directions, 2026-07-11; merges Direction 1's
 * calm "this week" cover with Direction 2's large visual previews and
 * filter chips): a browsable home for the family's approved materials.
 * First release scope on purpose (the doc's release ladder): finalized
 * materials only, no separate switcher because the existing family/child
 * view context already does that job everywhere else in the app.
 *
 * Pure functions here so binder-view.tsx stays render-only and every rule
 * (scope, search, the cover pick) is unit-testable without a browser.
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
}

/**
 * toBinderMaterials(materials, children): BinderMaterial[]
 * Attaches each material's child name (null stays null: a family-shared
 * material, not a lookup miss, since childId already came from the
 * caller's own RLS-scoped read).
 */
export function toBinderMaterials(
  materials: MaterialSummary[],
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
    childName: material.childId ? nameById.get(material.childId) ?? null : null,
    previewUrl: material.previewUrl,
    pdfUrl: material.pdfUrl,
    createdAt: material.createdAt,
  }));
}

/**
 * scopedToViewContext(materials, viewContext): BinderMaterial[]
 * Whole family sees everything; one kid's view keeps their own materials
 * plus anything shared with the whole family (childId null), the same
 * rule the design directions' fake dataset used.
 */
export function scopedToViewContext(
  materials: readonly BinderMaterial[],
  viewContext: ViewContext,
): BinderMaterial[] {
  if (viewContext.kind === "family") return [...materials];
  return materials.filter(
    (material) => material.childId === null || material.childId === viewContext.childId,
  );
}

export const KIND_LABELS: Record<MaterialKind, string> = {
  worksheet: "Worksheet",
  coloring: "Coloring page",
  flashcards: "Flash cards",
  reader: "Reader",
  poster: "Poster",
  infographic: "Infographic",
  game: "Game",
  other: "Other",
};

/**
 * kindOptions(materials): MaterialKind[]
 * The kinds actually present, in the app's fixed display order (never
 * alphabetical or by count: a chip row that reorders itself as items
 * change would feel unstable to scan).
 */
export function kindOptions(materials: readonly BinderMaterial[]): MaterialKind[] {
  const present = new Set(materials.map((material) => material.kind));
  return MATERIAL_KINDS.filter((kind) => present.has(kind));
}

export interface BinderFilter {
  kind: MaterialKind | null;
  query: string;
}

/** True filter, no filter: an empty query and no kind means "everything". */
export function isDefaultFilter(filter: BinderFilter): boolean {
  return filter.kind === null && filter.query.trim().length === 0;
}

/**
 * filterMaterials(materials, filter): BinderMaterial[]
 * Kind narrows first (chip row), then a plain substring search over the
 * fields a parent would actually remember: title, subject, theme, skill.
 */
export function filterMaterials(
  materials: readonly BinderMaterial[],
  filter: BinderFilter,
): BinderMaterial[] {
  const needle = filter.query.trim().toLowerCase();
  return materials.filter((material) => {
    if (filter.kind && material.kind !== filter.kind) return false;
    if (!needle) return true;
    return [material.title, material.subject, material.theme, material.skill]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(needle));
  });
}

/**
 * coverMaterials(materials, count): BinderMaterial[]
 * Direction 1's "this week" cover, grounded in the one date this data
 * actually has: the most recently approved items, newest first.
 */
export function coverMaterials(
  materials: readonly BinderMaterial[],
  count: number,
): BinderMaterial[] {
  return [...materials]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, count);
}
