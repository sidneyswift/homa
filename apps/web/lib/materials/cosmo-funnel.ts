/**
 * The inspo funnel's pure layer (/admin/studio, founder ask 2026-07-19):
 * parse Cosmo's ingestion corpus (.cosmo at the repo root) and cross it
 * against the shipped skill package, so the console can show the whole
 * pipeline: drop in #homa-inspo → analysis JSON → graduated recipe →
 * family output. Disk-free on purpose (the admin data layer feeds it),
 * so every rule here is unit-testable.
 *
 * Vocabulary: a "gap" is a format Cosmo flagged that no recipe could
 * produce at analysis time (recipeMatch.gaps in a reference JSON). A gap
 * is "covered" once the skill package or the activity-format registry
 * has a matching entry; the rest stay "open" and are the graduation
 * backlog this view exists to surface.
 */

export interface CosmoReferenceSummary {
  id: string;
  title: string;
  droppedBy: string;
  droppedAt: string;
  subject: string | null;
  format: string | null;
  matchedRecipes: string[];
  gapSlugs: string[];
}

export interface CosmoCurriculumSummary {
  id: string;
  name: string;
  droppedBy: string;
  droppedAt: string;
  methodology: string | null;
}

export interface CosmoGapRow {
  slug: string;
  /** How many reference analyses flagged it. */
  count: number;
  covered: boolean;
}

export interface CosmoGapCoverage {
  rows: CosmoGapRow[];
  coveredCount: number;
  openCount: number;
}

/** "Maze / puzzle practice" → "maze-puzzle-practice". Shared by section
 * headings, registry slugs, and gap names so they meet in one space. */
export function normalizeFormatSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Gap names that are not printable-format asks: curriculum analyses
 * record themselves as one synthetic gap, and belong to the curriculum
 * writer's funnel, not this one. */
const NON_FORMAT_GAPS = new Set(["curriculum-sample"]);

/** Cosmo's gap names that graduated under a different recipe name. Keys
 * and values are normalized slugs; values must match a SKILL.md section
 * or a registry slug (the coverage test enforces the ones that should). */
