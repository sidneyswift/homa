"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";

type SubjectLessonKeepRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface SubjectLessonHandoffFocusTarget {
  focus(): void;
}

export function shouldMoveFocusToSubjectLessonHandoff(input: {
  initiallyKept: boolean;
  kept: boolean;
}): boolean {
  return input.kept && !input.initiallyKept;
}

export function focusSubjectLessonHandoff(
  target: SubjectLessonHandoffFocusTarget | null,
): void {
  target?.focus();
}

export async function requestSubjectLessonKeep(
  lessonId: string,
  request: SubjectLessonKeepRequest = fetch,
): Promise<boolean> {
  try {
    const response = await request("/api/map/subject-lesson/keep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      ok?: unknown;
      kept?: unknown;
    };
    return result.ok === true && result.kept === true;
  } catch {
    return false;
  }
}

function KeptLessonHandoff({
  headingRef,
  showPhoneSetupLink,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  showPhoneSetupLink: boolean;
}): ReactNode {
  return (
    <section
      aria-labelledby="kept-worksheet-heading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mt-5 rounded-lg bg-[var(--accent-sage-soft)] p-5"
    >
      <h3
        id="kept-worksheet-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-lg font-semibold text-strong"
      >
        Kept in Binder
      </h3>
      <p className="mt-2 text-body">
        HOMA can help you adjust the lesson or talk through how it went.
      </p>
      <div className="mt-4">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center justify-center rounded-pill bg-[var(--clay-700)] px-6 py-2.5 font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)]"
        >
          Message HOMA about this lesson
        </Link>
        {showPhoneSetupLink ? (
          <section
            aria-labelledby="phone-setup-heading"
            className="mt-5 rounded-md border border-border-subtle bg-card p-4"
          >
            <h4
              id="phone-setup-heading"
              className="font-display text-base font-semibold text-strong"
            >
              Prefer text?
            </h4>
            <p className="mt-2 text-sm text-body">
              Phone setup is optional. HOMA sends one research note by text each
              weekday morning.
            </p>
            <Link
              href="/app/settings?edit=phone#parents"
              className="mt-2 inline-flex min-h-11 items-center rounded-pill border border-border px-4 py-2 text-sm font-semibold text-[var(--clay-700)] transition duration-(--dur-fast) ease-out hover:border-[var(--clay-600)] hover:text-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
            >
              Open phone settings
            </Link>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export function SubjectLessonKeepButton({
  lessonId,
  initiallyKept,
  showPhoneSetupLink,
}: {
  lessonId: string;
  initiallyKept: boolean;
  showPhoneSetupLink: boolean;
}): ReactNode {
  const [kept, setKept] = useState(initiallyKept);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const handoffHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (
      shouldMoveFocusToSubjectLessonHandoff({
        initiallyKept,
        kept,
      })
    ) {
      focusSubjectLessonHandoff(handoffHeadingRef.current);
    }
  }, [initiallyKept, kept]);

  if (kept) {
    return (
      <KeptLessonHandoff
        headingRef={handoffHeadingRef}
        showPhoneSetupLink={showPhoneSetupLink}
      />
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            const didKeep = await requestSubjectLessonKeep(lessonId);
            if (!didKeep) {
              setFailed(true);
              return;
            }
            setKept(true);
          });
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-pill bg-[var(--clay-700)] px-6 py-2.5 font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Keeping..." : "Keep in Binder"}
      </button>
      <p className="mt-2 text-sm text-muted">
        Binder saves the worksheet for later. The lesson stays at this link.
      </p>
      {failed ? (
        <p className="mt-3 text-sm text-[var(--rose-600)]" role="alert">
          The worksheet is still on this page, but it was not saved to Binder.
        </p>
      ) : null}
    </div>
  );
}
