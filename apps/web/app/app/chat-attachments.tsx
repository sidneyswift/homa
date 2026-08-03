"use client";

import { upload } from "@vercel/blob/client";
import type { FilePart, ImagePart, UserContent } from "ai";
import { useCallback, useRef, useState } from "react";

import { Icon } from "../../components/design/Icon";
import { prepareChildPhotoForUpload } from "../../lib/child-photo-prepare";

/**
 * The composer's attach flow (approved chat redesign 2026-07-13,
 * "everything SMS takes"): pick or shoot files, stage them as thumbnail
 * chips with an x, upload straight to the family's own chat blob space
 * (/api/chat/upload token route), and at send time trade the URLs for
 * model parts, marker text, and binder receipts (/api/chat/attachments).
 * Nothing sends until the arrow; the x tosses a staged file.
 *
 * Photos are downscaled in the browser before upload, which also drops
 * EXIF location data (the child-photo rule, lib/child-photo-prepare.ts);
 * everything else uploads as picked.
 */

export type StagedAttachmentStatus = "uploading" | "ready" | "failed";

export interface StagedAttachment {
  localId: string;
  name: string;
  mediaType: string;
  /** Object URL for image thumbnails; null for non-images. */
  previewUrl: string | null;
  status: StagedAttachmentStatus;
  blobUrl: string | null;
}

export interface ChatAttachmentReceipt {
  id: string;
  kind: string;
  outcome: string;
  caption: string | null;
  childId: string | null;
}

export interface PreparedAttachmentSend {
  textBlocks: string[];
  parts: Array<ImagePart | FilePart>;
  receipts: ChatAttachmentReceipt[];
}

let nextLocalId = 0;

function safePathName(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/gu, "-").replace(/-+/gu, "-");
  return cleaned.length > 0 ? cleaned.slice(-80) : "file";
}

/**
 * Mirrors eve's summarizeUserContent (protocol/message.js) so the
 * client's recovery bookkeeping compares against exactly the string the
 * message.received event will carry for a parts send.
 */
export function summarizeOutgoingParts(parts: UserContent): string {
  if (typeof parts === "string") return parts;
  const lines: string[] = [];
  for (const part of parts) {
    if (part.type === "text") lines.push(part.text);
    else if (part.type === "file") {
      const mediaType = typeof part.mediaType === "string" ? part.mediaType : "file";
      lines.push(`[file: ${part.filename ?? mediaType} (${mediaType})]`);
    } else if (part.type === "image") {
      lines.push(`[image: ${part.mediaType ?? "image"}]`);
    }
  }
  return lines.join("\n");
}

export function useChatAttachments(familyId: string | null) {
  const [staged, setStaged] = useState<StagedAttachment[]>([]);

  const addFiles = useCallback(
    (files: readonly File[]) => {
      if (!familyId || files.length === 0) return;
      for (const file of files) {
        const localId = `att-${nextLocalId++}`;
        const isImage = file.type.startsWith("image/");
        const entry: StagedAttachment = {
          localId,
          name: file.name || (isImage ? "photo.jpg" : "file"),
          mediaType: file.type || "application/octet-stream",
          previewUrl: isImage ? URL.createObjectURL(file) : null,
          status: "uploading",
          blobUrl: null,
        };
        setStaged((current) => [...current, entry]);
        void (async () => {
          try {
            let payload: Blob = file;
            let mediaType = entry.mediaType;
            let pathName = safePathName(entry.name);
            if (isImage) {
              // Downscaled JPEG: small enough to read fast, EXIF gone.
              const prepared = await prepareChildPhotoForUpload(file);
              if (prepared) {
                payload = prepared;
                mediaType = "image/jpeg";
                pathName = `${pathName.replace(/\.[^.]+$/u, "")}.jpg`;
              }
            }
            const result = await upload(
              `families/${familyId}/chat/${pathName}`,
              payload,
              {
                access: "public",
                handleUploadUrl: "/api/chat/upload",
                clientPayload: mediaType,
                contentType: mediaType,
              },
            );
            setStaged((current) =>
              current.map((item) =>
                item.localId === localId
                  ? { ...item, status: "ready", blobUrl: result.url, mediaType }
                  : item,
              ),
            );
          } catch {
            setStaged((current) =>
              current.map((item) =>
                item.localId === localId ? { ...item, status: "failed" } : item,
              ),
            );
          }
        })();
      }
    },
    [familyId],
  );

  const remove = useCallback((localId: string) => {
    setStaged((current) => {
      const entry = current.find((item) => item.localId === localId);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return current.filter((item) => item.localId !== localId);
    });
  }, []);

  const clear = useCallback(() => {
    setStaged((current) => {
      for (const entry of current) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
      return [];
    });
  }, []);

  return {
    staged,
    addFiles,
    remove,
    clear,
    anyUploading: staged.some((item) => item.status === "uploading"),
    readyCount: staged.filter((item) => item.status === "ready").length,
  };
}

