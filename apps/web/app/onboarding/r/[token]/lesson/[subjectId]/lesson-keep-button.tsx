"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";

import { QuietAction } from "../../../../../../components/design/QuietAction";

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
      className="quiet-lesson__section quiet-lesson__kept"
    >
      <h3
        id="kept-worksheet-heading"
        ref={headingRef}
        tabIndex={-1}
        className="quiet-lesson__section-title"
      >
        Kept in Binder
      </h3>
      <p className="quiet-lesson__body-copy">
        Homa can help you adjust the lesson or talk through how it went.
      </p>
      <div className="quiet-lesson__keep">
        <QuietAction
          href="/app"
        >
          Message Homa about this lesson
        </QuietAction>
        {showPhoneSetupLink ? (
          <section
            aria-labelledby="phone-setup-heading"
            className="quiet-lesson__phone"
          >
            <h4
              id="phone-setup-heading"
              className="quiet-lesson__phone-title"
            >
              Prefer text?
            </h4>
            <p className="quiet-lesson__phone-copy">
              Phone setup is optional. Homa sends one research note by text each
              weekday morning.
            </p>
            <QuietAction
              kind="secondary"
              href="/app/settings?edit=phone#parents"
              className="quiet-lesson__phone-action"
            >
              Open phone settings
            </QuietAction>
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
    <div className="quiet-lesson__keep">
      <QuietAction
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
      >
        {pending ? "Keeping..." : "Keep in Binder"}
      </QuietAction>
      <p className="quiet-lesson__action-note">
        Binder saves the worksheet for later. The lesson stays at this link.
      </p>
      {failed ? (
        <p className="quiet-lesson__error" role="alert">
          The worksheet is still on this page, but it was not saved to Binder.
        </p>
      ) : null}
    </div>
  );
}
