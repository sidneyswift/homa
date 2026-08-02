export type LessonRetryClientResult =
  | { status: "refresh" }
  | { status: "stayed_failed"; message: string }
  | { status: "refused"; message: string };

type FetchLessonRetry = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function refusalMessage(reason: unknown): string {
  if (reason === "attempts-exhausted") {
    return "Homa already tried every safe pass and could not make a review she trusts.";
  }
  if (reason === "source-unavailable") {
    return "The raw audio is no longer available, and there is not enough transcript left to try again.";
  }
  if (reason === "no-session") {
    return "Your session expired. Sign in again before asking Homa to retry.";
  }
  return "Homa could not confirm another review started. The lesson is still saved. Please try again.";
}

/** A tiny client contract keeps fetch and UX policy testable without React. */
export async function requestLessonReviewRetry(
  fetcher: FetchLessonRetry,
  lessonId: string,
): Promise<LessonRetryClientResult> {
  let response: Response;
  try {
    response = await fetcher(`/api/lessons/${lessonId}/retry`, {
      method: "POST",
    });
  } catch {
    return {
      status: "refused",
      message:
        "Homa could not confirm another review started. The lesson is still saved. Check your connection and try again.",
    };
  }
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    return { status: "refused", message: refusalMessage(body.reason) };
  }
  if (body.status === "ready" || body.status === "processing") {
    return { status: "refresh" };
  }
  if (body.status === "review_failed" && body.retryable === false) {
    return { status: "refresh" };
  }
  if (body.status === "review_failed" && body.retryable === true) {
    return {
      status: "stayed_failed",
      message:
        "Homa listened again but could not finish the review. The lesson is still saved, and you can try once more.",
    };
  }
  return {
    status: "refused",
    message:
      "Homa could not confirm what happened. The lesson is still saved. Please try again.",
  };
}
