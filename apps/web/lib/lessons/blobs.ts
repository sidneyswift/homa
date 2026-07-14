import { del } from "@vercel/blob";

import { isFamilyArtifactUrl } from "../materials/artifact-store";

/**
 * Lesson blob hygiene (plan 2026-07-13-lesson-listen.md). Audio and
 * media live under families/{familyId}/lessons/{lessonId}/ in the
 * homa-artifacts store, the house posture (public store, random-suffix
 * URLs, nothing enumerable). The prefix checks below are the same
 * belt every other artifact consumer wears: a stale or forged URL
 * never touches another family's file, and rows never point outside
 * the family's own lessons space.
 */

export function lessonBlobPrefix(
  familyId: string,
  lessonId: string,
): string {
  return `families/${familyId}/lessons/${lessonId}/`;
}

/** True when the URL lives inside this family's own lessons space. */
export function isFamilyLessonUrl(
  url: string,
  familyId: string,
  lessonId?: string,
): boolean {
  if (!isFamilyArtifactUrl(url, familyId)) return false;
  const marker = lessonId === undefined
    ? `/families/${familyId}/lessons/`
    : `/${lessonBlobPrefix(familyId, lessonId)}`;
  return url.includes(marker);
}

/**
 * deleteLessonBlob(url, familyId): the 30-day TTL's delete (and the
 * consent screen's "delete anytime" promise). Best-effort: a delete
 * hiccup never blocks the sweep, and the family prefix check keeps
 * the delete inside the family's own space.
 */
export async function deleteLessonBlob(
  url: string,
  familyId: string,
): Promise<void> {
  if (!isFamilyLessonUrl(url, familyId)) return;
  try {
    await del(url);
  } catch (error) {
    console.error(
      "lesson blob delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
