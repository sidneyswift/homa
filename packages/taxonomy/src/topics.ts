import type { TaxonomyTopic } from "./types";
import { assembleTaxonomy } from "./assemble";
import { getTaxonomyDomain } from "./domains";

/**
 * Topic accessors over the assembled Homa graph. Every id here is a Homa
 * id (`<subject>.<slug>`); teaching windows are in months.
 */

let topicIndex: Map<string, TaxonomyTopic> | null = null;

function ensureIndex(): Map<string, TaxonomyTopic> {
  if (!topicIndex) {
    topicIndex = new Map();
    for (const topic of assembleTaxonomy().topics) {
      topicIndex.set(topic.id, topic);
    }
  }
  return topicIndex;
}

export function getTopic(topicId: string): TaxonomyTopic | undefined {
  return ensureIndex().get(topicId);
}

export function allTopics(): readonly TaxonomyTopic[] {
  return assembleTaxonomy().topics;
}

export function topicsForSubject(subject: string): TaxonomyTopic[] {
  return assembleTaxonomy().topics.filter((topic) => topic.subject === subject);
}

export function topicsForDomain(domainId: string): TaxonomyTopic[] {
  return assembleTaxonomy().topics.filter((topic) => topic.domain === domainId);
}

/** Topics whose typical teaching window contains this age. */
export function topicsByTeachingAge(ageMonths: number): TaxonomyTopic[] {
  return assembleTaxonomy().topics.filter(
    (topic) =>
      ageMonths >= topic.teachingWindowMonths[0] &&
      ageMonths < topic.teachingWindowMonths[1],
  );
}

/**
 * Assessment-spine topics only: topics whose domain is kind "assessment".
 * Content-cluster topics (dinosaurs, ocean life) feed materials and
 * conversation, never scoring or readiness.
 */
export function assessmentTopics(): TaxonomyTopic[] {
  return assembleTaxonomy().topics.filter(
    (topic) => getTaxonomyDomain(topic.domain)?.kind === "assessment",
  );
}

/** Personalize an assessment prompt: replaces every {{name}} placeholder. */
export function personalizePrompt(prompt: string, childName: string): string {
  return prompt.replaceAll("{{name}}", childName);
}
