import { z } from "zod";

import type { SubjectLessonStatusRouteDependencies } from "./route-contracts";
import {
  hasSavedSubjectLessonContent,
  subjectLessonStateResponse,
} from "./route-shared";

const subjectLessonStatusQuerySchema = z
  .object({
    token: z.string().trim().min(1).max(256),
    subject: z.string().trim().min(1).max(40),
  })
  .strict();

export function createSubjectLessonStatusHandler(
  dependencies: SubjectLessonStatusRouteDependencies
): (request: Request) => Promise<Response> {
  return async function handleSubjectLessonStatus(
    request: Request
  ): Promise<Response> {
    if (!dependencies.subjectLessonsEnabled()) {
      return Response.json({ ok: false }, { status: 404 });
    }
    if (dependencies.isRateLimited(request)) {
      return Response.json({ ok: false }, { status: 429 });
    }

    const url = new URL(request.url);
    const parsed = subjectLessonStatusQuerySchema.safeParse({
      token: url.searchParams.get("token"),
      subject: url.searchParams.get("subject"),
    });
    if (!parsed.success) {
      return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    }

    try {
      const ready = await dependencies.getReadySubjectLessonByToken(
        parsed.data.token,
        parsed.data.subject
      );
      if (ready) {
        return subjectLessonStateResponse({
          buildStatus: "ready",
          hasContent: true,
        });
      }

      const authorization = await dependencies.authorizeOwner();
      if (authorization.status === "lookup_failed") {
        return Response.json(
          { ok: false, reason: "auth-lookup-failed" },
          { status: 502 }
        );
      }
      if (authorization.status !== "owner") {
        return Response.json({ ok: false }, { status: 404 });
      }
      const state = await dependencies.getSubjectLessonStateByTokenForFamily(
        authorization.familyId,
        parsed.data.token,
        parsed.data.subject
      );
      if (!state) {
        return Response.json({ ok: false }, { status: 404 });
      }
      return subjectLessonStateResponse({
        buildStatus: state.buildStatus,
        hasContent: hasSavedSubjectLessonContent(state.content),
      });
    } catch {
      return Response.json({ ok: false }, { status: 502 });
    }
  };
}
