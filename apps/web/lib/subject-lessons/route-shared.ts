import type { SubjectLessonOwnerAuthorization } from "./owner";
import type { SubjectLessonBuildStatus, SubjectLessonContent } from "./types";

export function canonicalSubjectLessonUrl(
  token: string,
  subjectId: string
): string {
  return `/onboarding/r/${encodeURIComponent(
    token
  )}/lesson/${encodeURIComponent(subjectId)}`;
}

export function ownerMutationFailureResponse(
  authorization: SubjectLessonOwnerAuthorization
): Response | null {
  switch (authorization.status) {
    case "owner":
      return null;
    case "no_actor":
      return Response.json({ ok: false, reason: "no-actor" }, { status: 401 });
    case "non_owner":
      return Response.json(
        { ok: false, reason: "owner-required" },
        { status: 403 }
      );
    case "lookup_failed":
      return Response.json(
        { ok: false, reason: "auth-lookup-failed" },
        { status: 502 }
      );
    default: {
      const exhaustive: never = authorization;
      throw new Error(
        `Unhandled subject lesson authorization: ${String(exhaustive)}`
      );
    }
  }
}

export function hasSavedSubjectLessonContent(
  content: SubjectLessonContent
): boolean {
  return (
    content.title.trim().length > 0 &&
    content.steps.length >= 3 &&
    content.practice.trim().length > 0
  );
}

export function subjectLessonStateResponse(input: {
  buildStatus: SubjectLessonBuildStatus;
  hasContent: boolean;
}): Response {
  return Response.json({
    ok: true,
    buildStatus: input.buildStatus,
    hasContent: input.hasContent,
  });
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
