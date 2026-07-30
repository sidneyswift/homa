import { MATERIAL_KINDS, type MaterialKind, type MaterialSummary } from "../../lib/materials";
import type { ChildRecord } from "../../lib/family";

/**
 * Pure view-model helpers ported from apps/web/lib/materials/binder.ts.
 * No view-context/per-child scoping here (mobile has no equivalent
 * session state yet, a known gap): the whole family's binder shows,
 * same precedent Hours already set.
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
  pageCount: number;
  pagePreviewUrls: string[] | null;
}

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
    childName: material.childId ? (nameById.get(material.childId) ?? null) : null,
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

export function kindOptions(materials: readonly BinderMaterial[]): MaterialKind[] {
  const present = new Set(materials.map((material) => material.kind));
  return MATERIAL_KINDS.filter((kind) => present.has(kind));
}

export interface SubjectOption {
  key: string;
  label: string;
}

export function subjectKey(subject: string): string {
  return subject.trim().toLowerCase();
}

const MACHINE_SUBJECTS = new Set(["state-pack"]);

export function subjectOptions(materials: readonly BinderMaterial[]): SubjectOption[] {
  const byKey = new Map<string, string>();
  for (const material of materials) {
    const raw = material.subject?.trim();
    if (!raw) continue;
    const key = subjectKey(raw);
    if (MACHINE_SUBJECTS.has(key)) continue;
    if (!byKey.has(key)) byKey.set(key, raw);
  }
  return [...byKey.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.key.localeCompare(b.key));
}

export interface BinderFilter {
  kind: MaterialKind | null;
  subject: string | null;
  query: string;
}

export function isDefaultFilter(filter: BinderFilter): boolean {
  return filter.kind === null && filter.subject === null && filter.query.trim().length === 0;
}

export function filterMaterials(materials: readonly BinderMaterial[], filter: BinderFilter): BinderMaterial[] {
  const needle = filter.query.trim().toLowerCase();
  return materials.filter((material) => {
    if (filter.kind && material.kind !== filter.kind) return false;
    if (filter.subject && (!material.subject || subjectKey(material.subject) !== filter.subject)) return false;
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

/** "This week" when anything was kept in the trailing 7 days, else the
 * newest keepers, never calling old items "this week's." */
export function binderCover(materials: readonly BinderMaterial[], nowMs: number, count: number): BinderCover {
  const newestFirst = [...materials].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const thisWeek = newestFirst.filter((material) => nowMs - new Date(material.createdAt).getTime() <= WEEK_MS);
  if (thisWeek.length > 0) {
    return { eyebrow: "This week", heading: "What you've kept this week", items: thisWeek.slice(0, count) };
  }
  return { eyebrow: "Newest", heading: "The newest things you've kept", items: newestFirst.slice(0, count) };
}

export function noResultsMessage(filter: BinderFilter): string {
  const chipNames = [filter.kind !== null ? "type" : null, filter.subject !== null ? "subject" : null].filter(
    (name): name is string => name !== null,
  );
  if (chipNames.length === 0) return "Nothing matches that search. Try a different word.";
  if (filter.query.trim().length === 0) {
    return "Nothing kept matches both of those together. Set type or subject back to All.";
  }
  const named = chipNames.join(" and ");
  const filterWord = chipNames.length === 1 ? "filter" : "filters";
  return `Nothing matches that search with the ${named} ${filterWord} on. Try a different word, or set ${named} back to All.`;
}
