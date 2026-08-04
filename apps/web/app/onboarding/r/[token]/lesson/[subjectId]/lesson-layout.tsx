import type { ReactNode } from "react";

import { Logo } from "../../../../../../components/brand/Logo";
import { QuietAction } from "../../../../../../components/design/QuietAction";
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
    <div className="quiet-lesson">
      <main className="quiet-lesson__standalone">
        <Logo size={26} />
        <h1 className="quiet-lesson__state-title">
          This lesson link isn&apos;t active.
        </h1>
        <p className="quiet-lesson__state-copy">
          The progress report is still available.
        </p>
        <QuietAction
          href={`/onboarding/r/${encodeURIComponent(token)}`}
          size="large"
          className="quiet-lesson__state-action"
        >
          Back to the report
        </QuietAction>
      </main>
    </div>
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
    <div className="quiet-lesson">
      <main className="quiet-lesson__main">
        <article
          data-build-status={props.buildStatus}
          className="quiet-lesson__frame"
        >
          <header className="quiet-lesson__header">
            <div className="quiet-lesson__identity">
              <Logo size={24} />
              <p className="quiet-lesson__eyebrow">
                {props.childName} {"\u00b7"} {props.subjectName}
              </p>
            </div>
            <h1 className="quiet-lesson__title">
              {props.childName}&apos;s{" "}
              <span className="quiet-lesson__title-accent">
                {props.subjectName.toLocaleLowerCase("en-US")}
              </span>{" "}
              lesson
            </h1>
          </header>

          <div className="quiet-lesson__body">{children}</div>

          <footer className="quiet-lesson__footer">
            <span>made with Homa for {props.childName}</span>
            <QuietAction
              kind="quiet"
              href={`/onboarding/r/${encodeURIComponent(props.token)}`}
            >
              Back to the report
            </QuietAction>
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
    <section aria-labelledby="lesson-target-heading" className="quiet-lesson__section">
      <h2
        id="lesson-target-heading"
        className="quiet-lesson__section-title"
      >
        Lesson goal
      </h2>
      <p className="quiet-lesson__hint">
        This is the goal for this lesson.
      </p>
      <p className="quiet-lesson__statement">
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
      <section aria-labelledby="lesson-content-heading" className="quiet-lesson__section">
        <h2
          id="lesson-content-heading"
          className="quiet-lesson__section-title"
        >
          The lesson
        </h2>
        <h3 className="quiet-lesson__section-title quiet-lesson__section-title--large">
          {content.title}
        </h3>
        {content.materials.length > 0 ? (
          <div className="quiet-lesson__materials">
            <h4 className="quiet-lesson__materials-title">What you&apos;ll need</h4>
            <ul aria-label="Materials" className="quiet-lesson__materials-list">
              {content.materials.map((material, index) => (
                <li key={`${index}-${material}`}>{material}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ol className="quiet-lesson__steps">
          {content.steps.map((step, index) => (
            <li key={`${index}-${step}`}>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="lesson-practice-heading" className="quiet-lesson__section">
        <h2
          id="lesson-practice-heading"
          className="quiet-lesson__section-title"
        >
          Practice afterward
        </h2>
        <p className="quiet-lesson__practice">{content.practice}</p>
      </section>
    </>
  );
}
