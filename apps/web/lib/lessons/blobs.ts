import { del, get } from "@vercel/blob";

import { isFamilyArtifactUrl } from "../materials/artifact-store";

/**
 * Lesson blob hygiene (plan 2026-07-13-lesson-listen.md). Audio and
 * media live under families/{familyId}/lessons/{lessonId}/ in a
 * dedicated private Blob store. The prefix checks below are the same
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

const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export function lessonBlobToken(): string | null {
  return process.env.HOMA_LESSON_READ_WRITE_TOKEN?.trim() || null;
}

export function lessonBlobConfigured(): boolean {
  return lessonBlobToken() !== null;
}

/** True when the URL lives inside this family's own lessons space. */
export function isFamilyLessonUrl(
  url: string,
  familyId: string,
  lessonId?: string,
): boolean {
  const marker = lessonId === undefined
    ? `/families/${familyId}/lessons/`
    : `/${lessonBlobPrefix(familyId, lessonId)}`;
  if (isFamilyArtifactUrl(url, familyId)) return url.includes(marker);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)
      && parsed.pathname.includes(marker);
  } catch {
    return false;
  }
}

export async function readLessonBlob(
  url: string,
  familyId: string,
): Promise<ArrayBuffer | null> {
  if (!isFamilyLessonUrl(url, familyId)) return null;
  if (new URL(url).hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)) {
    const token = lessonBlobToken();
    if (!token) return null;
    const result = await get(url, {
      access: "private",
      token,
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream).arrayBuffer();
  }
  const response = await fetch(url);
  return response.ok ? response.arrayBuffer() : null;
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
    const privateBlob = new URL(url).hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX);
    const token = privateBlob ? lessonBlobToken() : null;
    if (privateBlob && !token) {
      throw new Error("private lesson store is not configured");
    }
    await del(url, token ? { token } : undefined);
  } catch (error) {
    console.error(
      "lesson blob delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
