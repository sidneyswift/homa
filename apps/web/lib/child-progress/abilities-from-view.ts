import { MAP_SUBJECTS, ageInMonths } from "@homa/core";

import type { AbilityEvidenceInput } from "./abilities";
import { deriveAbilityMap } from "./abilities";
import { buildAbilitiesSky, type AbilitiesSky } from "./abilities-view";
import type { ChildProgressView } from "./types";

/**
 * The adapter from the Progress page's existing view to the abilities
 * sky, so the map costs the page nothing.
 *
 * The projection already resolves effective evidence into per-topic
 * views carrying the answer, the source, and the date. Walking that is
 * exactly the input the derivation wants, so the abilities map adds no
 * query, no round trip, and nothing to keep in sync: if the Progress
 * page is right, the map is right.
 *
 * Topics in a conflict or ask-next state carry no answer and are
 * skipped: an unresolved disagreement between two adults is not a
 * demonstrated ability, and the conflict card is where it belongs.
 */

export function abilityEvidenceFromView(
  view: ChildProgressView,
): AbilityEvidenceInput[] {
  const evidence: AbilityEvidenceInput[] = [];
  for (const subject of view.subjects) {
    for (const domain of subject.domains) {
      for (const topic of domain.topics) {
        if (topic.answer === null) continue;
        evidence.push({
          itemId: topic.itemId,
          answer: topic.answer,
          observedAt: topic.observedAt,
        });
      }
    }
  }
  return evidence;
}

/**
 * abilitiesSkyFromView(view, now): the whole client payload for one
 * child, derived from the page's own view.
 */
export function abilitiesSkyFromView(
  view: ChildProgressView,
  now: Date,
): AbilitiesSky {
  const ageMonths = ageInMonths(view.birthDate, now);
  const map = deriveAbilityMap(abilityEvidenceFromView(view), ageMonths);
  const litSubjectIds = new Set(map.map((subject) => subject.subjectId));
  // Named, never counted: "More to explore" is an invitation, and a
  // number next to it would turn it into a backlog.
  const unlitSubjectNames = MAP_SUBJECTS.filter(
    (subject) => !litSubjectIds.has(subject.id),
  ).map((subject) => subject.displayName);
  return buildAbilitiesSky(map, ageMonths, now, unlitSubjectNames);
}
