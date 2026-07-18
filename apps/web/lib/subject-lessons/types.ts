export type SubjectLessonBuildStatus =
  | "queued"
  | "running"
  | "ready"
  | "failed";

export type SubjectLessonBuildPhase =
  | "starting"
  | "writing_lesson"
  | "making_worksheet"
  | "reviewing_worksheet";

export interface SubjectLessonContent {
  title: string;
  materials: string[];
  steps: string[];
  practice: string;
}

export interface StaleSubjectLessonTransitionReceipt {
  familyId: string;
  childId: string;
  subject: string;
  attempt: number;
  errorCode: "stale_run";
}

export type SubjectLessonKeepResult =
  | {
      status: "kept";
      childId: string;
      subjectId: string;
      transitioned: boolean;
      versionsSuperseded: number;
    }
  | {
      status: "finalize-failed";
    };

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value)
    && value.every((entry) => typeof entry === "string")
  );
}

/**
 * Decodes JSON returned by Postgres before it crosses the typed store edge.
 * Empty strings and arrays are valid only for a queued pre-generation row.
 */
export function decodeSubjectLessonContent(
  value: unknown,
): SubjectLessonContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.title !== "string"
    || !isStringArray(candidate.materials)
    || !isStringArray(candidate.steps)
    || typeof candidate.practice !== "string"
  ) {
    return null;
  }
  return {
    title: candidate.title,
    materials: [...candidate.materials],
    steps: [...candidate.steps],
    practice: candidate.practice,
  };
}

/** The complete durable row, converted from database names at the store edge. */
export interface SubjectLessonRecord {
  id: string;
  childId: string;
  subjectId: string;
  targetItemId: string | null;
  targetStatement: string;
  startingLine: string | null;
  sourceReportGeneratedAt: string;
  sourceFingerprint: string;
  bankVersion: string;
  content: SubjectLessonContent;
  buildStatus: SubjectLessonBuildStatus;
  buildPhase: SubjectLessonBuildPhase;
  attemptCount: number;
  idempotencyKey: string;
  runtimeSessionId: string | null;
  materialId: string | null;
  errorCode: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SubjectLessonMaterialStatus =
  | "draft"
  | "final"
  | "superseded";

/** Family-pinned state and labels needed by the owner lesson page. */
export interface SubjectLessonOwnerStateView
  extends SubjectLessonRecord {
  childName: string;
  subjectName: string;
  materialStatus: SubjectLessonMaterialStatus | null;
}

export interface SubjectLessonMaterialView {
  id: string;
  title: string;
  kind: string;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
}

/** Read-only lesson data reached through the permanent report token. */
export interface SubjectLessonView {
  id: string;
  token: string;
  subjectId: string;
  targetStatement: string;
  startingLine: string | null;
  content: SubjectLessonContent;
  childName: string;
  subjectName: string;
  material: SubjectLessonMaterialView;
}

export interface SubjectLessonSummary {
  id: string;
  subjectId: string;
  buildStatus: SubjectLessonBuildStatus;
}
