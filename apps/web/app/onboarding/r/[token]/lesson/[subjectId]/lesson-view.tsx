import type { ReactNode } from "react";

import type { SubjectLessonMaterialStatus } from "../../../../../../lib/subject-lessons/types";
import { MaterialCard } from "../../../../../app/material-card";
import {
  hasSavedLessonContent,
  LessonShell,
  LessonTarget,
  SavedLessonContent,
  SubjectLessonUnavailable,
  type SubjectLessonOwnerMaterial,
  type SubjectLessonPageViewProps,
} from "./lesson-layout";
import { SubjectLessonKeepButton } from "./lesson-keep-button";
import { SubjectLessonRetryButton } from "./lesson-retry-button";
import { SubjectLessonStatusPoll } from "./lesson-status-poll";

export { SubjectLessonUnavailable } from "./lesson-layout";
export type { SubjectLessonPageViewProps } from "./lesson-layout";

export function resolveSubjectLessonOwnerMaterial(input: {
  access: "owner" | "token";
  readyLessonId: string;
  readyMaterialId: string | null;
  ownerState: {
    id: string;
    materialId: string | null;
    materialStatus: SubjectLessonMaterialStatus | null;
  } | null;
}): SubjectLessonOwnerMaterial | null {
  if (
    input.access !== "owner"
    || input.ownerState?.id !== input.readyLessonId
    || input.readyMaterialId === null
    || input.ownerState.materialId !== input.readyMaterialId
    || input.ownerState.materialStatus === null
  ) {
    return null;
  }
  return {
    lessonId: input.ownerState.id,
    materialId: input.ownerState.materialId,
    status: input.ownerState.materialStatus,
  };
}

function ActiveBuildView({
  props,
}: {
  props: SubjectLessonPageViewProps;
}): ReactNode {
  return (
    <LessonShell props={props}>
      <LessonTarget statement={props.targetStatement} />
      <section
        aria-busy="true"
        aria-labelledby="lesson-build-heading"
        className="quiet-lesson__section quiet-lesson__build"
      >
        <h2
          id="lesson-build-heading"
          className="quiet-lesson__section-title"
        >
          Homa is making the lesson and worksheet
        </h2>
        <p className="quiet-lesson__status-copy" role="status">
          This page updates when both are ready.
        </p>
        <p className="quiet-lesson__status-note">
          You can leave and come back. Your request is saved.
        </p>
      </section>
      <SubjectLessonStatusPoll
        token={props.token}
        subjectId={props.subjectId}
        initialStatus={props.buildStatus}
      />
    </LessonShell>
  );
}

function FailedBuildView({
  props,
}: {
  props: SubjectLessonPageViewProps;
}): ReactNode {
  const hasContent = hasSavedLessonContent(props.content);
  return (
    <LessonShell props={props}>
      <LessonTarget statement={props.targetStatement} />
      {hasContent ? (
        <SavedLessonContent content={props.content} />
      ) : (
        <section aria-labelledby="lesson-content-heading" className="quiet-lesson__section">
          <h2
            id="lesson-content-heading"
            className="quiet-lesson__section-title"
          >
            The lesson
          </h2>
        </section>
      )}
      <section
        aria-labelledby={hasContent ? "lesson-worksheet-heading" : undefined}
        aria-label={hasContent ? undefined : "Lesson build status"}
        className="quiet-lesson__section quiet-lesson__failure"
      >
        {hasContent ? (
          <h2
            id="lesson-worksheet-heading"
            className="quiet-lesson__section-title"
          >
            Worksheet
          </h2>
        ) : null}
        <p
          className="quiet-lesson__status-copy"
          role="status"
        >
          {hasContent
            ? "The lesson is saved. The worksheet did not finish."
            : "The lesson did not finish. Your request is saved."}
        </p>
        <SubjectLessonRetryButton
          lessonId={props.lessonId}
          canRetry={props.access === "owner"}
          retryTarget={hasContent ? "worksheet" : "lesson"}
        />
      </section>
    </LessonShell>
  );
}

function ReadyLessonView({
  props,
}: {
  props: SubjectLessonPageViewProps;
}): ReactNode {
  if (!props.material || !hasSavedLessonContent(props.content)) {
    return <SubjectLessonUnavailable token={props.token} />;
  }
  return (
    <LessonShell props={props}>
      <p className="sr-only" role="status">
        Lesson and worksheet ready.
      </p>
      <LessonTarget statement={props.targetStatement} />
      <SavedLessonContent content={props.content} />
      <section aria-labelledby="lesson-worksheet-heading" className="quiet-lesson__section">
        <h2
          id="lesson-worksheet-heading"
          className="quiet-lesson__section-title"
        >
          Worksheet
        </h2>
        <div className="quiet-lesson__artifact">
          <MaterialCard
            material={props.material}
            showStatusHeadline={false}
          />
        </div>
        {props.access === "owner"
          && props.ownerMaterial
          && props.ownerMaterial.status !== "superseded" ? (
          <SubjectLessonKeepButton
            lessonId={props.ownerMaterial.lessonId}
            initiallyKept={props.ownerMaterial.status === "final"}
            showPhoneSetupLink={props.showPhoneSetupLink}
          />
        ) : null}
      </section>
    </LessonShell>
  );
}

export function SubjectLessonPageView(
  props: SubjectLessonPageViewProps,
): ReactNode {
  if (props.access === "token" && props.buildStatus !== "ready") {
    return <SubjectLessonUnavailable token={props.token} />;
  }

  switch (props.buildStatus) {
    case "queued":
    case "running":
      return <ActiveBuildView props={props} />;
    case "failed":
      return <FailedBuildView props={props} />;
    case "ready":
      return <ReadyLessonView props={props} />;
    default: {
      const exhaustive: never = props.buildStatus;
      throw new Error(
        `Unhandled subject lesson build status: ${String(exhaustive)}`,
      );
    }
  }
}
