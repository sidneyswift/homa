/**
 * @homa/taxonomy: the subject → domain → topic skill graph.
 * Plan: docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md.
 *
 * Server-side only by intent: the assembled graph is a few MB of data and
 * must never enter a client bundle (the map bank in @homa/core stays the
 * client-safe scored spine).
 *
 * The root export is intentionally broader than today's product imports.
 * `@homa/taxonomy/domains` is the narrow runtime path used by app code;
 * this root API is the staged server-side graph surface for taxonomy
 * checks, research tasks, curriculum crosswalks, and future readiness
 * planning. Do not import this root module from client components.
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
} from "./types";

export {
  TAXONOMY_DOMAINS,
  getTaxonomyDomain,
  domainsForSubject,
} from "./domains";

export {
  getTopic,
  allTopics,
  topicsForSubject,
  topicsForDomain,
  topicsByTeachingAge,
  assessmentTopics,
  personalizePrompt,
} from "./topics";

/**
 * Staged server-side planning API. Most product surfaces currently consume
 * only getTaxonomyDomain, but these graph/cluster/standards operations are
 * the planned seam for the skill-graph teaching-order work in the plan named
 * above. They stay deliberately public rather than looking like accidental
 * dead exports (2026-07-11 review, CR-48).
 */
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
} from "./graph";

export { allClusters, clustersForDomain, clusterSummary } from "./clusters";

export {
  WALK_BUDGET,
  hardPrerequisiteClosure,
  hardUnlockClosure,
  nextWalkCard,
  walkKnowledge,
  walkOutcome,
  walkSummary,
  type WalkAnswer,
  type WalkAnswers,
  type WalkCard,
  type WalkDomainSummary,
  type WalkKnowledge,
  type WalkOutcome,
} from "./walk";

export { WALK_CARDS, askableTopicIds, walkCardStatement } from "./cards";

export { curricula, getStandard, standardsForTopic } from "./standards";

export {
  MARBLE_DOMAIN_MAP,
  marbleDomainKey,
  topicKindFromMarble,
  type MarbleDomainTarget,
} from "./mapping";

export { assembleTaxonomy, type AssembledTaxonomy } from "./assemble";
