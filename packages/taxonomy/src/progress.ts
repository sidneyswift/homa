import {
  TAXONOMY_DOMAINS,
  getTaxonomyDomain,
} from "./domains";
import { GENERATED_PROGRESS_TAXONOMY_TOPICS } from "./progress.generated";

/** Domain metadata needed by the server-side progress projection. */
export interface ProgressTaxonomyDomain {
  readonly id: string;
  readonly subject: string;
  readonly displayName: string;
  readonly kind: "assessment" | "content";
}

/** Topic metadata needed by the server-side progress projection. */
export interface ProgressTaxonomyTopic {
  readonly id: string;
  readonly subject: string;
  readonly domain: string;
  readonly name: string;
  readonly teachingWindowMonths: readonly [number, number];
}

function toProgressDomain(
  domain: ProgressTaxonomyDomain,
): ProgressTaxonomyDomain {
  return {
    id: domain.id,
    subject: domain.subject,
    displayName: domain.displayName,
    kind: domain.kind,
  };
}

export const PROGRESS_TAXONOMY_DOMAINS: readonly ProgressTaxonomyDomain[] =
  TAXONOMY_DOMAINS.map(toProgressDomain);
export const PROGRESS_TAXONOMY_TOPICS: readonly ProgressTaxonomyTopic[] =
  GENERATED_PROGRESS_TAXONOMY_TOPICS;

const progressTopicIndex = new Map(
  PROGRESS_TAXONOMY_TOPICS.map((topic) => [topic.id, topic]),
);

export function getProgressTaxonomyDomain(
  domainId: string,
): ProgressTaxonomyDomain | undefined {
  const domain = getTaxonomyDomain(domainId);
  return domain === undefined ? undefined : toProgressDomain(domain);
}

export function getProgressTaxonomyTopic(
  topicId: string,
): ProgressTaxonomyTopic | undefined {
  return progressTopicIndex.get(topicId);
}
