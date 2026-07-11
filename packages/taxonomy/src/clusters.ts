import type { TaxonomyCluster } from "./types";
import { assembleTaxonomy } from "./assemble";

/**
 * Parent-facing cluster summaries per (subject, domain, age band): the
 * one-paragraph "what your child is learning here right now" lines that
 * seed report drawers and subject pages.
 */

export function allClusters(): readonly TaxonomyCluster[] {
  return assembleTaxonomy().clusters;
}

export function clustersForDomain(domainId: string): TaxonomyCluster[] {
  return assembleTaxonomy().clusters.filter((cluster) => cluster.domain === domainId);
}

/** The cluster whose age band contains this age, for one domain. Bands are
 * annual; a band matches from its start until the next band's start. */
export function clusterSummary(domainId: string, ageMonths: number): string | null {
  const bands = clustersForDomain(domainId).sort(
    (a, b) => a.ageBandStartMonths - b.ageBandStartMonths,
  );
  let match: TaxonomyCluster | null = null;
  for (const cluster of bands) {
    if (cluster.ageBandStartMonths <= ageMonths) match = cluster;
  }
  return match?.summary ?? null;
}
