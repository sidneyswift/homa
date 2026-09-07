import { getMapSubject, getScorableItem } from "@homa/core";

import { buildProgressComparison, buildSubjectAnswerInventory, canonicalComparisonAnswers, effectiveComparisonTopics, progressComparisonAge } from "../child-progress/comparison";
import type { ChildProgressView } from "../child-progress/types";
import { exploreChildMap, exploreSubjectMap, type ExploreChildMapQuery } from "./explore-child-map";

export const CANONICAL_PROGRESS_UNAVAILABLE = "The current Progress reading could not be checked. Missing context is not missing evidence. Explain the availability limit and end this attempt. A successful read is required before quoting a number or suggesting practice; do not ask the parent to re-enter evidence to bypass this failure.";
export function canonicalProgressUnavailable() {
  return { error: "progress_unavailable", parentMessage: "I couldn't check Progress right now. You can try again shortly.",
    note: `${CANONICAL_PROGRESS_UNAVAILABLE} Relay parentMessage exactly and end the reply.` };
}
export type CanonicalChildMapQuery = ExploreChildMapQuery | { query: "saved_answers"; subjectId: string };

/** Authentication supplies familyId; the existing canonical reader re-scopes
 * childId within that family. No compatibility answer fallback or writes. */
export async function readCanonicalChildMap(
  input: { familyId: string; childId: string; query: CanonicalChildMapQuery },
  dependencies: { getView(familyId: string, childId: string): Promise<ChildProgressView | null> },
) {
  try {
    const view = await dependencies.getView(input.familyId, input.childId);
    if (!view) return { error: "unknown_child", note: "That child is not available in this family. Use an authenticated child ID." };
    if (view.childId !== input.childId) return canonicalProgressUnavailable();
    if (input.query.query === "saved_answers") {
      const subject = getMapSubject(input.query.subjectId);
      if (!subject) return { error: "unknown_subject", note: "Use a real subject id from the child's Progress context." };
      const savedAnswers = buildSubjectAnswerInventory(view, subject.id);
      const counts = { easily: 0, getting_there: 0, not_yet: 0 };
      for (const topic of effectiveComparisonTopics(view)) {
        if (topic.answer && getScorableItem(topic.itemId)?.subject.id === subject.id) counts[topic.answer]++;
      }
      const conflicts = view.conflicts.filter(conflict => getScorableItem(conflict.itemId)?.subject.id === subject.id);
      return {
        childId: view.childId, childName: view.childName, subjectId: subject.id,
        projectedAt: view.projectedAt, timeZone: view.timeZone,
        coverage: savedAnswers.omitted > 0 ? "partial" as const : "complete" as const,
        answerCounts: counts,
        conflicts: {
          total: conflicts.length, omitted: Math.max(0, conflicts.length - 24),
          items: conflicts.slice(0, 24).map(conflict => ({
            itemId: conflict.itemId, statement: getScorableItem(conflict.itemId)!.item.statement,
            observedAt: conflict.observedAt,
            answers: conflict.adultAnswers.map(answer => ({
              answer: answer.answer, observedAt: answer.observedAt,
              source: answer.source.kind, derivation: answer.source.derivation,
              adultDisplayName: answer.adultDisplayName,
            })),
          })),
        },
        savedAnswers,
        note: "Only saved evidence is included. Counts cover all non-conflicting saved answers, including answers omitted from this bounded list; conflicts are separate. No unassessed catalog targets or prerequisite assumptions are included. Complete means all saved answers were returned, not that the subject is mastered. Dates and derivation belong to each observation, not the projection time.",
      };
    }
    const context = { childName: view.childName, ageMonths: progressComparisonAge(view), answers: canonicalComparisonAnswers(view) };
    if (input.query.query === "subject_map") {
      const result = exploreSubjectMap(context, input.query.subjectId);
      if (!("ladder" in result)) return result;
      return {
        comparison: buildProgressComparison(view, input.query.subjectId),
        savedAnswers: buildSubjectAnswerInventory(view, input.query.subjectId),
        subjectId: result.subjectId,
        displayName: result.displayName,
        exposureBased: result.exposureBased,
        observations: result.observations,
        // The legacy frontier flag can name a not-yet boundary. It is not
        // the evidence credited by the scorer. Keep that authority in the
        // canonical comparison instead of exposing two competing readings.
        ladder: result.ladder.map(item => ({ itemId: item.itemId,
          statement: item.statement, typicalMonths: item.typicalMonths,
          childStatus: item.childStatus })),
        domains: result.domains,
        note: "The comparison supplies the displayed reading and winning evidence. savedAnswers lists actual saved answers, including Not yet and lower-credit answers, with exact dates and provenance; omitted counts are explicit. The ladder is the catalog, not the complete answer history. Domains summarize the teaching graph; use ready_next or topic for detail. Teaching windows describe typical teaching ages, never deadlines.",
      };
    }
    const result = exploreChildMap(context, input.query);
    return {
      ...result,
      canonicalProgress: { projectedAt: view.projectedAt, ageMonths: progressComparisonAge(view), timeZone: view.timeZone, openConflictCount: view.conflicts.length },
    };
  } catch {
    return canonicalProgressUnavailable();
  }
}
