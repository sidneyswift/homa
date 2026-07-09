// Types
export type {
  Topic,
  TopicType,
  Dependency,
  DependencyStrength,
  Cluster,
  CurriculumStandard,
  CurriculumStandardData,
  Curriculum,
  CurriculumStandardsFile,
  Manifest,
  ManifestFileEntry,
  TopicsFile,
  DependenciesFile,
  ClustersFile,
} from "./types.js";

// Topic accessors
export {
  getTopicById,
  getAllTopics,
  topicsByAge,
  topicsBySubjectDomain,
  topicsByInterest,
  assessmentPromptsForDomain,
} from "./topics.js";

// Domain mapping
export {
  homaDomainForTopic,
  topicsForHomaDomain,
  MAPPED_HOMA_DOMAINS,
  UNMAPPED_HOMA_DOMAINS,
} from "./mapping.js";

// Prerequisite graph
export {
  prerequisitesOf,
  unlockedBy,
  allPrerequisites,
  allUnlocked,
  pathBetween,
  topologicalOrder,
  bottleneck,
  hubTopics,
} from "./graph.js";

// Curriculum standards
export {
  getStandard,
  standardsForTopic,
  topicsForStandard,
  standardsCoverage,
} from "./standards.js";

// Clusters
export {
  clusterSummary,
  allClustersForDomain,
} from "./clusters.js";
