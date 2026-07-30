import { HOURS_SUBJECTS, type HoursSubject } from "../../lib/hours";
import { palette } from "../../theme/tokens";

/** Ported from apps/web/app/app/hours/hours-view.tsx's SUBJECT_TONES:
 * a 4-tone cycle keyed by the subject's fixed position in HOURS_SUBJECTS
 * (never by count or alphabetical), so a chip's color is stable. */
const SUBJECT_TONES: readonly (readonly [background: string, text: string])[] = [
  [palette.clay50, palette.clay700],
  [palette.sage50, palette.sage700],
  [palette.gold100, palette.goldInk],
  [palette.sky100, palette.sky600],
];

export function subjectTone(subject: HoursSubject): readonly [background: string, text: string] {
  const index = Math.max(0, HOURS_SUBJECTS.indexOf(subject));
  return SUBJECT_TONES[index % SUBJECT_TONES.length];
}
