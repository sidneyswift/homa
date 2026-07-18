import { mapSubjectLessonMutationSchema } from "@homa/core";

import type { SubjectLessonRetryRouteDependencies } from "./route-contracts";
import {
  canonicalSubjectLessonUrl,
  ownerMutationFailureResponse,
  readJson,
} from "./route-shared";

export function createSubjectLessonRetryHandler(
  dependencies: SubjectLessonRetryRouteDependencies,
): (request: Request) => Promise<Response> {
  return async function handleSubjectLessonRetry(
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

    const parsed = mapSubjectLessonMutationSchema.safeParse(
      await readJson(request),
    );
    if (!parsed.success) {
      return Response.json(
        { ok: false, reason: "invalid" },
        { status: 400 },
      );
    }

    try {
      const existing = await dependencies.getSubjectLessonForFamily(
        authorization.familyId,
        parsed.data.lessonId,
      );
      if (!existing) {
        return Response.json(
          { ok: false, reason: "not-found" },
          { status: 404 },
        );
      }
      const url = canonicalSubjectLessonUrl(
        existing.token,
        existing.lesson.subjectId,
      );
      if (existing.lesson.buildStatus !== "failed") {
        return Response.json(
          {
            ok: false,
            reason: "not-retryable",
            url,
            buildStatus: existing.lesson.buildStatus,
          },
          { status: 409 },
        );
      }
      if (await dependencies.familyWallCheckout(authorization.familyId)) {
        return Response.json(
          { ok: false, reason: "walled" },
          { status: 403 },
        );
      }

      const started = await dependencies.startSession({
        familyId: authorization.familyId,
        lessonId: existing.lesson.id,
        retry: true,
        modelUsageSurface: dependencies.modelUsageSurface,
      });
      if (typeof started.attempt === "number") {
        await dependencies.emitRetried({
          family_id: authorization.familyId,
          child_id: existing.lesson.childId,
          subject: existing.lesson.subjectId,
          attempt: started.attempt,
        });
      }
      if (!started.ok) {
        return Response.json(
          { ok: false, reason: "start-failed", url },
          { status: 502 },
        );
      }
      return Response.json({
        ok: true,
        url,
        buildStatus: existing.lesson.buildStatus,
      });
    } catch {
      return Response.json({ ok: false }, { status: 502 });
    }
  };
}
