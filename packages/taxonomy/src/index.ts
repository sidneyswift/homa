/**
 * @homa/taxonomy: the subject → domain → topic skill graph.
 * Plan: docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md.
 *
 * Server-side only by intent: the assembled graph is a few MB of data and
 * must never enter a client bundle (the map bank in @homa/core stays the
 * client-safe scored spine).
 */

export type {
  TopicKind,
  PrerequisiteStrength,
  TaxonomyDomain,
  TaxonomyTopic,
  TaxonomyPrerequisite,
  TaxonomyCluster,
  Curriculum,
  CurriculumStandard,
  CurriculumStandardData,
} from "./types.js";

export {
  TAXONOMY_DOMAINS,
  getTaxonomyDomain,
  domainsForSubject,
} from "./domains.js";

export {
  getTopic,
  allTopics,
  topicsForSubject,
  topicsForDomain,
  topicsByTeachingAge,
  assessmentTopics,
  personalizePrompt,
} from "./topics.js";

export {
  allPrerequisiteEdges,
  prerequisitesOf,
  unlockedBy,
  prerequisiteClosure,
  unlockClosure,
  readyTopics,
  bottleneck,
  teachingOrder,
  hubTopics,
  type ReadyTopic,
} from "./graph.js";

export { allClusters, clustersForDomain, clusterSummary } from "./clusters.js";

export { curricula, getStandard, standardsForTopic } from "./standards.js";

export {
  MARBLE_DOMAIN_MAP,
  marbleDomainKey,
  topicKindFromMarble,
  type MarbleDomainTarget,
} from "./mapping.js";

export { assembleTaxonomy, type AssembledTaxonomy } from "./assemble.js";
