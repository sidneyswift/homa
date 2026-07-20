import type { SubjectLessonContent } from "./types";

export function isCompleteSubjectLessonContent(
  content: SubjectLessonContent
): boolean {
  return (
    content.title.trim().length > 0 &&
    content.title.length <= 120 &&
    content.materials.length <= 8 &&
    content.materials.every(
      (entry) => entry.trim().length > 0 && entry.length <= 160
    ) &&
    content.steps.length >= 3 &&
    content.steps.length <= 5 &&
    content.steps.every(
      (entry) => entry.trim().length > 0 && entry.length <= 500
    ) &&
    content.practice.trim().length > 0 &&
    content.practice.length <= 800
  );
}

function subjectLessonContentMatches(
  left: SubjectLessonContent,
  right: SubjectLessonContent
): boolean {
  return (
    left.title === right.title &&
    left.practice === right.practice &&
    left.materials.length === right.materials.length &&
    left.materials.every((entry, index) => entry === right.materials[index]) &&
    left.steps.length === right.steps.length &&
    left.steps.every((entry, index) => entry === right.steps[index])
  );
}

/**
 * The first complete save wins. Exact later replays are successful no-ops,
 * while changed content cannot overwrite the durable lesson.
 */
export function planSubjectLessonContentSave(
  current: SubjectLessonContent,
  candidate: SubjectLessonContent
): "write" | "reuse" | "reject" {
  if (!isCompleteSubjectLessonContent(candidate)) return "reject";
  if (!isCompleteSubjectLessonContent(current)) return "write";
  return subjectLessonContentMatches(current, candidate) ? "reuse" : "reject";
}
