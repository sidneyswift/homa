/**
 * Taxonomy guard (plan 2026-07-10-skill-graph-taxonomy § Sequencing 4).
 * Validates the Homa skill graph end to end, one exit code:
 *
 *   1. Import completeness: every Marble Subject>Domain pair is mapped and
 *      every Marble topic has a frozen Homa id (an upstream sync that adds
 *      a domain fails loudly instead of silently dropping topics).
 *   2. Id law: Homa topic ids follow `<subject>.<slug>`, are globally
 *      unique, and never collide with shipped bank item ids (child_answers
 *      rows key off those).
 *   3. Graph law: every edge references real topics and the graph is a DAG.
 *   4. Registry law: every topic's domain exists, subject-matches, and
 *      every bank item is assigned to exactly one assessment domain of its
 *      own subject (item-domains.ts stays total).
 *   5. Data sanity: centrality in [0,1], teaching windows ordered,
 *      every topic carries its marble: lineage ref, standards refs resolve.
 *
 * Usage: pnpm check:taxonomy   (runs upstream validate.mjs first)
 */

import {
  assembleTaxonomy,
  getStandard,
  getTaxonomyDomain,
  MARBLE_DOMAIN_MAP,
  TAXONOMY_DOMAINS,
} from "../packages/taxonomy/src/index.js";
import { MAP_SUBJECTS } from "../packages/core/src/map/content.js";
import { BANK_ITEM_DOMAINS } from "../packages/core/src/map/item-domains.js";

const failures: string[] = [];

function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

const taxonomy = assembleTaxonomy();

// 1. Import completeness
report(
  "every Marble subject>domain pair is mapped",
  taxonomy.unmappedPairs.length === 0,
  taxonomy.unmappedPairs.join(", "),
);
report(
  "every Marble topic has a frozen Homa id",
  taxonomy.unmappedTopicIds.length === 0,
  `${taxonomy.unmappedTopicIds.length} missing, run pnpm taxonomy:slugs`,
);

// 2. Id law
const bankItemIds = new Set<string>();
const bankSubjects = new Set<string>();
for (const subject of MAP_SUBJECTS) {
  bankSubjects.add(subject.id);
  for (const item of subject.items) bankItemIds.add(item.id);
}

const knownSubjects = new Set<string>([...bankSubjects, "life_skills"]);
const topicIds = new Set<string>();
let duplicateTopicIds = 0;
let malformedIds = 0;
let bankCollisions = 0;
for (const topic of taxonomy.topics) {
  if (topicIds.has(topic.id)) duplicateTopicIds += 1;
  topicIds.add(topic.id);
  const dot = topic.id.indexOf(".");
  const prefix = dot === -1 ? "" : topic.id.slice(0, dot);
  if (dot === -1 || prefix !== topic.subject || !knownSubjects.has(prefix)) {
    malformedIds += 1;
  }
  if (bankItemIds.has(topic.id)) bankCollisions += 1;
}
report("topic ids are unique", duplicateTopicIds === 0, `${duplicateTopicIds} duplicates`);
report("topic ids follow <subject>.<slug> with a known subject", malformedIds === 0, `${malformedIds} malformed`);
report("no topic id collides with a bank item id", bankCollisions === 0, `${bankCollisions} collisions`);

// 3. Graph law
let danglingEdges = 0;
for (const edge of taxonomy.prerequisites) {
  if (!topicIds.has(edge.topicId) || !topicIds.has(edge.prerequisiteId)) danglingEdges += 1;
}
report("every edge references real topics", danglingEdges === 0, `${danglingEdges} dangling`);

{
  // Kahn's algorithm: the graph is a DAG iff every node gets processed.
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of topicIds) inDegree.set(id, 0);
  for (const edge of taxonomy.prerequisites) {
    inDegree.set(edge.topicId, (inDegree.get(edge.topicId) ?? 0) + 1);
    const list = dependents.get(edge.prerequisiteId);
    if (list) list.push(edge.topicId);
    else dependents.set(edge.prerequisiteId, [edge.topicId]);
  }
  const queue: string[] = [];
  for (const [id, degree] of inDegree) if (degree === 0) queue.push(id);
  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift() as string;
    processed += 1;
    for (const next of dependents.get(current) ?? []) {
      const degree = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  report("prerequisite graph is acyclic", processed === topicIds.size, `${topicIds.size - processed} nodes stuck in cycles`);
}

