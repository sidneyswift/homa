/**
 * Turning one analysis JSON into something a non-technical founder can
 * read (/admin/library detail view, founder ask 2026-07-31).
 *
 * The corpus has no fixed schema. Across 195 reference documents there
 * are more than sixty distinct top-level keys, nested several levels
 * deep and different per drop, because each one was written by a model
 * following the ingestion skill rather than by a serialiser. A typed
 * renderer would silently drop most of what was extracted, which is the
 * exact complaint this surface exists to answer. So the rule here is:
 * render EVERYTHING, and only decide how prettily.
 *
 * Two passes. The six ingestion dimensions (reference-ingestion
 * SKILL.md step 2, A through F) get plain-English names and lead the
 * page, because those are the questions a founder actually asks. Every
 * remaining key falls through to a generic recursive reader, so a new
 * dimension added to the skill tomorrow still shows up here without a
 * code change.
 */

export type ReadableNode =
  | { kind: "text"; label: string; value: string }
  | { kind: "chips"; label: string; values: string[] }
  | { kind: "section"; label: string; children: ReadableNode[] }
  | { kind: "entries"; label: string; items: { heading: string; children: ReadableNode[] }[] };

/**
 * Plumbing the header already shows, or that means nothing to a reader.
 * Everything else survives to the page.
 */
const HEADER_KEYS = new Set([
  "id",
  "title",
  "publisher",
  "series",
  "author",
  "authors",
  "droppedBy",
  "droppedAt",
  "sourceChannel",
  "sourceMessageTs",
  "format",
  "gradeLevel",
  "pageCount",
  "blobUrl",
  "localPath",
]);

/**
 * The six dimensions the ingestion skill analyses, in its own order,
 * renamed to the question each one answers. Anything not listed keeps
 * its own humanised key and renders after these.
 */
export const DIMENSION_LABELS: Record<string, string> = {
  layout: "What it looks like",
  overallLayout: "What it looks like",
  skillTargeting: "What it teaches",
  overallSkillTargeting: "What it teaches",
  difficulty: "How hard it is",
  theming: "How it is themed",
  printFormat: "How it prints",
  aboutness: "What it is about",
  overview: "Overview",
  recipeMatch: "What Homa can already make",
  capture: "How it was captured",
  designPatterns: "Design patterns worth stealing",
  callouts: "Callouts",
};

const DIMENSION_ORDER = [
  "overview",
  "aboutness",
  "skillTargeting",
  "overallSkillTargeting",
  "difficulty",
  "layout",
  "overallLayout",
  "theming",
  "printFormat",
  "designPatterns",
  "recipeMatch",
  "callouts",
  "capture",
];

/** "printFormat" to "Print format", "ageBand" to "Age band". Acronyms
 * the corpus uses (pdf, ela, ocr) stay upper case. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  const words = spaced.split(/\s+/).map((word, index) => {
    const upper = word.toUpperCase();
    if (["PDF", "ELA", "OCR", "URL", "ID", "SHA256", "CC", "AI"].includes(upper)) {
      return upper;
    }
    return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word.toLowerCase();
  });
  return words.join(" ");
}

function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  );
}

function scalarToString(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** An empty array, empty object, empty string or null carries no
 * information; showing it as a blank row makes the page look broken. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

/**
 * One key/value pair to a renderable node. Recursive: an object becomes
 * a nested section, an array of objects becomes a list of headed
 * entries, an array of scalars becomes chips.
 */
export function toReadableNode(key: string, value: unknown, depth = 0): ReadableNode | null {
  if (isEmpty(value)) return null;
  const label = DIMENSION_LABELS[key] ?? humanizeKey(key);

  if (isScalar(value)) {
    return { kind: "text", label, value: scalarToString(value) };
  }

  if (Array.isArray(value)) {
    if (value.every(isScalar)) {
      return { kind: "chips", label, values: value.map(scalarToString) };
    }
    const items = value
      .map((item, index) => {
        if (isScalar(item)) {
          return { heading: `${index + 1}`, children: [{ kind: "text" as const, label: "", value: scalarToString(item) }] };
        }
        const children = objectToNodes(item as Record<string, unknown>, depth + 1);
        if (children.length === 0) return null;
        return { heading: headingFor(item, index), children };
      })
      .filter((item): item is { heading: string; children: ReadableNode[] } => item !== null);
    return items.length ? { kind: "entries", label, items } : null;
  }

  if (typeof value === "object") {
    const children = objectToNodes(value as Record<string, unknown>, depth + 1);
    return children.length ? { kind: "section", label, children } : null;
  }

  return null;
}

/**
 * A list entry reads better under its own name than under "Item 3".
 * "id" earns its place here because the taxonomy topics a reference
 * targets carry only an id and a kind, so without it every mapped topic
 * renders as a meaningless ordinal instead of ela.phonological-awareness.
 */
function headingFor(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    for (const key of ["name", "title", "label", "topic", "slug", "id", "claim", "term"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return `Item ${index + 1}`;
}

function objectToNodes(source: Record<string, unknown>, depth: number): ReadableNode[] {
  const nodes: ReadableNode[] = [];
  for (const [key, value] of Object.entries(source)) {
    const node = toReadableNode(key, value, depth);
    if (node) nodes.push(node);
  }
  return nodes;
}

/**
 * The whole analysis document as ordered sections: the named
 * dimensions first in the skill's own order, then everything else
 * alphabetically so a new key is easy to find rather than buried.
 */
export function readAnalysis(analysis: Record<string, unknown>): ReadableNode[] {
  const named: ReadableNode[] = [];
  const rest: ReadableNode[] = [];

  for (const key of DIMENSION_ORDER) {
    if (!(key in analysis)) continue;
    const node = toReadableNode(key, analysis[key]);
    if (node) named.push(node);
  }

  const handled = new Set([...DIMENSION_ORDER, ...HEADER_KEYS]);
  const remaining = Object.keys(analysis)
    .filter((key) => !handled.has(key))
    .sort();
  for (const key of remaining) {
    const node = toReadableNode(key, analysis[key]);
    if (node) rest.push(node);
  }

  return [...named, ...rest];
}

/**
 * Which of the six dimensions this record actually carries. The detail
 * view shows this as a completeness strip, so a half-analysed drop is
 * visible at a glance instead of looking finished.
 */
export const SIX_DIMENSIONS: { key: string; alt: string; label: string }[] = [
  { key: "layout", alt: "overallLayout", label: "Layout" },
  { key: "skillTargeting", alt: "overallSkillTargeting", label: "Skills" },
  { key: "difficulty", alt: "difficulty", label: "Difficulty" },
  { key: "theming", alt: "theming", label: "Theming" },
  { key: "printFormat", alt: "printFormat", label: "Print" },
  { key: "aboutness", alt: "aboutness", label: "Aboutness" },
];

export function dimensionCoverage(
  analysis: Record<string, unknown> | null,
): { label: string; present: boolean }[] {
  return SIX_DIMENSIONS.map(({ key, alt, label }) => ({
    label,
    present: analysis ? !isEmpty(analysis[key]) || !isEmpty(analysis[alt]) : false,
  }));
}
