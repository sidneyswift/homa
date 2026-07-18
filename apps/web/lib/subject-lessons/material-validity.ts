export interface SubjectLessonMaterialValidityInput {
  subjectLessonId: string | null;
  childId: string | null;
  subject: string | null;
  skill: string | null;
  kind: string;
  status: string;
  pdfUrl: string;
  previewUrl: string;
  reviewPassed: boolean | null;
}

/**
 * One worksheet validity rule shared by ready projections and focused tests.
 * A null review means the configured reviewer was unavailable.
 */
export function isValidSubjectLessonMaterial(
  lesson: {
    id: string;
    childId: string;
    subjectId: string;
    targetStatement: string;
  },
  material: SubjectLessonMaterialValidityInput
): boolean {
  return (
    material.subjectLessonId === lesson.id &&
    material.childId === lesson.childId &&
    material.subject === lesson.subjectId &&
    material.skill === lesson.targetStatement &&
    material.kind === "worksheet" &&
    (material.status === "draft" || material.status === "final") &&
    material.pdfUrl.trim().length > 0 &&
    material.previewUrl.trim().length > 0 &&
    material.reviewPassed !== false
  );
}

/**
 * Database equivalent of isValidSubjectLessonMaterial. Queries using this
 * fragment must expose `lesson` and `material` aliases.
 */
export const SUBJECT_LESSON_MATERIAL_VALIDITY_SQL = `
  material.subject_lesson_id = lesson.id
  and material.child_id = lesson.child_id
  and material.subject = lesson.subject_id
  and material.skill = lesson.target_statement
  and material.kind = 'worksheet'
  and material.status in ('draft', 'final')
  and nullif(btrim(material.pdf_url), '') is not null
  and nullif(btrim(material.preview_url), '') is not null
  and (
    material.generation->'review' is null
    or material.generation->'review' = 'null'::jsonb
    or material.generation->'review'->'pass' = 'true'::jsonb
  )
`.trim();
