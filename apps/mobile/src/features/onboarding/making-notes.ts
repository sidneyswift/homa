/**
 * The making screen's honesty ribbon: the job's real progress notes,
 * oldest first, the last one live. A retried stage reports a note the
 * ribbon has already shown, and appending it again printed the same
 * line twice under one React key (2026-11-03 walk, gh#1236). A repeat
 * moves to the end instead: the live line stays true, no line appears
 * twice, and the ribbon keeps its last four.
 */
export const MAKING_NOTES_SHOWN = 4;

export function withMakingNote(current: readonly string[], note: string): string[] {
  if (current[current.length - 1] === note) return [...current];
  return [...current.filter((seen) => seen !== note), note].slice(-MAKING_NOTES_SHOWN);
}