// 4. Registry law
{
  const domainIds = new Set<string>();
  let duplicateDomains = 0;
  for (const domain of TAXONOMY_DOMAINS) {
    if (domainIds.has(domain.id)) duplicateDomains += 1;
    domainIds.add(domain.id);
  }
  report("domain ids are unique", duplicateDomains === 0, `${duplicateDomains} duplicates`);

  let subjectMismatches = 0;
  for (const target of Object.values(MARBLE_DOMAIN_MAP)) {
    const domain = getTaxonomyDomain(target.domainId);
    if (!domain || domain.subject !== target.subject) subjectMismatches += 1;
  }
  report("marble mapping targets exist with matching subjects", subjectMismatches === 0, `${subjectMismatches} mismatches`);

  let badTopicDomains = 0;
  for (const topic of taxonomy.topics) {
    const domain = getTaxonomyDomain(topic.domain);
    if (!domain || domain.subject !== topic.subject) badTopicDomains += 1;
  }
  report("every topic sits in a real domain of its own subject", badTopicDomains === 0, `${badTopicDomains} bad`);

  let badClusterDomains = 0;
  for (const cluster of taxonomy.clusters) {
    const domain = getTaxonomyDomain(cluster.domain);
    if (!domain || domain.subject !== cluster.subject) badClusterDomains += 1;
  }
  report("every cluster sits in a real domain of its own subject", badClusterDomains === 0, `${badClusterDomains} bad`);

  const missingAssignments: string[] = [];
  const badAssignments: string[] = [];
  for (const itemId of bankItemIds) {
    const domainId = BANK_ITEM_DOMAINS[itemId];
    if (!domainId) {
      missingAssignments.push(itemId);
      continue;
    }
    const domain = getTaxonomyDomain(domainId);
    const subject = itemId.slice(0, itemId.indexOf("."));
    if (!domain || domain.subject !== subject || domain.kind !== "assessment") {
      badAssignments.push(itemId);
    }
  }
  const orphanAssignments = Object.keys(BANK_ITEM_DOMAINS).filter((id) => !bankItemIds.has(id));
  report("every bank item is assigned a domain", missingAssignments.length === 0, missingAssignments.slice(0, 5).join(", "));
  report("bank assignments point at assessment domains of the item's subject", badAssignments.length === 0, badAssignments.slice(0, 5).join(", "));
  report("no bank assignment references a retired item", orphanAssignments.length === 0, orphanAssignments.slice(0, 5).join(", "));
}

// 5. Data sanity
{
  let badCentrality = 0;
  let badWindows = 0;
  let missingLineage = 0;
  let unresolvedRefs = 0;
  for (const topic of taxonomy.topics) {
    if (topic.centrality < 0 || topic.centrality > 1) badCentrality += 1;
    const [start, end] = topic.teachingWindowMonths;
    if (!(start < end) || start < 24) badWindows += 1;
    if (!topic.refs.some((ref) => ref.startsWith("marble:"))) missingLineage += 1;
    for (const ref of topic.refs) {
      if (!ref.startsWith("marble:") && !getStandard(ref)) unresolvedRefs += 1;
    }
  }
  report("centrality stays in [0,1]", badCentrality === 0, `${badCentrality} out of range`);
  report("teaching windows are ordered and start at 24mo+", badWindows === 0, `${badWindows} bad`);
  report("every imported topic carries its marble: lineage ref", missingLineage === 0, `${missingLineage} missing`);
  report("every standards ref resolves in the registry", unresolvedRefs === 0, `${unresolvedRefs} unresolved`);
}

console.log(
  `\ntaxonomy: ${taxonomy.topics.length} topics · ${taxonomy.prerequisites.length} edges · ` +
    `${TAXONOMY_DOMAINS.length} domains · ${taxonomy.clusters.length} clusters · ` +
    `${bankItemIds.size} anchored bank items assigned`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURE(S)`);
  process.exit(1);
}
console.log("\nAll taxonomy checks passed.");
