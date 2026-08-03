"use client";

import { useState } from "react";

import { Icon } from "../../components/design/Icon";
import type {
  AttachmentMarker,
  FileMarker,
  PhotoMarker,
} from "../../lib/attachments/markers";
import { isFamilyChatAttachmentUrl } from "../../lib/attachments/markers";
import {
  undoChatAttachment,
  type ChatAttachmentReceipt,
} from "./chat-attachments";

/**
 * Attachment rendering for the transcript (approved chat redesign:
 * scrapbook direction). A photo the parent sent displays big, on white,
 * slightly tilted, with its caption handwritten underneath, the way a
 * kept print looks, not a thumbnail with a filename. Files ride as
 * quiet chips. Every URL passes the family wall
 * (isFamilyChatAttachmentUrl) before it renders; a marker typed by hand
 * or replayed across families draws nothing.
 */

export function UserAttachmentDisplay({
  markers,
  familyId,
}: {
  markers: readonly AttachmentMarker[];
  familyId: string | null;
}) {
  const photos = markers.filter(
    (marker): marker is PhotoMarker =>
      marker.kind === "photo" && isFamilyChatAttachmentUrl(marker.url, familyId),
  );
  const files = markers.filter(
    (marker): marker is FileMarker =>
      marker.kind === "file" && isFamilyChatAttachmentUrl(marker.url, familyId),
  );
  if (photos.length === 0 && files.length === 0) return null;
  return (
    <div className="flex flex-col items-end gap-3">
      {photos.map((photo) => (
        <a
          key={photo.url}
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-[82%] max-w-sm -rotate-1 rounded-md bg-white p-2.5 pb-2 shadow-md transition-transform hover:rotate-0"
        >
          {/* Family-scoped blob URL, verified above; plain img on purpose
              (remote bytes, sized by their own aspect). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption}
            className="block w-full rounded-sm"
            loading="lazy"
          />
          {photo.caption && photo.caption !== "photo" ? (
            <p className="pt-1.5 text-center font-hand text-lg leading-snug text-[var(--stone-700)]">
              {photo.caption}
            </p>
          ) : null}
        </a>
      ))}
      {files.map((file) => (
        <a
          key={file.url}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex max-w-[76%] items-center gap-2.5 rounded-md border border-border-subtle bg-card px-3 py-2.5 transition-colors hover:border-brand"
        >
          <Icon name="document" size={20} className="shrink-0 text-muted" />
          <span className="truncate text-sm font-medium text-strong">{file.name}</span>
        </a>
      ))}
    </div>
  );
}

const RECEIPT_NOUNS: Record<string, string> = {
  image: "Photo",
  video: "Video",
  audio: "Voice note",
  document: "File",
  text: "File",
  other: "File",
};

function receiptLabel(
  receipt: ChatAttachmentReceipt,
  childName: string | null,
): string {
  const noun = RECEIPT_NOUNS[receipt.kind] ?? "File";
  return childName
    ? `${noun} saved in ${childName}'s binder`
    : `${noun} saved in your family's binder`;
}

/**
 * The save receipts, the reader gate's biggest ask: when Homa keeps
 * something, say so in her language and hand over the eraser. One sage
 * pill per attachment plus Undo; Undo removes the binder record and the
 * file, then the pill says so.
 */
export function AttachmentReceiptChips({
  receipts,
  childNameById,
}: {
  receipts: readonly ChatAttachmentReceipt[];
  childNameById: ReadonlyMap<string, string>;
}) {
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  async function undo(id: string) {
    setBusyIds((current) => new Set(current).add(id));
    const ok = await undoChatAttachment(id);
    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (ok) setUndone((current) => new Set(current).add(id));
  }

  if (receipts.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {receipts.map((receipt) => {
        const childName = receipt.childId
          ? childNameById.get(receipt.childId) ?? null
          : null;
        if (undone.has(receipt.id)) {
          return (
            <p key={receipt.id} className="text-sm text-subtle">
              Removed from the binder and deleted.
            </p>
          );
        }
        return (
          <div key={receipt.id} className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-8 items-center rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-sm font-semibold text-sage">
              {receiptLabel(receipt, childName)}
            </span>
            <button
              type="button"
              disabled={busyIds.has(receipt.id)}
              onClick={() => void undo(receipt.id)}
              className="min-h-8 rounded-pill border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-strong transition-colors hover:border-sage disabled:cursor-not-allowed disabled:opacity-60"
            >
              Undo
            </button>
          </div>
        );
      })}
    </div>
  );
}
