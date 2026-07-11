/**
 * Taxonomy types: the three-level skill graph (subject → domain → topic)
 * per docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md.
 *
 * Two vocabularies live here on purpose:
 *
 * - Marble* types mirror the vendored upstream dataset
 *   (packages/taxonomy/data/*.json, os-taxonomy v1) exactly as shipped.
 *   Their `mt_` ids never leave this package's import layer.
 * - Homa types are the product-facing shape. Every topic carries a Homa id
 *   in the bank convention `<subject>.<slug>` (founder ruling 2026-07-10:
 *   no marble_id anywhere); upstream lineage lives in the namespaced
 *   `refs` array (`marble:mt__h7hvT4tEb`, `ccss-math:K.CC.6`).
 */

/** How a topic is known: shapes how it is taught and how it is checked. */
export type TopicKind =
  | "conceptual"
  | "procedural"
  | "representational"
  | "language"
  | "meta";

export type PrerequisiteStrength = "hard" | "soft";

/** Level 2. A named skill line inside a subject (the Mac Mini's "subdomain"). */
export interface TaxonomyDomain {
  /** Globally unique kebab slug, e.g. "counting-cardinality". */
  id: string;
  /** Homa subject id this domain belongs to, e.g. "math". */
  subject: string;
  displayName: string;
  /**
   * assessment: scorable skill line, feeds the map and plans.
   * content: interest-led cluster (dinosaurs, ocean life); feeds materials
   * and conversation hooks, never the assessment spine.
   */
  kind: "assessment" | "content";
  /** Where this domain came from: imported from Marble or authored by Homa. */
  origin: "marble" | "homa";
}

/** Level 3. One teachable, checkable unit with a Homa id. */
export interface TaxonomyTopic {
  /** Homa id, bank convention: `<subject>.<slug>`. */
  id: string;
  subject: string;
  /** TaxonomyDomain id. */
  domain: string;
  name: string;
  description: string;
  kind: TopicKind;
  /** Typical teaching window in months (NOT a scoring anchor; anchors are
   * authored separately with citations, see the plan's honesty rules). */
  teachingWindowMonths: readonly [number, number];
  /** Observable mastery criteria (2-3 short lines). */
  evidence: readonly string[];
  /** A runnable parent scenario; contains a {{name}} placeholder. */
  assessmentPrompt: string | null;
  /**
   * Namespaced lineage + standards refs: `marble:mt__x`, `ccss-math:K.CC.6`,
   * `uk-nc-2013:Maths/Y1/NPV/4`. The ONLY place upstream ids survive.
   */
  refs: readonly string[];
  /** Recomputed graph centrality over the merged Homa graph, 0..1. */
  centrality: number;
}

/** A directed prerequisite edge between Homa topic ids. */
export interface TaxonomyPrerequisite {
  /** Homa topic id that depends on the prerequisite. */
  topicId: string;
  /** Homa topic id that must come first. */
  prerequisiteId: string;
  strength: PrerequisiteStrength;
  reason: string | null;
}

/** Parent-facing one-paragraph summary per (subject, domain, age band). */
export interface TaxonomyCluster {
  subject: string;
  /** TaxonomyDomain id. */
  domain: string;
  ageBandStartMonths: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Marble upstream shapes (mirror data/*.json exactly; internal to import).
// ---------------------------------------------------------------------------

export type MarbleTopicType =
  | "CONCEPTUAL"
  | "PROCEDURAL"
  | "META"
  | "LANGUAGE"
  | "REPRESENTATIONAL";

export interface MarbleTopic {
  id: string;
  type: MarbleTopicType;
  subject: string;
  domain: string;
  name: string;
  description: string;
  ageRangeStart: number;
  ageRangeEnd: number;
  centrality: number;
  evidence: string[];
  assessmentPrompt: string;
  standards: string[];
}

export interface MarbleDependency {
  topicId: string;
  prerequisiteId: string;
  strength: PrerequisiteStrength;
  reason: string;
}

export interface MarbleCluster {
  subject: string;
  domain: string;
  ageRangeStart: number;
  summary: string;
}

export interface CurriculumStandardData {
  title: string;
  description: string;
  subject: string;
  domain?: string;
  keyStage?: string;
  yearGroup?: string;
  year?: string;
  strand?: string;
  category?: string;
  discipline?: string;
  externalId?: string;
  notesAndGuidance?: string;
  workingScientifically?: string;
}

export interface CurriculumStandard {
  key: string;
  code: string;
  data: CurriculumStandardData;
}

export interface Curriculum {
  slug: string;
  country: string;
  name: string;
  version: string;
  sourceUrl: string;
  textIncluded: boolean;
  license: string;
  topicCount: number;
  topics: CurriculumStandard[];
}

export interface CurriculumStandardsFile {
  note: string;
  codesOnlySources: string[];
  curriculumCount: number;
  curricula: Curriculum[];
}

export interface MarbleTopicsFile {
  version: string;
  topicCount: number;
  topics: MarbleTopic[];
}

export interface MarbleDependenciesFile {
  version: string;
  note: string;
  edgeCount: number;
  dependencies: MarbleDependency[];
}

export interface MarbleClustersFile {
  version: string;
  clusterCount: number;
  clusters: MarbleCluster[];
}

/** Frozen Marble-id to Homa-id assignments (data/homa-slug-map.json).
 * Append-only: regeneration may add entries, never change existing ones,
 * so Homa topic ids stay stable across upstream re-syncs. */
export type SlugMapFile = Record<string, string>;
