/**
 * Defensive decoding of a lesson review's stored insights JSONB, the
 * mobile twin of the storedInsightsSchema in
 * apps/web/app/app/lessons/[lessonId]/page.tsx (which builds on
 * apps/web/lib/lessons/synthesis.ts's lessonMomentSchema). Mobile has
 * no zod, so plain guards mirror the web schema's forgiving posture:
 * a malformed field collapses to its empty default instead of failing
 * the whole screen, because the review already shipped and a display
 * bug must not hide it.
 */

export interface LessonMoment {
  segmentSeq: number;
  kind: string;
  headline: string;
  detail: string;
}

export type ProgressNoteOutcome =
  | "evidence"
  | "observation"
  | "conflict"
  | "rejected"
  | "skipped_flag_off";

export interface ProgressNote {
  clause: string;
  excerpt: string;
  segmentSeq: number;
  outcome: ProgressNoteOutcome;
}

export interface LessonInsights {
  moments: LessonMoment[];
  whatWorked: string[];
  friction: string[];
  nextTime: string[];
  openQuestions: string[];
  siblingNote: string | null;
  progressNotes: ProgressNote[];
}

/** Same vocabulary and phrasing as the web review page's MOMENT_LABELS. */
export const MOMENT_LABELS: Record<string, string> = {
  excited: "Lit up",
  engaged: "Focused",
  distracted: "Drifted",
  frustrated: "Frustrated",
  breakthrough: "Breakthrough",
  sweet: "Sweet moment",
};

/** Segments are ~3 minutes; seq 1 starts the lesson (web's aboutMinute). */
export function aboutMinute(segmentSeq: number): string {
  const minute = (segmentSeq - 1) * 3;
  return minute === 0 ? "right at the start" : `about ${minute} minutes in`;
}

const PROGRESS_OUTCOMES: ReadonlySet<string> = new Set([
  "evidence",
  "observation",
  "conflict",
  "rejected",
  "skipped_flag_off",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toMoment(value: unknown): LessonMoment | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.segmentSeq !== "number" ||
    !Number.isInteger(value.segmentSeq) ||
    typeof value.kind !== "string" ||
    typeof value.headline !== "string" ||
    typeof value.detail !== "string"
  ) {
    return null;
  }
  return {
    segmentSeq: value.segmentSeq,
    kind: value.kind,
    headline: value.headline,
    detail: value.detail,
  };
}

function toProgressNote(value: unknown): ProgressNote | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.clause !== "string" ||
    typeof value.excerpt !== "string" ||
    typeof value.segmentSeq !== "number" ||
    !Number.isInteger(value.segmentSeq) ||
    typeof value.outcome !== "string" ||
    !PROGRESS_OUTCOMES.has(value.outcome)
  ) {
    return null;
  }
  return {
    clause: value.clause,
    excerpt: value.excerpt,
    segmentSeq: value.segmentSeq,
    outcome: value.outcome as ProgressNoteOutcome,
  };
}

export function parseStoredInsights(value: unknown): LessonInsights {
  const source = isRecord(value) ? value : {};
  const moments = Array.isArray(source.moments)
    ? source.moments
        .map(toMoment)
        .filter((moment): moment is LessonMoment => moment !== null)
    : [];
  const progressNotes = Array.isArray(source.progressNotes)
    ? source.progressNotes
        .map(toProgressNote)
        .filter((note): note is ProgressNote => note !== null)
    : [];
  return {
    moments,
    whatWorked: stringArray(source.whatWorked),
    friction: stringArray(source.friction),
    nextTime: stringArray(source.nextTime),
    openQuestions: stringArray(source.openQuestions),
    siblingNote:
      typeof source.siblingNote === "string" ? source.siblingNote : null,
    progressNotes,
  };
}
