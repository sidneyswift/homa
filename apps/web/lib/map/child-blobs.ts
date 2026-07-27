import { del, list } from "@vercel/blob";

import { blobConfigured } from "../materials/artifact-store";
import { childPhotoPrefix } from "../child-photos";
import { lessonBlobPrefix } from "../lessons/blobs";

/**
 * Deleting a child deletes the child's bytes.
 *
 * Before this existed, removeChild deleted the `children` row and
 * nothing else, and the schema's cascades did the rest. That is correct
 * for rows and silently wrong for Blob, because the cascade destroys the
 * only record of where the bytes are:
 *
 *   - `lesson_recordings` cascades on (child_id, family_id), taking
 *     `lesson_segments.blob_url` and `lesson_media.blob_url` with it.
 *     The 30-day audio TTL sweep (`listAudioTtlLessons`) finds expiring
 *     audio by joining those rows, so once they are gone the sweep can
 *     never see those blobs again.
 *   - `children.avatar_url` lives on the row being deleted.
 *
 * So a parent who deleted a child to remove that child's data got the
 * opposite of the strongest reading of the promise: the record went, and
 * the child's voice and face stayed in Blob permanently, unreachable by
 * any later sweep. The lesson consent screen says "delete anytime".
 *
 * The purge is by PREFIX, not by stored URL, deliberately. A URL-driven
 * delete can only remove bytes some row still points at, and the whole
 * failure here is bytes whose row is already gone. A prefix reaches an
 * upload whose row write failed halfway, and it reaches a blob written
 * under a name nothing recorded.
 *
 * Best-effort by design, and that is a real tradeoff rather than
 * laziness: the row delete is the promise a parent can verify, so a Blob
 * hiccup must never roll it back or fail her request. A failure here
 * leaves an orphan and says so in the log; it never leaves the child.
 */

/** One child's blob prefixes. `lessonIds` must be read BEFORE the row
 *  delete, because the cascade is what makes them unfindable. */
export function childBlobPrefixes(input: {
  familyId: string;
  childId: string;
  lessonIds: readonly string[];
}): string[] {
  return [
    childPhotoPrefix(input.familyId, input.childId),
    ...input.lessonIds.map((lessonId) =>
      lessonBlobPrefix(input.familyId, lessonId),
    ),
  ];
}

/**
 * purgeChildBlobs(...): deletes every blob under this child's prefixes.
 * Returns how many went, for the caller's log. Never throws.
 */
export async function purgeChildBlobs(input: {
  familyId: string;
  childId: string;
  lessonIds: readonly string[];
}): Promise<number> {
  // One honest line instead of one scary line per prefix. Local dev and
  // the disposable E2E have no Blob store, so without this every child
  // deletion in CI logs a purge failure, and a warning that always
  // fires is a warning nobody reads by the time it matters.
  if (!blobConfigured()) {
    console.warn(
      `child blob purge skipped for child ${input.childId}: no Blob store configured`,
    );
    return 0;
  }
  const prefixes = childBlobPrefixes(input);
  let deleted = 0;
  for (const prefix of prefixes) {
    try {
      const listed = await list({ prefix });
      const urls = listed.blobs.map((blob) => blob.url);
      if (urls.length === 0) continue;
      await del(urls);
      deleted += urls.length;
    } catch (error) {
      // Named loudly: an orphan here is a child's audio or photo that
      // outlived the request to delete it, and nothing downstream will
      // ever find it again.
      console.error(
        `child blob purge failed for ${prefix}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return deleted;
}
