import type { ChildProgressView } from "@homa/core";

/**
 * Compares the semantic Progress projection while ignoring only its render
 * timestamp. The next-move response may be projected a moment later, but its
 * child, evidence, conflicts, and scores must be identical to what is visible.
 */
export function progressViewsMatch(
  visible: ChildProgressView,
  generated: ChildProgressView,
): boolean {
  const withoutProjectionTime = (view: ChildProgressView) => ({
    childId: view.childId,
    childName: view.childName,
    birthDate: view.birthDate,
    timeZone: view.timeZone,
    scores: view.scores,
    subjects: view.subjects,
    conflicts: view.conflicts,
  });
  return (
    JSON.stringify(withoutProjectionTime(visible)) ===
    JSON.stringify(withoutProjectionTime(generated))
  );
}
