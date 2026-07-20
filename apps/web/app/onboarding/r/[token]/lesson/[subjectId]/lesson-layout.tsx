import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "../../../../../../components/brand/Logo";
import type {
  SubjectLessonBuildStatus,
  SubjectLessonContent,
  SubjectLessonMaterialStatus,
} from "../../../../../../lib/subject-lessons/types";
import type { MaterialArtifact } from "../../../../../app/material-card";

export interface SubjectLessonOwnerMaterial {
  lessonId: string;
  materialId: string;
  status: SubjectLessonMaterialStatus;
}

export interface SubjectLessonPageViewProps {
  access: "owner" | "token";
  token: string;
  subjectId: string;
  lessonId: string;
  childName: string;
  subjectName: string;
  targetStatement: string;
  buildStatus: SubjectLessonBuildStatus;
  content: SubjectLessonContent;
  material: MaterialArtifact | null;
  ownerMaterial: SubjectLessonOwnerMaterial | null;
  showPhoneSetupLink: boolean;
}

export function hasSavedLessonContent(
  content: SubjectLessonContent,
): boolean {
  return (
    content.title.trim().length > 0
    && content.steps.length >= 3
    && content.steps.length <= 5
    && content.practice.trim().length > 0
  );
}

export function SubjectLessonUnavailable({
  token,
}: {
  token: string;
}): ReactNode {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-20">
      <Logo size={26} />
      <h1 className="mt-8 font-display text-2xl font-bold text-strong">
        This lesson link isn&apos;t active.
      </h1>
      <p className="mt-3 text-body">
        The progress report is still available.
      </p>
      <Link
        href={`/onboarding/r/${encodeURIComponent(token)}`}
        className="mt-6 inline-flex min-h-11 items-center rounded-pill bg-[var(--clay-700)] px-6 py-2.5 font-semibold text-on-brand transition duration-(--dur-fast) ease-out hover:bg-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)]"
      >
        Back to the report
      </Link>
    </main>
  );
}

export function LessonShell({
  props,
  children,
}: {
  props: SubjectLessonPageViewProps;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="min-h-screen bg-page pb-16">
      <main className="mx-auto w-full max-w-[var(--container-md)] px-4 pt-6">
        <article
          data-build-status={props.buildStatus}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <header className="bg-[var(--band-mint)] px-7 pb-7 pt-8 sm:px-10">
            <Logo size={24} />
            <p className="mt-5 font-mono text-xs uppercase tracking-widest text-strong/70">
              {props.childName} {"\u00b7"} {props.subjectName}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-strong sm:text-4xl">
              {props.childName}&apos;s{" "}
              <span className="text-[var(--sage-700)]">
                {props.subjectName.toLocaleLowerCase("en-US")}
              </span>{" "}
              lesson
            </h1>
          </header>

          <div className="px-7 py-8 sm:px-10">{children}</div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>made with HOMA for {props.childName}</span>
            <Link
              href={`/onboarding/r/${encodeURIComponent(props.token)}`}
              className="inline-flex min-h-11 items-center rounded-pill px-2 font-semibold text-[var(--clay-700)] underline-offset-2 hover:text-[var(--clay-600)] hover:underline focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
            >
              Back to the report
            </Link>
          </footer>
        </article>
      </main>
    </div>
  );
}

export function LessonTarget({
  statement,
}: {
  statement: string;
}): ReactNode {
  return (
    <section aria-labelledby="lesson-target-heading">
      <h2
        id="lesson-target-heading"
        className="font-display text-xl font-semibold text-strong"
      >
        Lesson goal
      </h2>
      <p className="mt-2 text-sm text-muted">
        This is the goal for this lesson.
      </p>
      <p className="mt-3 rounded-lg bg-[var(--accent-sage-soft)] p-4 text-body">
        {statement}
      </p>
    </section>
  );
}

export function SavedLessonContent({
  content,
}: {
  content: SubjectLessonContent;
}): ReactNode {
  return (
    <>
      <section aria-labelledby="lesson-content-heading" className="mt-8">
        <h2
          id="lesson-content-heading"
          className="font-display text-xl font-semibold text-strong"
        >
          The lesson
        </h2>
        <h3 className="mt-3 font-display text-2xl font-bold text-strong">
          {content.title}
        </h3>
        {content.materials.length > 0 ? (
          <div className="mt-5">
            <h4 className="font-semibold text-strong">What you&apos;ll need</h4>
            <ul
              aria-label="Materials"
              className="mt-2 list-disc space-y-1 pl-5 text-body"
            >
              {content.materials.map((material, index) => (
                <li key={`${index}-${material}`}>{material}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ol className="mt-6 list-decimal space-y-4 pl-6 text-body marker:font-semibold marker:text-[var(--clay-700)]">
          {content.steps.map((step, index) => (
            <li key={`${index}-${step}`} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="lesson-practice-heading" className="mt-8">
        <h2
          id="lesson-practice-heading"
          className="font-display text-xl font-semibold text-strong"
        >
          Practice afterward
        </h2>
        <p className="mt-3 text-body">{content.practice}</p>
      </section>
    </>
  );
}
