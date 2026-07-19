import { selectSubjectLessonTarget, type MapAnswer } from "@homa/core";

import { lessonSourceFingerprint } from "./fingerprint";
import type { SubjectLessonBuildStatus, SubjectLessonSummary } from "./types";

export interface SubjectLessonSummaryCandidate {
  id: string;
  subjectId: string;
  buildStatus: SubjectLessonBuildStatus;
  sourceFingerprint: string;
}

/**
 * Projects only lessons whose durable source identity still matches the
 * deterministic target selected from the child's current answers.
 */
export function filterSubjectLessonSummariesForCurrentTargets(input: {
  ageMonths: number;
  answers: Array<{ itemId: string; answer: MapAnswer }>;
  lessons: SubjectLessonSummaryCandidate[];
}): SubjectLessonSummary[] {
  const currentFingerprintBySubject = new Map<string, string | null>();
  const summaries: SubjectLessonSummary[] = [];

  for (const lesson of input.lessons) {
    if (!currentFingerprintBySubject.has(lesson.subjectId)) {
      const target = selectSubjectLessonTarget(
        lesson.subjectId,
        input.ageMonths,
        input.answers
      );
      currentFingerprintBySubject.set(
        lesson.subjectId,
        target
          ? lessonSourceFingerprint({
              subjectId: lesson.subjectId,
              ...target,
            })
          : null
      );
    }

    if (
      currentFingerprintBySubject.get(lesson.subjectId) !==
      lesson.sourceFingerprint
    ) {
      continue;
    }
    summaries.push({
      id: lesson.id,
      subjectId: lesson.subjectId,
      buildStatus: lesson.buildStatus,
    });
  }

  return summaries;
}
