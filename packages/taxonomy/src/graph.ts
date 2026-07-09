import type { Dependency, Topic } from "./types.js";
import type { DependenciesFile } from "./types.js";
import { getTopicById, getAllTopics, topicsByAge } from "./topics.js";
import { homaDomainForTopic } from "./mapping.js";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const depsData = require("../data/dependencies.json") as DependenciesFile;

// Lazy-init adjacency lists
let forwardMap: Map<string, Dependency[]> | null = null; // topicId -> its prerequisites
let reverseMap: Map<string, Dependency[]> | null = null; // prerequisiteId -> topics it unlocks

function ensureGraph(): void {
  if (forwardMap) return;
  forwardMap = new Map();
  reverseMap = new Map();
  for (const dep of depsData.dependencies) {
    const fwd = forwardMap.get(dep.topicId);
    if (fwd) fwd.push(dep);
    else forwardMap.set(dep.topicId, [dep]);

    const rev = reverseMap.get(dep.prerequisiteId);
    if (rev) rev.push(dep);
    else reverseMap.set(dep.prerequisiteId, [dep]);
  }
}

/** Direct prerequisites of a topic. */
export function prerequisitesOf(topicId: string): Dependency[] {
  ensureGraph();
  return forwardMap!.get(topicId) ?? [];
}

/** Topics directly unlocked by completing this topic (reverse edges). */
export function unlockedBy(topicId: string): Dependency[] {
  ensureGraph();
  return reverseMap!.get(topicId) ?? [];
}

/** Transitive closure: all ancestor prerequisites (BFS). */
export function allPrerequisites(topicId: string): Topic[] {
  ensureGraph();
  const visited = new Set<string>();
  const queue = [topicId];
  const result: Topic[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = forwardMap!.get(current) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep.prerequisiteId)) {
        visited.add(dep.prerequisiteId);
        queue.push(dep.prerequisiteId);
        const t = getTopicById(dep.prerequisiteId);
        if (t) result.push(t);
      }
    }
  }
  return result;
}

/** Transitive closure: all descendant topics unlocked (BFS). */
export function allUnlocked(topicId: string): Topic[] {
  ensureGraph();
  const visited = new Set<string>();
  const queue = [topicId];
  const result: Topic[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = reverseMap!.get(current) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep.topicId)) {
        visited.add(dep.topicId);
        queue.push(dep.topicId);
        const t = getTopicById(dep.topicId);
        if (t) result.push(t);
      }
    }
  }
  return result;
}

/**
 * Shortest prerequisite path from `fromId` to `toId`.
 * BFS from target backwards through prerequisites.
 * Returns null if no path exists. Returns the path including both endpoints.
 */
export function pathBetween(fromId: string, toId: string): Topic[] | null {
  if (fromId === toId) {
    const t = getTopicById(fromId);
    return t ? [t] : null;
  }
  ensureGraph();
  const parent = new Map<string, string>();
  const visited = new Set<string>([toId]);
  const queue = [toId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = forwardMap!.get(current) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep.prerequisiteId)) {
        visited.add(dep.prerequisiteId);
        parent.set(dep.prerequisiteId, current);
        if (dep.prerequisiteId === fromId) {
          // Reconstruct path
          const path: Topic[] = [];
          let node: string | undefined = fromId;
          while (node !== undefined) {
            const t = getTopicById(node);
            if (t) path.push(t);
            node = node === toId ? undefined : parent.get(node);
          }
          return path;
        }
        queue.push(dep.prerequisiteId);
      }
    }
  }
  return null;
}

/**
 * Topological sort of a subset of topic IDs using Kahn's algorithm.
 * Returns topics in teaching order (prerequisites first).
 */
export function topologicalOrder(topicIds: string[]): Topic[] {
  ensureGraph();
  const idSet = new Set(topicIds);

  // Build in-degree map restricted to this subset
  const inDegree = new Map<string, number>();
  const subForward = new Map<string, string[]>();
  for (const id of idSet) {
    inDegree.set(id, 0);
    subForward.set(id, []);
  }
  for (const id of idSet) {
    const deps = forwardMap!.get(id) ?? [];
    for (const dep of deps) {
      if (idSet.has(dep.prerequisiteId)) {
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
        subForward.get(dep.prerequisiteId)!.push(id);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: Topic[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const t = getTopicById(current);
    if (t) result.push(t);
    for (const next of subForward.get(current) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }
  return result;
}

/**
 * Finds the lowest unconfirmed HARD prerequisite on any path to the target.
 * "Lowest" = closest to the leaf of the prerequisite chain (deepest unconfirmed).
 * Uses BFS from target backwards, returns the first unconfirmed hard prereq found.
 */
export function bottleneck(
  targetId: string,
  confirmedIds: Set<string>
): Topic | null {
  ensureGraph();
  const visited = new Set<string>([targetId]);
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = forwardMap!.get(current) ?? [];
    for (const dep of deps) {
      if (dep.strength !== "hard") continue;
      if (!visited.has(dep.prerequisiteId)) {
        visited.add(dep.prerequisiteId);
        if (!confirmedIds.has(dep.prerequisiteId)) {
          const t = getTopicById(dep.prerequisiteId);
          if (t) return t;
        }
        queue.push(dep.prerequisiteId);
      }
    }
  }
  return null;
}

/**
 * Returns the highest-centrality topics in a Homa domain for a given age.
 */
export function hubTopics(
  homaDomainId: string,
  ageMonths: number,
  limit = 10
): Topic[] {
  return topicsByAge(ageMonths)
    .filter((t) => homaDomainForTopic(t) === homaDomainId)
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, limit);
}
