import { getMapItem, getMapSubject, type MapItem } from "@homa/core";

import { AGENT_CHECK_IN_EXCLUDED_ITEM_IDS } from "./check-in-selection";
import { resolveEffectiveProgressEvidence } from "./effective-evidence";
import { isProgressEvidenceFresh } from "./evidence-freshness";
import type {
  ProgressConflict,
  ProgressEvidence,
  ProgressSelectionAnswer,
} from "./types";

export const DEEP_DIVE_RESPONSE_LIMIT = 8;
export type DeepDiveStopReason = "sitting_limit" | "bank_coverage_end" | "no_useful_question";
export type DeepDiveDecision =
  | { kind: "question"; item: MapItem; reason: "refresh" | "confirm_source" | "ability_probe" }
  | { kind: "stop"; reason: DeepDiveStopReason; mixedEvidence: boolean };

/** Bank anchors rank useful questions. They do not compute a child's ability age. */
export function selectSubjectDeepDiveQuestion(input: {
  childId: string;
  familyId: string;
  subjectId: string;
  ageMonths: number;
  now: Date;
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
  selectionAnswers: readonly ProgressSelectionAnswer[];
  sittingItemIds: readonly string[];
}): DeepDiveDecision {
  const subject = getMapSubject(input.subjectId);
  if (!subject) throw new TypeError("Unknown deeper-question subject");
  const items = subject.items.filter(item => !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id));
  const itemIds = new Set(items.map(item => item.id));
  const resolved = resolveEffectiveProgressEvidence(input);
  const hasOpenConflict = resolved.openConflicts.some(conflict => itemIds.has(conflict.itemId));
  const evidence = resolved.effectiveEvidence.filter(row => itemIds.has(row.itemId));
  const anchor = (row: ProgressEvidence) => getMapItem(row.itemId)!.item.typicalMonths;
  const easy = evidence.filter(row => row.answer === "easily").sort((a, b) => anchor(b) - anchor(a) || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  const emerging = evidence.filter(row => row.answer === "getting_there").sort((a, b) => anchor(b) - anchor(a) || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  const notYet = evidence.filter(row => row.answer === "not_yet").sort((a, b) => anchor(a) - anchor(b) || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  const lower = Math.max(easy[0] ? anchor(easy[0]) : -Infinity, emerging[0] ? anchor(emerging[0]) - 6 : -Infinity);
  const upper = notYet[0] ? anchor(notYet[0]) : Infinity;
  const mixedEvidence = hasOpenConflict || lower >= upper;
  if (input.sittingItemIds.length >= DEEP_DIVE_RESPONSE_LIMIT) {
    return {kind: "stop", reason: "sitting_limit", mixedEvidence};
  }
  if (hasOpenConflict) return {kind: "stop", reason: "no_useful_question", mixedEvidence};
  const sitting = new Set(input.sittingItemIds);
  const cooldown = new Set(input.selectionAnswers.filter(row =>
    row.childId === input.childId && row.familyId === input.familyId &&
    (row.answer === "skip" || row.answer === "not_sure") && isProgressEvidenceFresh(row.answeredAt, input.now)
  ).map(row => row.itemId));
  const unavailable = (itemId: string) => sitting.has(itemId) || cooldown.has(itemId);

  // Only refresh evidence that controls the current search, never an old low warm-up.
  const controlling = [
    emerging[0] && anchor(emerging[0]) >= lower ? emerging[0] : undefined,
    notYet[0],
    easy[0] && anchor(easy[0]) >= lower ? easy[0] : undefined,
  ].filter((row): row is ProgressEvidence => row !== undefined);
  const refresh = controlling.find(row => !unavailable(row.itemId) &&
    (row.derivation !== "direct" || !isProgressEvidenceFresh(row.observedAt, input.now)));
  if (refresh) return {
    kind: "question", item: getMapItem(refresh.itemId)!.item,
    reason: refresh.derivation === "direct" ? "refresh" : "confirm_source",
  };
  if (mixedEvidence) return { kind: "stop", reason: "no_useful_question", mixedEvidence };

  const fresh = new Set(evidence.filter(row => isProgressEvidenceFresh(row.observedAt, input.now)).map(row => row.itemId));
  const eligible = items.filter(item => !unavailable(item.id) && !fresh.has(item.id) && item.typicalMonths > lower && item.typicalMonths < upper);
  const probe = Number.isFinite(lower) && Number.isFinite(upper) ? (lower + upper) / 2
    : Number.isFinite(lower) ? lower + 6
      : Number.isFinite(upper) ? upper - 6 : input.ageMonths;
  eligible.sort((a, b) => Math.abs(a.typicalMonths - probe) - Math.abs(b.typicalMonths - probe)
    || a.typicalMonths - b.typicalMonths || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (eligible[0]) return { kind: "question", item: eligible[0], reason: "ability_probe" };
  const beyondBank = !items.some(item => item.typicalMonths > lower && item.typicalMonths < upper);
  return { kind: "stop", reason: beyondBank ? "bank_coverage_end" : "no_useful_question", mixedEvidence };
}
