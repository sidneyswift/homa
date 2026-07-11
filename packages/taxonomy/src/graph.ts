import type { TaxonomyPrerequisite, TaxonomyTopic } from "./types.js";
import { assembleTaxonomy } from "./assemble.js";
import { getTopic } from "./topics.js";

/**
 * The prerequisite graph over Homa topic ids. Score on the ladder, plan on
 * the graph (plan § Scoring stays on the ladder): these functions answer
 * "what is this child ready for next, and why", never "how far ahead".
 */

let forward: Map<string, TaxonomyPrerequisite[]> | null = null; // topic -> its prerequisites
let reverse: Map<string, TaxonomyPrerequisite[]> | null = null; // prerequisite -> topics it unlocks

function ensureGraph(): { fwd: Map<string, TaxonomyPrerequisite[]>; rev: Map<string, TaxonomyPrerequisite[]> } {
  if (!forward || !reverse) {
    forward = new Map();
    reverse = new Map();
    for (const edge of assembleTaxonomy().prerequisites) {
      const fwd = forward.get(edge.topicId);
      if (fwd) fwd.push(edge);
      else forward.set(edge.topicId, [edge]);
      const rev = reverse.get(edge.prerequisiteId);
      if (rev) rev.push(edge);
      else reverse.set(edge.prerequisiteId, [edge]);
    }
  }
  return { fwd: forward, rev: reverse };
}

export function allPrerequisiteEdges(): readonly TaxonomyPrerequisite[] {
  return assembleTaxonomy().prerequisites;
}

/** Direct prerequisites of a topic. */
export function prerequisitesOf(topicId: string): TaxonomyPrerequisite[] {
  return ensureGraph().fwd.get(topicId) ?? [];
}

/** Topics this topic directly unlocks. */
export function unlockedBy(topicId: string): TaxonomyPrerequisite[] {
  return ensureGraph().rev.get(topicId) ?? [];
}

/** Every transitive prerequisite of a topic (the full climb down). */
export function prerequisiteClosure(topicId: string): TaxonomyTopic[] {
  const { fwd } = ensureGraph();
  const visited = new Set<string>();
  const queue = [topicId];
  const result: TaxonomyTopic[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of fwd.get(current) ?? []) {
      if (!visited.has(edge.prerequisiteId)) {
        visited.add(edge.prerequisiteId);
        queue.push(edge.prerequisiteId);
        const topic = getTopic(edge.prerequisiteId);
        if (topic) result.push(topic);
      }
    }
  }
  return result;
}

/** Every topic transitively unlocked by mastering this one. */
export function unlockClosure(topicId: string): TaxonomyTopic[] {
  const { rev } = ensureGraph();
  const visited = new Set<string>();
  const queue = [topicId];
  const result: TaxonomyTopic[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of rev.get(current) ?? []) {
      if (!visited.has(edge.topicId)) {
        visited.add(edge.topicId);
        queue.push(edge.topicId);
        const topic = getTopic(edge.topicId);
        if (topic) result.push(topic);
      }
    }
  }
  return result;
}

export interface ReadyTopic {
  topic: TaxonomyTopic;
  /** The confirmed prerequisites that opened this topic, with reasons:
   * the receipts a plan or a chat answer can quote. */
  satisfiedBy: TaxonomyPrerequisite[];
}

/**
 * The readiness frontier: topics not yet confirmed whose HARD prerequisites
 * are all confirmed (soft edges advise ordering but never block). Root
 * topics (no hard prerequisites) count as ready. This is "what next" as a
 * graph query; callers filter by subject, domain kind, or teaching window.
 */
export function readyTopics(confirmedTopicIds: ReadonlySet<string>): ReadyTopic[] {
  const { fwd } = ensureGraph();
  const result: ReadyTopic[] = [];
  for (const topic of assembleTaxonomy().topics) {
    if (confirmedTopicIds.has(topic.id)) continue;
    const edges = fwd.get(topic.id) ?? [];
    const hard = edges.filter((edge) => edge.strength === "hard");
    if (hard.every((edge) => confirmedTopicIds.has(edge.prerequisiteId))) {
      result.push({
        topic,
        satisfiedBy: edges.filter((edge) => confirmedTopicIds.has(edge.prerequisiteId)),
      });
    }
  }
  return result;
}

/**
 * The deepest unconfirmed HARD prerequisite standing between the child and
 * a target topic, or null when the path is clear. The "what is actually in
 * the way" query.
 */
export function bottleneck(
  targetTopicId: string,
  confirmedTopicIds: ReadonlySet<string>,
): TaxonomyTopic | null {
  const { fwd } = ensureGraph();
  const visited = new Set<string>([targetTopicId]);
  const queue = [targetTopicId];
  let deepest: TaxonomyTopic | null = null;
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of fwd.get(current) ?? []) {
      if (edge.strength !== "hard" || visited.has(edge.prerequisiteId)) continue;
      visited.add(edge.prerequisiteId);
      queue.push(edge.prerequisiteId);
      if (!confirmedTopicIds.has(edge.prerequisiteId)) {
        const topic = getTopic(edge.prerequisiteId);
        if (topic) deepest = topic;
      }
    }
  }
  return deepest;
}

/** Kahn topological order over a subset of topics (teaching order). */
export function teachingOrder(topicIds: readonly string[]): TaxonomyTopic[] {
  const { fwd } = ensureGraph();
  const idSet = new Set(topicIds);
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of idSet) inDegree.set(id, 0);
  for (const id of idSet) {
    for (const edge of fwd.get(id) ?? []) {
      if (idSet.has(edge.prerequisiteId)) {
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
        const list = dependents.get(edge.prerequisiteId);
        if (list) list.push(id);
        else dependents.set(edge.prerequisiteId, [id]);
      }
    }
  }
  const queue: string[] = [];
  for (const [id, degree] of inDegree) if (degree === 0) queue.push(id);
  const result: TaxonomyTopic[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const topic = getTopic(current);
    if (topic) result.push(topic);
    for (const next of dependents.get(current) ?? []) {
      const degree = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }
  return result;
}

/** Highest-centrality topics in a subject whose teaching window contains
 * this age: where a probe buys the most information. */
export function hubTopics(subject: string, ageMonths: number, limit = 10): TaxonomyTopic[] {
  return assembleTaxonomy()
    .topics.filter(
      (topic) =>
        topic.subject === subject &&
        ageMonths >= topic.teachingWindowMonths[0] &&
        ageMonths < topic.teachingWindowMonths[1],
    )
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, limit);
}