/**
 * prepareAttachmentsForSend: step 2 of the attach flow. Trades staged
 * blob URLs for model parts, marker text, and receipts. Throws on a
 * non-ok response; the caller keeps the staged files and shows the
 * try-again line.
 */
export async function prepareAttachmentsForSend(
  staged: readonly StagedAttachment[],
  childId: string | null,
): Promise<PreparedAttachmentSend> {
  const items = staged
    .filter((item) => item.status === "ready" && item.blobUrl)
    .map((item) => ({
      url: item.blobUrl,
      mediaType: item.mediaType,
      name: item.name,
    }));
  const response = await fetch("/api/chat/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, childId }),
  });
  if (!response.ok) throw new Error(`attachment prepare failed: ${response.status}`);
  const body = (await response.json()) as {
    ok: boolean;
    textBlocks?: string[];
    parts?: Array<ImagePart | FilePart>;
    receipts?: ChatAttachmentReceipt[];
  };
  if (!body.ok) throw new Error("attachment prepare rejected");
  return {
    textBlocks: body.textBlocks ?? [],
    parts: body.parts ?? [],
    receipts: body.receipts ?? [],
  };
}

/** The receipt chip's Undo: removes the binder record and the file. */
export async function undoChatAttachment(id: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/chat/attachments?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/** Everything the file picker admits; the token route is the real wall. */
const FILE_ACCEPT = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/*",
  "audio/*",
].join(",");

export function AttachMenuButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: readonly File[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(input: HTMLInputElement | null) {
    setOpen(false);
    input?.click();
  }

  function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  }

  return (
    <div className="relative">
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={onPicked}
      />
      <input ref={fileRef} type="file" accept={FILE_ACCEPT} multiple hidden onChange={onPicked} />
      <button
        type="button"
        aria-label="Add a photo, video, or file"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-page hover:text-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="add" size={20} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-12 left-0 z-40 w-52 overflow-hidden rounded-md border border-border-subtle bg-card shadow-lg">
            <button
              type="button"
              onClick={() => pick(libraryRef.current)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-strong transition-colors hover:bg-page"
            >
              <Icon name="image" size={16} className="text-muted" />
              Photo or video
            </button>
            <button
              type="button"
              onClick={() => pick(fileRef.current)}
              className="flex w-full items-center gap-2.5 border-t border-border-subtle px-3.5 py-2.5 text-left text-sm font-medium text-strong transition-colors hover:bg-page"
            >
              <Icon name="document" size={16} className="text-muted" />
              File (PDF, Word, more)
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The camera's own seat in the rail (scrapbook rule: the photo of the
 *  page is the most valuable thing she can hand Homa). */
export function CameraButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: readonly File[]) => void;
  disabled?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <button
        type="button"
        aria-label="Take a photo"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-page hover:text-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="camera" size={20} />
      </button>
    </>
  );
}

export function PendingAttachmentChips({
  staged,
  onRemove,
}: {
  staged: readonly StagedAttachment[];
  onRemove: (localId: string) => void;
}) {
  if (staged.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {staged.map((item) => (
        <div
          key={item.localId}
          className="relative h-14 w-14 overflow-hidden rounded-md border border-border-subtle bg-page"
        >
          {item.previewUrl ? (
            // Local object URL, alive only while staged.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.previewUrl}
              alt={item.name}
              className={`h-full w-full object-cover ${item.status === "uploading" ? "opacity-50" : ""}`}
            />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center text-muted ${item.status === "uploading" ? "opacity-50" : ""}`}
              title={item.name}
            >
              <Icon name="document" size={20} />
            </span>
          )}
          {item.status === "uploading" ? (
            <span className="absolute inset-x-0 bottom-0 bg-[rgba(34,30,26,0.6)] py-0.5 text-center text-[9px] font-semibold text-white">
              Attaching…
            </span>
          ) : null}
          {item.status === "failed" ? (
            <span className="absolute inset-x-0 bottom-0 bg-danger py-0.5 text-center text-[9px] font-semibold text-white">
              Didn&rsquo;t attach
            </span>
          ) : null}
          <button
            type="button"
            aria-label={item.previewUrl ? "Remove this photo" : "Remove this file"}
            onClick={() => onRemove(item.localId)}
            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(34,30,26,0.72)] text-white transition-colors hover:bg-[rgba(34,30,26,0.9)]"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
