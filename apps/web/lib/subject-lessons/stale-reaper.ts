import type { EventProps } from "@homa/core";

import type { StaleSubjectLessonTransitionReceipt } from "./types";

export function staleSubjectLessonFailureEvent(
  receipt: StaleSubjectLessonTransitionReceipt,
): EventProps<"map.subject_lesson_failed"> {
  return {
    family_id: receipt.familyId,
    child_id: receipt.childId,
    subject: receipt.subject,
    attempt: receipt.attempt,
    error_code: receipt.errorCode,
  };
}