export const GAP_ALIASES: Record<string, string> = {
  "maze-activity": "maze-puzzle-practice",
  "angle-maze": "maze-puzzle-practice",
  "fraction-maze-escape": "maze-puzzle-practice",
  "math-puzzle-worksheet": "maze-puzzle-practice",
  "montessori-nomenclature-cards": "3-part-nomenclature-cards",
  "cross-curricular-unit-study": "unit-study-packet",
  "body-system-unit": "unit-study-packet",
  "country-study-pack": "unit-study-packet",
  "themed-activity-pack": "unit-study-packet",
  "labeled-science-diagram": "labeled-anatomy-diagram",
  "animal-anatomy-diagram-page": "labeled-anatomy-diagram",
  "naturalist-identification-poster": "nature-identification-poster",
  "same-different-worksheet": "matching-worksheet",
  "two-piece-puzzle-cards": "matching-worksheet",
  "developmental-progress-card": "checklist-assessment",
  "clip-card-activity": "clip-cards",
  "counting-clip-cards": "clip-cards",
  "phoneme-segmenting-card": "clip-cards",
  "picture-label-cloze": "cloze-story",
  "magazine-reading-comprehension": "reading-comprehension-mini-unit",
  "skill-transfer-passage": "reading-comprehension-mini-unit",
  "vocabulary-sidebar": "reading-comprehension-mini-unit",
  "printable-manipulative-set": "manipulatives",
  "dot-marker-activity": "dot-marker-activity",
  // Blossom & Root Level 0 ingest (2026-07-20) shipped recipes covering
  // gaps the earlier Early Years Vol. 2 ingest (2026-07-19) had proposed
  // under different names.
  "nature-notebook-page": "nature-observation-journal",
  "picture-study-card": "artist-composer-study-card",
  // Blossom & Root Year 3 (2026-07-31) names a broad word-play activity
  // around its instructional purpose. The existing recipe owns the exact
  // see, write, cut, and paste mechanic without copying the source words.
  "word-play-cut-and-sort": "cut-and-paste-word-work",
  // Mike Venezia Getting to Know trio (2026-07-21 curriculum-gap
  // graduation): artists and inventors-scientists each flagged the same
  // life-events-timeline shape under their own subject-specific name; both
  // shipped as one shared recipe, biography-timeline-page, with a
  // life-events mode and an invention-progression mode.
  "artist-biography-timeline-page": "biography-timeline-page",
  "invention-timeline-page": "biography-timeline-page",
  // Stairway to Reading (2026-07-31) described eight source activity
  // names. Three are modes of broader shipped mechanics, and the source's
  // phonics-deck name belongs to the existing subject-neutral flash-card
  // surface. Scoring and instructional routing remain code-owned inside the
  // diagnostic contract, never prose authored for a printable.
  "reading-placement-screen": "phonics-spelling-diagnostic-assessment",
  "phonics-mastery-check": "phonics-spelling-diagnostic-assessment",
  "phonics-word-bingo": "picture-bingo-board",
  "phonics-flash-card-deck": "flash-cards",
  // Benchmark Grade 3 (2026-07-31) named one warm repeated-reading mechanic
  // as a speed drill and one subject-specific card deck. The canonical
  // recipes preserve the real procedure without source framing. Timing and
  // progression policies remain deterministic inputs, never generated copy.
  "word-fluency-speed-drill": "word-fluency-repeated-reading",
  "high-frequency-word-card-deck": "flash-cards",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** A gap entry is either a bare name string or {name|format, description}.
 * Free-text observations ("no maze", long prose) are not format asks and
 * are dropped: only slug-shaped names survive. */
export function extractGapSlugs(recipeMatch: unknown): string[] {
  const record = asRecord(recipeMatch);
  const gaps = record?.gaps;
  if (!Array.isArray(gaps)) return [];
  const slugs: string[] = [];
  for (const gap of gaps) {
    const name =
      typeof gap === "string"
        ? gap
        : (asString(asRecord(gap)?.name) ?? asString(asRecord(gap)?.format));
    if (!name) continue;
    if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name)) continue;
    if (NON_FORMAT_GAPS.has(name)) continue;
    slugs.push(name);
  }
  return slugs;
}

export function parseCosmoReference(raw: unknown): CosmoReferenceSummary | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  const droppedAt = asString(record.droppedAt);
  if (!id || !droppedAt) return null;
  const targeting = asRecord(record.skillTargeting);
  const recipeMatch = asRecord(record.recipeMatch);
  const matched = Array.isArray(recipeMatch?.matchedRecipes)
    ? recipeMatch.matchedRecipes.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      )
    : [];
  return {
    id,
    title: asString(record.title) ?? id,
    droppedBy: asString(record.droppedBy) ?? "unknown",
    droppedAt,
    subject: asString(targeting?.subject),
    format: asString(record.format),
    matchedRecipes: matched,
    gapSlugs: extractGapSlugs(record.recipeMatch),
  };
}

export function parseCosmoCurriculum(raw: unknown): CosmoCurriculumSummary | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asString(record.id);
  const droppedAt = asString(record.droppedAt);
  if (!id || !droppedAt) return null;
  return {
    id,
    name: asString(record.name) ?? id,
    droppedBy: asString(record.droppedBy) ?? "unknown",
    droppedAt,
    methodology: asString(record.methodology),
  };
}

/** Registry slugs from activity-formats.md: `- **Slug:** `[clip-cards]`` */
export function parseRegistrySlugs(markdown: string): string[] {
  const slugs: string[] = [];
  const pattern = /^- \*\*Slug:\*\* `\[([a-z0-9-]+)\]`/gm;
  for (const match of markdown.matchAll(pattern)) slugs.push(match[1]);
  return slugs;
}

