// Marble Skill Taxonomy types, derived from the JSON data files.

export type TopicType =
  | "CONCEPTUAL"
  | "PROCEDURAL"
  | "META"
  | "LANGUAGE"
  | "REPRESENTATIONAL";

export type DependencyStrength = "hard" | "soft";

export interface Topic {
  id: string;
  type: TopicType;
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

export interface Dependency {
  topicId: string;
  prerequisiteId: string;
  strength: DependencyStrength;
  reason: string;
}

export interface Cluster {
  subject: string;
  domain: string;
  ageRangeStart: number;
  summary: string;
}

// Curriculum standards shape (from curriculum-standards.json)
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

// Manifest shape
export interface ManifestFileEntry {
  bytes: number;
  sha256: string;
}

export interface Manifest {
  dataset: string;
  taxonomyVersion: string;
  generatedAt: string;
  codesOnlySources: string[];
  counts: {
    topics: number;
    topicsBySubject: Record<string, number>;
    dependencies: number;
    curriculumStandards: number;
    clusters: number;
  };
  files: Record<string, ManifestFileEntry>;
  excluded: string[];
}

// Wrapper types for the JSON file roots
export interface TopicsFile {
  version: string;
  topicCount: number;
  topics: Topic[];
}

export interface DependenciesFile {
  version: string;
  note: string;
  edgeCount: number;
  dependencies: Dependency[];
}

export interface ClustersFile {
  version: string;
  clusterCount: number;
  clusters: Cluster[];
}
