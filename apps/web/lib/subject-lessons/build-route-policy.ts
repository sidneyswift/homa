import { mapSubjectLessonBuildSchema } from "@homa/core";

import type {
  SubjectLessonBuildRouteDependencies,
  SubjectLessonRouteIdentity,
} from "./route-contracts";
import {
  canonicalSubjectLessonUrl,
  ownerMutationFailureResponse,
  readJson,
} from "./route-shared";

async function startQueuedSubjectLesson(
  dependencies: SubjectLessonBuildRouteDependencies,
  familyId: string,
  lesson: SubjectLessonRouteIdentity,
  url: string,
): Promise<Response | null> {
  if (lesson.buildStatus !== "queued") return null;
  const started = await dependencies.startSession({
    familyId,
    lessonId: lesson.id,
    retry: false,
    modelUsageSurface: dependencies.modelUsageSurface,
  });
  return started.ok
    ? null
    : Response.json(
        { ok: false, reason: "start-failed", url },
        { status: 502 },
      );
}

export function createSubjectLessonBuildHandler(
  dependencies: SubjectLessonBuildRouteDependencies,
): (request: Request) => Promise<Response> {
  return async function handleSubjectLessonBuild(
    request: Request,
  ): Promise<Response> {
    if (!dependencies.subjectLessonsEnabled()) {
      return Response.json({ ok: false }, { status: 404 });
    }
    if (dependencies.isRateLimited(request)) {
      return Response.json({ ok: false }, { status: 429 });
    }

    const authorization = await dependencies.authorizeOwner();
    const authorizationFailure =
      ownerMutationFailureResponse(authorization);
    if (authorizationFailure) return authorizationFailure;
    if (authorization.status !== "owner") {
      return Response.json({ ok: false }, { status: 500 });
    }

    const parsed = mapSubjectLessonBuildSchema.safeParse(
      await readJson(request),
    );
    if (!parsed.success) {
      return Response.json(
        { ok: false, reason: "invalid" },
        { status: 400 },
      );
    }

    try {
      const reusable = await dependencies.findReusableSubjectLesson({
        familyId: authorization.familyId,
        childId: parsed.data.childId,
        subjectId: parsed.data.subjectId,
      });
      if (reusable) {
        const url = canonicalSubjectLessonUrl(
          reusable.token,
          reusable.lesson.subjectId,
        );
        const failure = await startQueuedSubjectLesson(
          dependencies,
          authorization.familyId,
          reusable.lesson,
          url,
        );
        if (failure) return failure;
        return Response.json({
          ok: true,
          url,
          buildStatus: reusable.lesson.buildStatus,
        });
      }

      if (await dependencies.familyWallCheckout(authorization.familyId)) {
        return Response.json(
          { ok: false, reason: "walled" },
          { status: 403 },
        );
      }

      const claimed = await dependencies.claimOrReuseSubjectLesson({
        familyId: authorization.familyId,
        childId: parsed.data.childId,
        subjectId: parsed.data.subjectId,
      });
      if (!claimed) {
        return Response.json(
          { ok: false, reason: "not-found" },
          { status: 404 },
        );
      }
      const url = canonicalSubjectLessonUrl(
        claimed.token,
        claimed.lesson.subjectId,
      );
      if (claimed.created) {
        await dependencies.emitRequested({
          family_id: authorization.familyId,
          child_id: claimed.lesson.childId,
          subject: claimed.lesson.subjectId,
        });
      }
      const failure = await startQueuedSubjectLesson(
        dependencies,
        authorization.familyId,
        claimed.lesson,
        url,
      );
      if (failure) return failure;
      return Response.json({
        ok: true,
        url,
        buildStatus: claimed.lesson.buildStatus,
      });
    } catch {
      return Response.json({ ok: false }, { status: 502 });
    }
  };
}
