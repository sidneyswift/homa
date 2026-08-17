import { withFamilyArtifactWriteFence } from "../account-deletion-artifact-fence";
import { isFamilyChatAttachmentUrl } from "../attachments/markers";
import {
  copyFamilyBlobToPrivate,
  deleteFamilyBlob,
  headFamilyBlob,
} from "../family-blob";
import { mapDb } from "../map/db";
import { getFamilyAsset } from "./family-asset-store";
import { processQueuedFamilyAsset } from "./family-asset-processing";
import {
  FAMILY_ASSET_PROCESSING_QUEUED_NOTE,
  MAX_LIBRARY_UPLOAD_BYTES,
  familyAssetFileKind,
  safeLibraryPathName,
  stripFamilyChatBlobSuffix,
  titleFromLibraryFileName,
  type FamilyAssetView,
} from "./family-assets";

interface ChatAttachmentForPromotion {
  id: string;
  url: string;
  media_type: string;
  kind: string;
  caption: string | null;
  child_id: string | null;
}

export type PromoteFamilyAttachmentResult =
  | { ok: true; asset: FamilyAssetView; created: boolean }
  | {
      ok: false;
      reason:
        | "not-found"
        | "bad-source"
        | "blob-not-found"
        | "too-large"
        | "copy-failed"
        | "save-failed";
    };

export function attachmentOriginalName(
  attachment: Pick<ChatAttachmentForPromotion, "caption" | "kind" | "url">,
): string {
  const captionNamesFile = attachment.kind !== "image";
  if (captionNamesFile && attachment.caption?.trim()) {
    return attachment.caption.trim().slice(0, 240);
  }
  try {
    const pathname = new URL(attachment.url).pathname;
    const last = pathname.split("/").filter(Boolean).at(-1);
    if (last) {
      return stripFamilyChatBlobSuffix(decodeURIComponent(last)).slice(0, 240);
    }
  } catch {
    // URL validation happens before this helper; keep a defensive fallback.
  }
  return "shared-resource";
}

export function familyAttachmentLibraryPath(input: {
  familyId: string;
  attachmentId: string;
  originalName: string;
}): string {
  return (
    `families/${input.familyId}/library/chat/${input.attachmentId}/` +
    safeLibraryPathName(input.originalName)
  );
}

/**
 * Promotes one family-owned chat attachment into an independently owned
 * Library original. Copying is deliberate: undoing the chat receipt cannot
 * break Library, and deleting from Library cannot break chat history.
 */
export async function promoteFamilyAttachment(input: {
  familyId: string;
  attachmentId: string;
  uploadedByUserId?: string | null;
}): Promise<PromoteFamilyAttachmentResult> {
  const sql = mapDb();
  const existing = await sql<{ id: string }[]>`
    select id
    from public.family_assets
    where family_id = ${input.familyId}
      and source_attachment_id = ${input.attachmentId}
      and deleted_at is null
    limit 1
  `;
  if (existing[0]) {
    const asset = await getFamilyAsset(input.familyId, existing[0].id);
    return asset
      ? { ok: true, asset, created: false }
      : { ok: false, reason: "save-failed" };
  }

  const attachments = await sql<ChatAttachmentForPromotion[]>`
    select attachment.id, attachment.url, attachment.media_type,
           attachment.kind, attachment.caption, attachment.child_id
    from public.chat_attachments attachment
    where attachment.id = ${input.attachmentId}
      and attachment.family_id = ${input.familyId}
    limit 1
  `;
  const attachment = attachments[0];
  if (!attachment) return { ok: false, reason: "not-found" };
  if (!isFamilyChatAttachmentUrl(attachment.url, input.familyId)) {
    return { ok: false, reason: "bad-source" };
  }

  let sourceBlob;
  try {
    sourceBlob = await headFamilyBlob(attachment.url, input.familyId, "chat");
  } catch {
    return { ok: false, reason: "blob-not-found" };
  }
  if (sourceBlob.size < 1 || sourceBlob.size > MAX_LIBRARY_UPLOAD_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  const originalName = attachmentOriginalName(attachment);
  const pathname = familyAttachmentLibraryPath({
    familyId: input.familyId,
    attachmentId: attachment.id,
    originalName,
  });
  let copied;
  try {
    copied = await withFamilyArtifactWriteFence({
      familyId: input.familyId,
      write: async () =>
        await copyFamilyBlobToPrivate({
          sourceUrl: attachment.url,
          familyId: input.familyId,
          sourceSpace: "chat",
          destinationPathname: pathname,
          destinationSpace: "library",
          contentType: sourceBlob.contentType,
        }),
      cleanup: async (writtenBlob) =>
        await deleteFamilyBlob(writtenBlob.url, input.familyId, "library"),
    });
  } catch {
    return { ok: false, reason: "copy-failed" };
  }

  let saved: { id: string } | null = null;
  try {
    saved = await sql.begin(async (transaction) => {
      const rows = await transaction<{ id: string }[]>`
        insert into public.family_assets (
          family_id, uploaded_by_user_id, source_attachment_id,
          title, original_name, url, download_url, media_type,
          byte_size, file_kind, status, processing_note, processed_at
        )
        values (
          ${input.familyId}, ${input.uploadedByUserId ?? null}, ${attachment.id},
          ${titleFromLibraryFileName(originalName)}, ${originalName},
          ${copied.url}, ${copied.downloadUrl}, ${sourceBlob.contentType},
          ${sourceBlob.size}, ${familyAssetFileKind(sourceBlob.contentType)},
          'processing', ${FAMILY_ASSET_PROCESSING_QUEUED_NOTE}, null
        )
        on conflict (family_id, source_attachment_id)
          where source_attachment_id is not null and deleted_at is null
        do update set source_attachment_id = excluded.source_attachment_id
        returning id
      `;
      const row = rows[0];
      if (!row) return null;

      if (attachment.child_id) {
        await transaction`
          insert into public.family_asset_children (family_id, asset_id, child_id)
          select ${input.familyId}, ${row.id}, child.id
          from public.children child
          where child.id = ${attachment.child_id}
            and child.family_id = ${input.familyId}
          on conflict (asset_id, child_id) do nothing
        `;
      }
      return row;
    });
  } catch (error) {
    console.error(
      "family Library attachment promotion save failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { ok: false, reason: "save-failed" };
  }
  if (!saved) return { ok: false, reason: "save-failed" };

  await processQueuedFamilyAsset({
    familyId: input.familyId,
    assetId: saved.id,
  });
  const asset = await getFamilyAsset(input.familyId, saved.id);
  return asset
    ? { ok: true, asset, created: true }
    : { ok: false, reason: "save-failed" };
}
