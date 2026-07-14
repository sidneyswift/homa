/**
 * Lesson listen ships dark (plan 2026-07-13-lesson-listen.md §8).
 * Only the exact documented value enables the routes and surfaces,
 * matching lib/child-progress/flag.ts.
 */
export function lessonListenEnabled(): boolean {
  return process.env.HOMA_LESSON_LISTEN_ENABLED === "true";
}
