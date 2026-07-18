import { mapSubjectLessonMutationSchema } from "@homa/core";

import type { SubjectLessonKeepRouteDependencies } from "./route-contracts";
import {
  ownerMutationFailureResponse,
  readJson,
} from "./route-shared";

export function createSubjectLessonKeepHandler(
  dependencies: SubjectLessonKeepRouteDependencies,
): (request: Request) => Promise<Response> {
  return async function handleSubjectLessonKeep(
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
      const result = await dependencies.keepSubjectLessonMaterial(
        authorization.familyId,
        parsed.data.lessonId,
      );
      if (!result) {
        return Response.json(
          { ok: false, reason: "not-found" },
          { status: 404 },
        );
      }
      if (result.status === "finalize-failed") {
        return Response.json(
          { ok: false, reason: "finalize-failed" },
          { status: 502 },
        );
      }
      if (result.transitioned) {
        await dependencies.emitMaterialFinalized({
          family_id: authorization.familyId,
          channel: "web",
          versions_superseded: result.versionsSuperseded,
        });
        await dependencies.emitSubjectLessonKept({
          family_id: authorization.familyId,
          child_id: result.childId,
          subject: result.subjectId,
        });
      }
      return Response.json({
        ok: true,
        kept: true,
        alreadyKept: !result.transitioned,
      });
    } catch {
      return Response.json(
        { ok: false, reason: "finalize-failed" },
        { status: 502 },
      );
    }
  };
}
