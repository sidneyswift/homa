import standardsJson from "../data/curriculum-standards.json";

import type { Curriculum, CurriculumStandard, CurriculumStandardsFile } from "./types";
import { getTopic } from "./topics";

/**
 * The standards registry: 7 curricula keyed `<slug>:<code>` (uk-nc-2013,
 * ccss-ela, ccss-math, ngss-k5, ngss-ms, c3-social-studies, ib-pyp-pspe).
 * Topics reference standards through their `refs` array; the `marble:`
 * namespace is lineage, everything else resolves here.
 *
 * Static JSON imports on purpose (2026-07-10 incident: the createRequire
 * corpus loader does not resolve under the eve channel build, which sank
 * the deploy). Bundlers inline these; Node runs them through tsx.
 */

const standardsFile = standardsJson as unknown as CurriculumStandardsFile;

let standardIndex: Map<string, CurriculumStandard> | null = null;

function ensureIndex(): Map<string, CurriculumStandard> {
  if (!standardIndex) {
    standardIndex = new Map();
    for (const curriculum of standardsFile.curricula) {
      for (const standard of curriculum.topics) {
        standardIndex.set(standard.key, standard);
      }
    }
  }
  return standardIndex;
}

export function curricula(): readonly Curriculum[] {
  return standardsFile.curricula;
}

export function getStandard(key: string): CurriculumStandard | undefined {
  return ensureIndex().get(key);
}

/** The resolvable standards behind a topic (skips `marble:` lineage refs). */
export function standardsForTopic(topicId: string): CurriculumStandard[] {
  const topic = getTopic(topicId);
  if (!topic) return [];
  const result: CurriculumStandard[] = [];
  for (const ref of topic.refs) {
    if (ref.startsWith("marble:")) continue;
    const standard = ensureIndex().get(ref);
    if (standard) result.push(standard);
  }
  return result;
}
