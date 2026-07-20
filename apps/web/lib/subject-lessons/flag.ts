/**
 * Subject lessons stay dark unless the dedicated flag is exactly "true".
 * Values such as "1", "TRUE", an empty string, and the literal "false"
 * all preserve the migration-safe no-query path.
 */
export function subjectLessonsEnabled(): boolean {
  return process.env.HOMA_SUBJECT_LESSONS_ENABLED === "true";
}
