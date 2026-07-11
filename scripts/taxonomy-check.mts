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
 *   6. Walk-engine laws (plans/2026-07-11-onboarding-depth-fork.md): the
 *      graph walk is deterministic, never asks what an answer already
 *      settled, prunes hard dependents of a miss, respects the budget
 *      and the authored-card gate, and terminates.
 *
 * Usage: pnpm check:taxonomy   (runs upstream validate.mjs first)
 */

import {
  allPrerequisiteEdges,
  assembleTaxonomy,
  getStandard,
  getTaxonomyDomain,
  getTopic,
  MARBLE_DOMAIN_MAP,
  nextWalkCard,
  TAXONOMY_DOMAINS,
  WALK_BUDGET,
  walkKnowledge,
  walkOutcome,
  walkSummary,
  type WalkAnswer,
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

// 6. Walk-engine laws
{
  // A real hard edge between two assessment topics of one subject: the
  // fixture every law below runs against, so the checks hold for the
  // actual corpus, not a toy graph.
  const hardEdge = allPrerequisiteEdges().find((edge) => {
    if (edge.strength !== "hard") return false;
    const dependent = getTopic(edge.topicId);
    const prerequisite = getTopic(edge.prerequisiteId);
    return Boolean(
      dependent &&
        prerequisite &&
        dependent.subject === prerequisite.subject &&
        getTaxonomyDomain(dependent.domain)?.kind === "assessment" &&
        getTaxonomyDomain(prerequisite.domain)?.kind === "assessment",
    );
  });
  report("a same-subject hard edge exists to test the walk against", hardEdge !== undefined);

  if (hardEdge) {
    const dependent = getTopic(hardEdge.topicId);
    const subject = dependent?.subject ?? "math";
    const seedAge = dependent
      ? Math.min(dependent.teachingWindowMonths[0] + 6, 168)
      : 72;

    // Determinism: equal inputs always serve the same card.
    const first = nextWalkCard(subject, seedAge, {}, 0);
    const again = nextWalkCard(subject, seedAge, {}, 0);
    report(
      "walk serves deterministically",
      first !== null && again !== null && first.topic.id === again.topic.id,
      `got ${first?.topic.id} then ${again?.topic.id}`,
    );

    // The seed card is an assessment topic of the subject, window-fit.
    report(
      "walk seed is an in-window assessment topic of the subject",
      first !== null &&
        first.topic.subject === subject &&
        getTaxonomyDomain(first.topic.domain)?.kind === "assessment" &&
        seedAge >= first.topic.teachingWindowMonths[0] &&
        seedAge < first.topic.teachingWindowMonths[1],
      first?.topic.id ?? "no card",
    );

    // Answered topics are consumed: never served twice.
    const afterAnswer = first
      ? nextWalkCard(subject, seedAge, { [first.topic.id]: "easily" }, 1)
      : null;
    report(
      "an answered card is never re-served",
      first !== null && (afterAnswer === null || afterAnswer.topic.id !== first.topic.id),
      `re-served ${first?.topic.id}`,
    );

    // "easily" implies the hard prerequisite closure (never re-asked)...
    const implied = walkKnowledge({ [hardEdge.topicId]: "easily" });
    report(
      "easily confirms the hard prerequisite closure",
      implied.confirmed.has(hardEdge.prerequisiteId),
      `${hardEdge.prerequisiteId} not implied by ${hardEdge.topicId}`,
    );

    // ...but an explicit miss always beats an implied confirmation.
    const contradicted = walkKnowledge({
      [hardEdge.topicId]: "easily",
      [hardEdge.prerequisiteId]: "not_yet",
    });
    report(
      "an explicit not_yet beats an implied confirmation",
      !contradicted.confirmed.has(hardEdge.prerequisiteId),
    );

    // "not yet" prunes every transitive hard dependent.
    const pruned = walkKnowledge({ [hardEdge.prerequisiteId]: "not_yet" });
    report(
      "not_yet blocks the topic's hard dependents",
      pruned.blocked.has(hardEdge.topicId),
      `${hardEdge.topicId} still askable after missing ${hardEdge.prerequisiteId}`,
    );

    // The summary agrees: a blocked topic is never "ready", the missed
    // topic is the named next step in its own domain.
    const summaries = walkSummary(subject, { [hardEdge.prerequisiteId]: "not_yet" });
    const flatReady = summaries.flatMap((entry) => entry.readyIds);
    const missedDomain = summaries.find(
      (entry) => entry.domainId === getTopic(hardEdge.prerequisiteId)?.domain,
    );
    report("summary never lists a blocked topic as ready", !flatReady.includes(hardEdge.topicId));
    report(
      "summary names the missed topic as a next step",
      missedDomain !== undefined && missedDomain.notYetIds.includes(hardEdge.prerequisiteId),
    );

    // Budget law: the sitting cap is absolute.
    report(
      "walk stops at the sitting budget",
      nextWalkCard(subject, seedAge, {}, WALK_BUDGET) === null,
    );

    // Authored-card gate: an empty card registry serves nothing, and an
    // ended sitting with cards left reads budget_reached, not frontier.
    report(
      "walk serves only topics with an authored card",
      nextWalkCard(subject, seedAge, {}, 0, new Set<string>()) === null,
    );
    report(
      "outcome is budget_reached while informative cards remain",
      walkOutcome(subject, seedAge, {}, WALK_BUDGET) === "budget_reached",
    );
    report(
      "outcome is frontier_found when nothing askable remains",
      walkOutcome(subject, seedAge, {}, WALK_BUDGET, new Set<string>()) === "frontier_found",
    );

    // Termination: a full sitting of any chip mix always ends, within
    // budget, without repeating a card.
    const chips: WalkAnswer[] = ["easily", "not_yet", "getting_there", "easily", "not_sure", "easily", "skip", "not_yet"];
    const answers: Record<string, WalkAnswer> = {};
    const served: string[] = [];
    for (let turn = 0; turn <= WALK_BUDGET; turn += 1) {
      const card = nextWalkCard(subject, seedAge, answers, turn);
      if (!card) break;
      served.push(card.topic.id);
      answers[card.topic.id] = chips[turn % chips.length];
    }
    report(
      "a full sitting terminates within budget without repeats",
      served.length <= WALK_BUDGET && new Set(served).size === served.length,
      `served ${served.length} cards, ${new Set(served).size} unique`,
    );
  }
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
