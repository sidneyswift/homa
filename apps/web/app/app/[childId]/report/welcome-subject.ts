export interface WelcomeSubject {
  id: string;
  name: string;
}

export interface WelcomeLesson {
  subjectId: string;
}

/**
 * Keep the report handoff to one available next move. The report supplies
 * subjects in its own grounded order, so this never invents a preference.
 */
export function pickWelcomeSubject({
  subjects,
  subjectLessonsEnabled,
  subjectLessons,
  viewerCanBuildLesson,
}: {
  subjects: readonly WelcomeSubject[];
  subjectLessonsEnabled: boolean;
  subjectLessons: readonly WelcomeLesson[];
  viewerCanBuildLesson: boolean;
}): WelcomeSubject | null {
  if (!subjectLessonsEnabled) return subjects[0] ?? null;
  return subjects.find(
    (subject) =>
      viewerCanBuildLesson
      || subjectLessons.some((lesson) => lesson.subjectId === subject.id),
  ) ?? null;
}
