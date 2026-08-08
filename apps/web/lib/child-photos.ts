import { del, put } from "@vercel/blob";

import { withFamilyArtifactWriteFence } from "./account-deletion-artifact-fence";
import { isFamilyArtifactUrl } from "./materials/artifact-store";

/**
 * Child profile photo storage (D4 photo personalization, migration
 * #75). Bytes live in Vercel Blob under the family's own artifact
 * prefix, families/{familyId}/children/{childId}/, the same posture as
 * every material (public access, random-suffix URLs, nothing
 * enumerable). That prefix is deliberate: the studio's reference-image
 * wall (isFamilyArtifactUrl) already accepts exactly this shape, so an
 * uploaded photo becomes a valid generate_image reference with no new
 * trust path.
 *
 * The browser downscales before upload (lib/child-photo-prepare.ts), so
 * what lands here is a small parent-chosen reference image, never the
 * camera raw; re-encoding also dropped EXIF location data client-side.
 */

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Belt above the client downscale: a prepared photo is a few hundred
 * KB; anything near the server action body cap is not one of ours. */
export const MAX_CHILD_PHOTO_BYTES = 900 * 1024;

export function isAllowedChildPhotoType(mediaType: string): boolean {
  return mediaType in EXTENSION_BY_TYPE;
}

/**
 * childPhotoPrefix(familyId, childId): everything stored for one
 * child's photo. Exported so the write below and the delete-a-child
 * purge (lib/map/child-blobs.ts) cannot drift: the purge finds bytes by
 * this prefix, which is the only way to reach a photo whose row is
 * already gone.
 */
export function childPhotoPrefix(familyId: string, childId: string): string {
  return `families/${familyId}/children/${childId}/`;
}

/**
 * uploadChildPhotoBytes(...): stores one prepared photo, returns its
 * hosted URL for the children row. familyId comes from the caller's own
 * membership (never the form), childId is re-scoped by the caller
 * before this runs.
 */
export async function uploadChildPhotoBytes(input: {
  familyId: string;
  childId: string;
  bytes: Buffer;
  mediaType: string;
}): Promise<string> {
  const extension = EXTENSION_BY_TYPE[input.mediaType] ?? "jpg";
  const blob = await withFamilyArtifactWriteFence({
    familyId: input.familyId,
    write: async () => await put(
      `${childPhotoPrefix(input.familyId, input.childId)}photo.${extension}`,
      input.bytes,
      { access: "public", contentType: input.mediaType, addRandomSuffix: true },
    ),
    cleanup: async (writtenBlob) => await del(writtenBlob.url),
  });
  return blob.url;
}

/**
 * deleteChildPhotoBlob(url, familyId): removes a replaced or removed
 * photo's bytes. Deleting is the D4 promise ("removing it deletes the
 * photo"), so this is called on every replace and remove; the family
 * prefix check keeps a stale or forged URL from touching anything that
 * is not this family's own file. Best-effort: a delete hiccup never
 * blocks the parent's save (the row no longer points at the file).
 */
export async function deleteChildPhotoBlob(url: string, familyId: string): Promise<void> {
  if (!isFamilyArtifactUrl(url, familyId)) return;
  try {
    await del(url);
  } catch (error) {
    console.error(
      "child photo blob delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
