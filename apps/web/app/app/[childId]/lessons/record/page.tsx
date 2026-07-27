import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getMyChildren, getMyFamily } from "../../../../../lib/family";
import { lessonListenEnabled } from "../../../../../lib/lessons/flag";
import { listLessonsForChild } from "../../../../../lib/lessons/store";
import { PageColumn } from "../../../../../components/dashboard/page-column";
import { LessonRecorder } from "./recorder";

/**
 * /app/[childId]/lessons/record: the recording door (plan
 * 2026-07-13-lesson-listen.md §4.2, entry ruling §7 Q5). It sat under
 * /app/kids until that surface retired; it now shares a shape with
 * /app/[childId]/progress, the page whose card opens it. The child is
 * looked up inside the caller's own family, so a foreign id is a 404.
 * Consent state rides in as a prop; the API routes re-check the stamp
 * on every call regardless.
 */

export const metadata: Metadata = {
  title: "Record a lesson",
  robots: { index: false },
};

export default async function RecordLessonPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  if (!lessonListenEnabled()) notFound();
  const { childId } = await params;
  const family = await getMyFamily();
  if (!family) redirect("/onboarding");
  const children = await getMyChildren(family.id);
  const child = children.find((entry) => entry.id === childId);
  if (!child) notFound();

  const lessons = await listLessonsForChild(family.id, childId, 3);
  const openLesson =
    lessons.find((lesson) => lesson.status === "recording") ?? null;

  return (
    <PageColumn>
      <LessonRecorder
        familyId={family.id}
        childId={child.id}
        childName={child.name}
        kids={children.map((entry, index) => ({
          id: entry.id,
          name: entry.name,
          avatarUrl: entry.avatar_url,
          index,
        }))}
        consentGranted={Boolean(family.lesson_audio_consent_at)}
        openLessonId={openLesson?.id ?? null}
      />
    </PageColumn>
  );
}
