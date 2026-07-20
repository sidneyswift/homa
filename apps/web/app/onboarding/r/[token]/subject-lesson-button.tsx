"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { sendWallBeacon } from "../../../../components/billing/wall-beacon";
import { WALL_STALE_LESSON_LINE } from "../../../../components/billing/wall-copy";
import { WallModal } from "../../../../components/billing/wall-modal";
import type { WallCheckout } from "../../../../lib/billing/wall-types";
import { reportButtonClass } from "./report-button";

type SubjectLessonRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SubjectLessonButtonState =
  | "idle"
  | "busy"
  | "account-required"
  | "walled"
  | "failed";

export type SubjectLessonBuildOutcome =
  | { status: "opened"; url: string }
  | { status: "account-required" | "walled" | "failed" };

export const SUBJECT_LESSON_BUSY_LABEL = "Making the lesson...";
export const SUBJECT_LESSON_GENERIC_FAILURE =
  "Your report is safe. The lesson didn't start. You can try again.";
export const SUBJECT_LESSON_OWNER_DENIAL =
  "Your report is safe. This lesson can only be built from the account that created the report.";
export const SUBJECT_LESSON_INFO_NOTE_CLASS =
  "rounded-md bg-[var(--info-soft)] px-3 py-2 text-xs font-semibold text-strong";

/**
 * Starts one owner-authorized lesson package. The route remains the authority
 * for family scope, ownership, the wall, idempotency, and session startup.
 */
export async function requestSubjectLessonBuild(
  childId: string,
  subjectId: string,
  request: SubjectLessonRequest = fetch,
): Promise<SubjectLessonBuildOutcome> {
  const response = await request("/api/map/subject-lesson/build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ childId, subjectId }),
  });
  let result: { ok?: unknown; url?: unknown; reason?: unknown } = {};
  try {
    result = (await response.json()) as typeof result;
  } catch {
    // The status still supplies an honest bounded outcome.
  }

  if (response.status === 401) return { status: "account-required" };
  if (response.status === 403) {
    return result.reason === "walled"
      ? { status: "walled" }
      : { status: "account-required" };
  }
  if (
    response.ok
    && result.ok === true
    && typeof result.url === "string"
    && result.url.length > 0
  ) {
    return { status: "opened", url: result.url };
  }
  return { status: "failed" };
}

interface SubjectLessonBuildActionDependencies {
  beacon(input: {
    kind: "door_tap";
    door: "lesson";
    childId: string;
  }): void;
  openWall(): void;
  requestBuild(): Promise<SubjectLessonBuildOutcome>;
  navigate(url: string): void;
  setState(state: SubjectLessonButtonState): void;
}

/**
 * Keeps the wall-before-POST behavior independently testable from React.
 */
export async function runSubjectLessonBuildAction(
  input: {
    childId: string;
    subjectId: string;
    wall: WallCheckout | null;
  },
  dependencies: SubjectLessonBuildActionDependencies,
): Promise<void> {
  dependencies.beacon({
    kind: "door_tap",
    door: "lesson",
    childId: input.childId,
  });
  if (input.wall) {
    dependencies.openWall();
    return;
  }

  dependencies.setState("busy");
  try {
    const outcome = await dependencies.requestBuild();
    switch (outcome.status) {
      case "opened":
        dependencies.navigate(outcome.url);
        return;
      case "account-required":
      case "walled":
      case "failed":
        dependencies.setState(outcome.status);
        return;
      default: {
        const exhaustive: never = outcome;
        throw new Error(
          `Unhandled subject lesson outcome: ${String(exhaustive)}`,
        );
      }
    }
  } catch {
    dependencies.setState("failed");
  }
}

export function SubjectLessonButton({
  childId,
  subjectId,
  lessonUrl,
  wall,
  emphasis,
}: {
  childId: string;
  subjectId: string;
  lessonUrl: string | null;
  wall: WallCheckout | null;
  emphasis: "primary" | "secondary";
}): ReactNode {
  const router = useRouter();
  const [state, setState] = useState<SubjectLessonButtonState>("idle");
  const [wallOpen, setWallOpen] = useState(false);
  const buttonClass = reportButtonClass(
    emphasis === "primary" ? "primary-strong" : "secondary",
    "inline-flex min-h-11 items-center px-4 py-2 text-xs font-semibold focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none",
  );

  if (lessonUrl) {
    return (
      <Link href={lessonUrl} className={buttonClass}>
        Open the lesson
      </Link>
    );
  }

  if (state === "account-required") {
    return (
      <p className={SUBJECT_LESSON_INFO_NOTE_CLASS} role="alert">
        {SUBJECT_LESSON_OWNER_DENIAL}
      </p>
    );
  }

  if (state === "walled") {
    return (
      <p className={SUBJECT_LESSON_INFO_NOTE_CLASS} role="alert">
        {WALL_STALE_LESSON_LINE}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => {
          void runSubjectLessonBuildAction(
            { childId, subjectId, wall },
            {
              beacon: (input) => sendWallBeacon(input),
              openWall: () => setWallOpen(true),
              requestBuild: () =>
                requestSubjectLessonBuild(childId, subjectId),
              navigate: (url) => router.push(url),
              setState,
            },
          );
        }}
        className={`${buttonClass} disabled:cursor-wait disabled:opacity-60`}
      >
        {state === "busy"
          ? SUBJECT_LESSON_BUSY_LABEL
          : "Build the next lesson"}
      </button>
      {state === "failed" ? (
        <p className="w-full text-xs text-[var(--rose-600)]" role="alert">
          {SUBJECT_LESSON_GENERIC_FAILURE}
        </p>
      ) : null}
      {wall ? (
        <WallModal
          door="lesson"
          checkout={wall}
          open={wallOpen}
          onClose={() => setWallOpen(false)}
        />
      ) : null}
    </>
  );
}
