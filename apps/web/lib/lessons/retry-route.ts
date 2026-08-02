import { z } from "zod";

import type {
  RequestLessonAnalysisRetryResult,
} from "./store";
import type { LessonAnalysisRetryState } from "./retry-state";
import type { LessonAnalysisOutcome } from "./worker";

export type LessonRetryAuthorization =
  | { status: "ok"; familyId: string }
  | { status: "refused"; response: Response };

export interface LessonRetryRouteDependencies {
  authorize(request: Request): Promise<LessonRetryAuthorization>;
  requestRetry(
    lessonId: string,
    familyId: string,
  ): Promise<RequestLessonAnalysisRetryResult>;
  runAnalysis(
    lessonId: string,
    familyId: string,
  ): Promise<LessonAnalysisOutcome>;
  getRetryState(
    lessonId: string,
    familyId: string,
  ): Promise<LessonAnalysisRetryState | { status: "not_found" }>;
}

type LessonRetryRouteContext = {
  params: Promise<{ lessonId: string }>;
};

function stateResponse(
  state: LessonAnalysisRetryState | { status: "not_found" },
  accepted: boolean,
): Response {
  switch (state.status) {
    case "ready":
      return Response.json({
        ok: true,
        status: "ready",
        retryable: false,
      });
    case "processing":
      return Response.json(
        { ok: true, status: "processing", retryable: false },
        { status: 202 },
      );
    case "available":
      return accepted
        ? Response.json({
            ok: true,
            status: "review_failed",
            reason: "review-failed",
            retryable: true,
          })
        : Response.json(
            { ok: false, reason: "retry-state-conflict" },
            { status: 409 },
          );
    case "exhausted":
      return accepted
        ? Response.json({
            ok: true,
            status: "review_failed",
            reason: "attempts-exhausted",
            retryable: false,
          })
        : Response.json(
            {
              ok: false,
              reason: "attempts-exhausted",
              retryable: false,
            },
            { status: 409 },
          );
    case "source_unavailable":
      return accepted
        ? Response.json({
            ok: true,
            status: "review_failed",
            reason: "source-unavailable",
            retryable: false,
          })
        : Response.json(
            {
              ok: false,
              reason: "source-unavailable",
              retryable: false,
            },
            { status: 409 },
          );
    case "not_finished":
      return Response.json(
        { ok: false, reason: "not-finished", retryable: false },
        { status: 409 },
      );
    case "not_found":
      return Response.json(
        { ok: false, reason: "unknown-lesson" },
        { status: 404 },
      );
  }
}

/**
 * Policy shell for POST /api/lessons/{lessonId}/retry. Authentication is
 * injected so route behavior can be tested without weakening the production
 * adapter's cookie and bearer handling.
 */
export function createLessonRetryHandler(
  dependencies: LessonRetryRouteDependencies,
): (request: Request, context: LessonRetryRouteContext) => Promise<Response> {
  return async function handleLessonRetry(
    request: Request,
    { params }: LessonRetryRouteContext,
  ): Promise<Response> {
    const authorization = await dependencies.authorize(request);
    if (authorization.status === "refused") return authorization.response;

    const parsedLessonId = z.string().uuid().safeParse((await params).lessonId);
    if (!parsedLessonId.success) {
      return Response.json(
        { ok: false, reason: "invalid-lesson" },
        { status: 400 },
      );
    }
    const lessonId = parsedLessonId.data;
    const familyId = authorization.familyId;

    let requested: RequestLessonAnalysisRetryResult;
    try {
      requested = await dependencies.requestRetry(lessonId, familyId);
    } catch (error) {
      console.error(
        "lesson retry request failed:",
        error instanceof Error ? error.message : "unknown",
      );
      return Response.json(
        { ok: false, reason: "retry-failed" },
        { status: 502 },
      );
    }

    if (
      requested.status !== "queued" &&
      requested.status !== "processing"
    ) {
      return stateResponse(requested, false);
    }

    try {
      const analysis = await dependencies.runAnalysis(lessonId, familyId);
      if (analysis.status === "ready") {
        return stateResponse({ status: "ready", attempts: 0 }, true);
      }
      if (analysis.status === "requeued") {
        return stateResponse({ status: "processing", attempts: 0 }, true);
      }
      const state = await dependencies.getRetryState(lessonId, familyId);
      return stateResponse(state, true);
    } catch (error) {
      console.error(
        "accepted lesson retry worker start failed:",
        error instanceof Error ? error.message : "unknown",
      );
      return stateResponse({ status: "processing", attempts: requested.attempts }, true);
    }
  };
}
