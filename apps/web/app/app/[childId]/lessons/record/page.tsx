import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { familyWallCheckout } from "../../../../../lib/billing/wall";
import { getMyChildren, getMyFamily } from "../../../../../lib/family";
import { lessonListenEnabled } from "../../../../../lib/lessons/flag";
import { LESSON_RECORD_WALL_SINCE_MS } from "../../../../../lib/lessons/route-auth";
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
 *
 * Founder ruling 2026-07-27: this door had no wall check anywhere,
 * unlike every other door. Gated like the rest, but for net-new
 * signups only (LESSON_RECORD_WALL_SINCE_MS, shared with the API
 * layer's own gate in lib/lessons/route-auth.ts) -- an existing family
 * keeps the free access it always had. A walled family lands on the
 * report page, which already renders the paywall offer.
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

  const createdAtMs = Date.parse(family.created_at);
  if (createdAtMs >= LESSON_RECORD_WALL_SINCE_MS) {
    const checkout = await familyWallCheckout(family.id);
    if (checkout) redirect(`/app/${childId}/report`);
  }

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
