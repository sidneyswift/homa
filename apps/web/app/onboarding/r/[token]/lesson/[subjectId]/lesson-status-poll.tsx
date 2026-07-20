"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { SubjectLessonBuildStatus } from "../../../../../../lib/subject-lessons/types";

export const SUBJECT_LESSON_POLL_INTERVAL_MS = 2_500;

type SubjectLessonPollResult =
  | SubjectLessonBuildStatus
  | "stop"
  | null;

type SubjectLessonPollSchedule = (
  callback: () => void,
  delay: number,
) => () => void;

export function shouldPollSubjectLessonStatus(
  status: SubjectLessonBuildStatus,
): boolean {
  return status === "queued" || status === "running";
}

function readSubjectLessonBuildStatus(
  value: unknown,
): SubjectLessonBuildStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = (value as { buildStatus?: unknown }).buildStatus;
  switch (status) {
    case "queued":
    case "running":
    case "ready":
    case "failed":
      return status;
    default:
      return null;
  }
}

function scheduleSubjectLessonPoll(
  callback: () => void,
  delay: number,
): () => void {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
}

async function requestSubjectLessonBuildStatus(
  token: string,
  subjectId: string,
  signal: AbortSignal,
): Promise<SubjectLessonPollResult> {
  const query = new URLSearchParams({
    token,
    subject: subjectId,
  });
  const response = await fetch(
    `/api/map/subject-lesson/status?${query.toString()}`,
    {
      cache: "no-store",
      signal,
    },
  );
  if ([401, 403, 404].includes(response.status)) return "stop";
  if (!response.ok) return null;
  return readSubjectLessonBuildStatus(await response.json());
}

export function createSubjectLessonPollController(input: {
  initialStatus: SubjectLessonBuildStatus;
  requestStatus(signal: AbortSignal): Promise<SubjectLessonPollResult>;
  schedule: SubjectLessonPollSchedule;
  refresh(): void;
}): {
  start(): void;
  cancel(): void;
} {
  let cancelled = false;
  let settled = !shouldPollSubjectLessonStatus(input.initialStatus);
  let inFlight = false;
  let cancelScheduledPoll: (() => void) | null = null;
  let activeRequest: AbortController | null = null;

  const scheduleNextPoll = () => {
    if (cancelled || settled || inFlight || cancelScheduledPoll) return;
    cancelScheduledPoll = input.schedule(() => {
      cancelScheduledPoll = null;
      void poll();
    }, SUBJECT_LESSON_POLL_INTERVAL_MS);
  };

  async function poll(): Promise<void> {
    if (cancelled || settled || inFlight) return;
    inFlight = true;
    const request = new AbortController();
    activeRequest = request;
    try {
      const status = await input.requestStatus(request.signal);
      if (cancelled || settled) return;
      if (status === "stop") {
        settled = true;
        return;
      }
      if (status && !shouldPollSubjectLessonStatus(status)) {
        settled = true;
        input.refresh();
      }
    } catch {
      // A transient request failure leaves the durable build untouched.
    } finally {
      if (activeRequest === request) activeRequest = null;
      inFlight = false;
      scheduleNextPoll();
    }
  }

  return {
    start() {
      scheduleNextPoll();
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      cancelScheduledPoll?.();
      cancelScheduledPoll = null;
      activeRequest?.abort();
    },
  };
}

export function SubjectLessonStatusPoll({
  token,
  subjectId,
  initialStatus,
}: {
  token: string;
  subjectId: string;
  initialStatus: SubjectLessonBuildStatus;
}): ReactNode {
  const router = useRouter();

  useEffect(() => {
    const controller = createSubjectLessonPollController({
      initialStatus,
      requestStatus: async (signal) =>
        await requestSubjectLessonBuildStatus(token, subjectId, signal),
      schedule: scheduleSubjectLessonPoll,
      refresh: () => router.refresh(),
    });
    controller.start();
    return () => controller.cancel();
  }, [initialStatus, router, subjectId, token]);

  return null;
}
