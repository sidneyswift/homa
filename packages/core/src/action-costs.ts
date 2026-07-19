/**
 * Versioned product-cost estimates for plan-included billable actions.
 * This registry records cost attribution only. It does not charge families.
 */
export const ACTION_COSTS = {
  subjectLessonWithWorksheet: {
    action: "subject_lesson_with_worksheet",
    estimatedCogsUsd: 0.12,
    planIncluded: true,
    modelUsageSurface: "subject_lesson",
  },
} as const;
