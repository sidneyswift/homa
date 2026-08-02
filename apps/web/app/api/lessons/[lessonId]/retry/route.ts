import {
  getLessonAnalysisRetryState,
  requestLessonAnalysisRetry,
} from "../../../../../lib/lessons/store";
import { createLessonRetryHandler } from "../../../../../lib/lessons/retry-route";
import { runLessonAnalysis } from "../../../../../lib/lessons/worker";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../../lib/lessons/route-auth";

/**
 * A failed review is not an unfinished recording. This command requeues only
 * the existing family-scoped artifact, then lets the normal claim consume the
 * next bounded attempt. It never uploads audio or emits lesson.recorded.
 */

export const maxDuration = 300;

export const POST = createLessonRetryHandler({
  authorize: async (request) => {
    const context = await resolveLessonRoute(request);
    return context.status === "ok"
      ? { status: "ok", familyId: context.auth.familyId }
      : { status: "refused", response: lessonRouteRefusal(context) };
  },
  requestRetry: requestLessonAnalysisRetry,
  runAnalysis: runLessonAnalysis,
  getRetryState: getLessonAnalysisRetryState,
});
