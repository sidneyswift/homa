import { buildProgressComparison, buildSubjectAnswerInventory, canonicalComparisonAnswers, progressComparisonAge } from "../child-progress/comparison";
import type { ChildProgressView } from "../child-progress/types";
import { exploreChildMap, exploreSubjectMap, type ExploreChildMapQuery } from "./explore-child-map";

export const CANONICAL_PROGRESS_UNAVAILABLE = "The current Progress reading could not be checked. Try this read again before quoting a number. Missing context is not missing evidence.";

/** Authentication supplies familyId; the existing canonical reader re-scopes
 * childId within that family. No compatibility answer fallback or writes. */
export async function readCanonicalChildMap(
  input: { familyId: string; childId: string; query: ExploreChildMapQuery },
  dependencies: { getView(familyId: string, childId: string): Promise<ChildProgressView | null> },
) {
  try {
    const view = await dependencies.getView(input.familyId, input.childId);
    if (!view) return { error: "unknown_child", note: "That child is not available in this family. Use an authenticated child ID." };
    if (view.childId !== input.childId) return { error: "progress_unavailable", note: CANONICAL_PROGRESS_UNAVAILABLE };
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
    return { error: "progress_unavailable", note: CANONICAL_PROGRESS_UNAVAILABLE };
  }
}