/** Catalog entry statuses from inspo-catalog.md: `**Status:** noted` */
export function parseCatalogStatuses(markdown: string): Map<string, number> {
  const counts = new Map<string, number>();
  const pattern = /^\*\*Status:\*\* (.+)$/gm;
  for (const match of markdown.matchAll(pattern)) {
    const status = match[1].trim();
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return counts;
}

function isCovered(canonical: string, sectionSlugs: string[], registry: Set<string>): boolean {
  if (registry.has(canonical)) return true;
  for (const section of sectionSlugs) {
    if (section === canonical) return true;
    // Containment catches "pattern-cut-and-paste" → registry
    // "cut-and-paste" and alias "manipulatives" → the manipulatives
    // section; the length guard keeps short fragments from matching.
    if (canonical.length >= 8 && section.includes(canonical)) return true;
  }
  if (canonical.length >= 8) {
    for (const slug of registry) {
      if (slug.length >= 8 && canonical.includes(slug)) return true;
    }
  }
  return false;
}

/** Cross Cosmo's flagged gaps against what actually shipped. Sections
 * are SKILL.md ## headings verbatim; registrySlugs come from
 * activity-formats.md. Rows sort open-first, then by how many analyses
 * asked, then by name, so the backlog reads top-down. */
export function computeGapCoverage(
  references: CosmoReferenceSummary[],
  sectionHeadings: string[],
  registrySlugs: string[],
): CosmoGapCoverage {
  const counts = new Map<string, number>();
  for (const reference of references) {
    for (const slug of reference.gapSlugs) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  const sectionSlugs = sectionHeadings.map(normalizeFormatSlug);
  const registry = new Set(registrySlugs.map(normalizeFormatSlug));
  const rows: CosmoGapRow[] = [...counts.entries()].map(([slug, count]) => {
    const canonical = GAP_ALIASES[slug] ?? slug;
    return { slug, count, covered: isCovered(canonical, sectionSlugs, registry) };
  });
  rows.sort((a, b) => {
    if (a.covered !== b.covered) return a.covered ? 1 : -1;
    if (a.count !== b.count) return b.count - a.count;
    return a.slug.localeCompare(b.slug);
  });
  return {
    rows,
    coveredCount: rows.filter((row) => row.covered).length,
    openCount: rows.filter((row) => !row.covered).length,
  };
}

export interface CosmoIntakeSummary {
  referenceCount: number;
  curriculumCount: number;
  byDropper: { dropper: string; count: number }[];
  latestDropAt: string | null;
  latestDrops: (
    | { kind: "reference"; entry: CosmoReferenceSummary }
    | { kind: "curriculum"; entry: CosmoCurriculumSummary }
  )[];
  matchedReferenceCount: number;
}

/** One intake picture across both corpora, newest first. */
export function summarizeIntake(
  references: CosmoReferenceSummary[],
  curriculums: CosmoCurriculumSummary[],
  latestLimit: number,
): CosmoIntakeSummary {
  const droppers = new Map<string, number>();
  for (const entry of [...references, ...curriculums]) {
    droppers.set(entry.droppedBy, (droppers.get(entry.droppedBy) ?? 0) + 1);
  }
  const latest = [
    ...references.map((entry) => ({ kind: "reference" as const, entry })),
    ...curriculums.map((entry) => ({ kind: "curriculum" as const, entry })),
  ]
    .sort((a, b) => (a.entry.droppedAt < b.entry.droppedAt ? 1 : -1))
    .slice(0, latestLimit);
  return {
    referenceCount: references.length,
    curriculumCount: curriculums.length,
    byDropper: [...droppers.entries()]
      .map(([dropper, count]) => ({ dropper, count }))
      .sort((a, b) => b.count - a.count),
    latestDropAt: latest[0]?.entry.droppedAt ?? null,
    latestDrops: latest,
    matchedReferenceCount: references.filter((entry) => entry.matchedRecipes.length > 0)
      .length,
  };
}
