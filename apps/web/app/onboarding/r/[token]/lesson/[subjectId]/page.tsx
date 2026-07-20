import type { Metadata } from "next";

import { hasFamilyPhone } from "../../../../../../lib/family-phone";
import { requireFamilyWithActor } from "../../../../../../lib/map/session";
import { subjectLessonsEnabled } from "../../../../../../lib/subject-lessons/flag";
import {
  authorizeFamilyAccountOwner,
  isFamilyAccountOwner,
} from "../../../../../../lib/subject-lessons/owner";
import {
  getSubjectLessonByToken,
  getSubjectLessonStateByTokenForFamily,
} from "../../../../../../lib/subject-lessons/store";
import {
  resolveSubjectLessonOwnerMaterial,
  SubjectLessonPageView,
  SubjectLessonUnavailable,
} from "./lesson-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subject lesson",
  robots: { index: false },
};

async function authorizeSubjectLessonOwner() {
  return await authorizeFamilyAccountOwner({
    requireFamilyWithActor,
    isFamilyAccountOwner,
  });
}

export default async function SubjectLessonPage({
  params,
}: {
  params: Promise<{ token: string; subjectId: string }>;
}) {
  const { token, subjectId } = await params;
  if (!subjectLessonsEnabled()) {
    return <SubjectLessonUnavailable token={token} />;
  }

  const [readyLesson, authorization] = await Promise.all([
    getSubjectLessonByToken(token, subjectId).catch(() => null),
    authorizeSubjectLessonOwner(),
  ]);

  if (readyLesson) {
    const [ownerState, familyHasPhone] =
      authorization.status === "owner"
        ? await Promise.all([
            getSubjectLessonStateByTokenForFamily(
              authorization.familyId,
              token,
              subjectId,
            ).catch(() => null),
            hasFamilyPhone(authorization.familyId).catch(() => true),
          ])
        : [null, true] as const;
    const access =
      ownerState?.id === readyLesson.id ? "owner" : "token";
    const ownerMaterial = resolveSubjectLessonOwnerMaterial({
      access,
      readyLessonId: readyLesson.id,
      readyMaterialId: readyLesson.material?.id ?? null,
      ownerState,
    });

    return (
      <SubjectLessonPageView
        access={access}
        token={token}
        subjectId={subjectId}
        lessonId={readyLesson.id}
        childName={readyLesson.childName}
        subjectName={readyLesson.subjectName}
        targetStatement={readyLesson.targetStatement}
        buildStatus="ready"
        content={readyLesson.content}
        material={
          readyLesson.material
            ? {
                title: readyLesson.material.title,
                kind: readyLesson.material.kind,
                skill: readyLesson.material.skill,
                childName: readyLesson.material.childName,
                previewUrl: readyLesson.material.previewUrl,
                pdfUrl: readyLesson.material.pdfUrl,
              }
            : null
        }
        ownerMaterial={ownerMaterial}
        showPhoneSetupLink={access === "owner" && !familyHasPhone}
      />
    );
  }

  if (authorization.status !== "owner") {
    return <SubjectLessonUnavailable token={token} />;
  }

  const ownerState = await getSubjectLessonStateByTokenForFamily(
    authorization.familyId,
    token,
    subjectId,
  ).catch(() => null);

  if (!ownerState || ownerState.buildStatus === "ready") {
    return <SubjectLessonUnavailable token={token} />;
  }

  return (
    <SubjectLessonPageView
      access="owner"
      token={token}
      subjectId={subjectId}
      lessonId={ownerState.id}
      childName={ownerState.childName}
      subjectName={ownerState.subjectName}
      targetStatement={ownerState.targetStatement}
      buildStatus={ownerState.buildStatus}
      content={ownerState.content}
      material={null}
      ownerMaterial={null}
      showPhoneSetupLink={false}
    />
  );
}
