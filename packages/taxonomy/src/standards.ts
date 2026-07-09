import type {
  CurriculumStandard,
  CurriculumStandardsFile,
} from "./types.js";
import { getAllTopics, getTopicById } from "./topics.js";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const csData = require("../data/curriculum-standards.json") as CurriculumStandardsFile;

// Lazy-init lookup maps
let standardMap: Map<string, CurriculumStandard> | null = null;
let standardToTopicIds: Map<string, string[]> | null = null;

function ensureStandardMap(): void {
  if (standardMap) return;
  standardMap = new Map();
  for (const curriculum of csData.curricula) {
    for (const topic of curriculum.topics) {
      standardMap.set(topic.key, topic);
    }
  }
}

function ensureStandardToTopicIds(): void {
  if (standardToTopicIds) return;
  standardToTopicIds = new Map();
  for (const topic of getAllTopics()) {
    for (const code of topic.standards) {
      const existing = standardToTopicIds.get(code);
      if (existing) existing.push(topic.id);
      else standardToTopicIds.set(code, [topic.id]);
    }
  }
}

/** Look up a standard by its full key (e.g. "uk-nc-2013:Ma5/2.1a"). */
export function getStandard(code: string): CurriculumStandard | undefined {
  ensureStandardMap();
  return standardMap!.get(code);
}

/** Returns all curriculum standards referenced by a topic. */
export function standardsForTopic(topicId: string): CurriculumStandard[] {
  ensureStandardMap();
  const topic = getTopicById(topicId);
  if (!topic) return [];
  const results: CurriculumStandard[] = [];
  for (const code of topic.standards) {
    const std = standardMap!.get(code);
    if (std) results.push(std);
  }
  return results;
}

/** Returns all topics that reference a given standard code. */
export function topicsForStandard(standardCode: string): ReturnType<typeof getTopicById>[] {
  ensureStandardToTopicIds();
  const ids = standardToTopicIds!.get(standardCode) ?? [];
  return ids.map(getTopicById).filter((t): t is NonNullable<typeof t> => t !== undefined);
}

/**
 * Returns standards coverage grouped by curriculum for a set of topic IDs.
 */
export function standardsCoverage(
  topicIds: string[]
): { curriculum: string; standards: CurriculumStandard[] }[] {
  ensureStandardMap();

  // Collect all referenced standard keys
  const referencedKeys = new Set<string>();
  for (const id of topicIds) {
    const topic = getTopicById(id);
    if (!topic) continue;
    for (const code of topic.standards) {
      referencedKeys.add(code);
    }
  }

  // Group by curriculum
  const result: { curriculum: string; standards: CurriculumStandard[] }[] = [];
  for (const curriculum of csData.curricula) {
    const matched = curriculum.topics.filter((s) => referencedKeys.has(s.key));
    if (matched.length > 0) {
      result.push({ curriculum: curriculum.slug, standards: matched });
    }
  }
  return result;
}
