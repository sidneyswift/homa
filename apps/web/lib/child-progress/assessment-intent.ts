import { getMapSubject } from "@homa/core";
import * as z from "zod/mini";

export const ASSESSMENT_ACTION_HEADER = "x-homa-assessment-action";
export const ASSESSMENT_PENDING_COOKIE = "homa-assessment-action";
const intentSchema = z.strictObject({
  requestId: z.uuid(),
  retryRevision: z.optional(z.int().check(z.positive())),
  childId: z.uuid(),
  subjectId: z.string().check(z.maxLength(80), z.refine(id => getMapSubject(id) !== undefined)),
});
export type SelectedAssessmentAction = z.infer<typeof intentSchema>;
export type ResolvedAssessmentAction = SelectedAssessmentAction & { childName: string; subjectDisplayName: string; message: string };

export function parseAssessmentAction(value: unknown): SelectedAssessmentAction | null {
  const parsed = intentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function assessmentActionFromHeader(value: string | null): SelectedAssessmentAction | null {
  if (!value || value.length > 512) return null;
  try { return parseAssessmentAction(JSON.parse(value)); } catch { return null; }
}

export function resolveAssessmentAction(action: SelectedAssessmentAction, children: readonly {id: string; name: string}[]): ResolvedAssessmentAction | null {
  const child = children.find(row => row.id === action.childId);
  const subject = getMapSubject(action.subjectId);
  if (!child || !subject) return null;
  return {...action, childName: child.name, subjectDisplayName: subject.displayName,
    message: `Ask me deeper ${subject.displayName.toLowerCase()} questions for ${child.name}.`};
}

export function assessmentActionHref(action: SelectedAssessmentAction): string {
  const parsed = intentSchema.parse(action);
  const params = new URLSearchParams({assessment: "subject_deep_dive", child: parsed.childId, subject: parsed.subjectId, request: parsed.requestId});
  return `/app?${params}`;
}

/** Closed navigation intent only. Names, arbitrary prose and family ids are absent. */
export function assessmentActionFromQuery(query: {assessment?: unknown; child?: unknown; subject?: unknown; request?: unknown; dd?: unknown}, fallbackRequestId: string): SelectedAssessmentAction | null {
  if (typeof query.dd === "string") {
    const [childId, subjectId, extra] = query.dd.split(".");
    return extra === undefined ? parseAssessmentAction({requestId: fallbackRequestId, childId, subjectId}) : null;
  }
  return query.assessment === "subject_deep_dive" ? parseAssessmentAction({
    requestId: query.request ?? fallbackRequestId, childId: query.child, subjectId: query.subject,
  }) : null;
}

export function progressSubjectHref(childId: string, subjectId: string): string {
  z.uuid().parse(childId);
  if (!getMapSubject(subjectId)) throw new TypeError("Unknown Progress subject");
  return `/app/${childId}/progress?subject=${encodeURIComponent(subjectId)}`;
}
