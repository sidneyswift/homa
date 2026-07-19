"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type SubjectLessonRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SubjectLessonRetryTarget = "worksheet" | "lesson";

const SUBJECT_LESSON_RETRY_COPY: Record<
  SubjectLessonRetryTarget,
  { action: string; pending: string; error: string }
> = {
  worksheet: {
    action: "Make the worksheet again",
    pending: "Making the worksheet...",
    error: "The worksheet did not start. Your lesson is still saved.",
  },
  lesson: {
    action: "Make the lesson again",
    pending: "Making the lesson...",
    error: "The lesson did not start. Your request is still saved.",
  },
};

export function getSubjectLessonRetryCopy(
  retryTarget: SubjectLessonRetryTarget,
): { action: string; pending: string; error: string } {
  return SUBJECT_LESSON_RETRY_COPY[retryTarget];
}

export async function requestSubjectLessonRetry(
  lessonId: string,
  request: SubjectLessonRequest = fetch,
): Promise<boolean> {
  const response = await request("/api/map/subject-lesson/retry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lessonId }),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { ok?: unknown };
  return result.ok === true;
}

export function SubjectLessonRetryButton({
  lessonId,
  canRetry,
  retryTarget,
}: {
  lessonId: string;
  canRetry: boolean;
  retryTarget: SubjectLessonRetryTarget;
}): ReactNode {
  const router = useRouter();
  const [retryStarted, setRetryStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canRetry) return null;
  const busy = pending || retryStarted;
  const retryCopy = getSubjectLessonRetryCopy(retryTarget);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const started = await requestSubjectLessonRetry(lessonId);
              if (!started) {
                setError(retryCopy.error);
                return;
              }
              setRetryStarted(true);
              router.refresh();
            } catch {
              setError(retryCopy.error);
            }
          });
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-pill bg-[var(--clay-700)] px-6 py-2.5 font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)] disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? retryCopy.pending : retryCopy.action}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-[var(--rose-600)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
