"use client";

import {
  completeMultipartUpload,
  createMultipartUpload,
  uploadPart,
} from "@vercel/blob/client";
import {
  AlertCircle,
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  FileQuestion,
  FileText,
  FileVideo,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";

import {
  familyAssetUploadFingerprint,
  familyAssetUploadPartByteSize,
  familyAssetUploadPartCount,
  familyAssetUploadProgress,
  familyAssetUploadPartSha256,
  LIBRARY_MULTIPART_CHUNK_BYTES,
  mergeFamilyAssetUploadParts,
  type FamilyAssetUploadPart,
  type FamilyAssetUploadView,
} from "../../../lib/library/family-asset-uploads";
import {
  formatFamilyAssetBytes,
  libraryUploadMediaType,
  MAX_LIBRARY_UPLOAD_BYTES,
  type FamilyAssetFileKind,
  type FamilyAssetView,
} from "../../../lib/library/family-assets";

interface UploadRow {
  id: string;
  reservation: FamilyAssetUploadView | null;
  name: string;
  progress: number;
  state:
    | "preparing"
    | "uploading"
    | "paused"
    | "remove_failed"
    | "added"
    | "failed";
  message: string | null;
}

interface UploadMutationResponse {
  ok: boolean;
  reason?: string;
  upload?: FamilyAssetUploadView;
}

interface AssetFinalizationResponse {
  ok: boolean;
  reason?: string;
  asset?: FamilyAssetView;
}

const FILE_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  "text/*",
  "application/pdf",
  ".epub",
  ".mobi",
  ".azw",
  ".azw3",
  ".zip",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".pages",
  ".numbers",
  ".key",
].join(",");

const FILE_KIND_LABELS: Record<FamilyAssetFileKind, string> = {
  document: "Document file",
  image: "Image file",
  audio: "Audio file",
  video: "Video file",
  archive: "Archive file",
  link: "Saved link",
  other: "Other file",
};

function fileKindLabel(asset: FamilyAssetView): string {
  if (asset.fileKind !== "archive") return FILE_KIND_LABELS[asset.fileKind];
  if (
    asset.mediaType === "application/epub+zip" ||
    asset.mediaType === "application/vnd.amazon.ebook" ||
    asset.mediaType === "application/x-mobipocket-ebook"
  ) {
    return "Ebook file";
  }
  if (asset.mediaType === "application/zip") return "ZIP archive";
  return "Archive file";
}

const FILE_KIND_ICONS = {
  document: FileText,
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  link: FileText,
  other: FileQuestion,
} as const;

function stableDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function uploadFailureMessage(error: unknown, resumable: boolean): string {
  if (error instanceof Error && error.message === "unsupported-file") {
    return "Homa cannot save that file type yet. Try a PDF, photo, audio, video, ebook, ZIP, Word, Excel, or PowerPoint file.";
  }
  if (error instanceof Error && error.message === "resume-file-mismatch") {
    return "That is not the file this upload started with.";
  }
  if (resumable) {
    return "Upload paused. Your upload progress is still here.";
  }
  return "That file did not save. Nothing was added. Try again.";
}

function rowFromPersistedUpload(upload: FamilyAssetUploadView): UploadRow {
  const removeFailed = upload.errorCode === "blob_delete_failed";
  return {
    id: upload.id,
    reservation: upload,
    name: upload.originalName,
    progress: familyAssetUploadProgress(upload.byteSize, upload.completedParts),
    state: removeFailed ? "remove_failed" : "paused",
    message: upload.statusNote ?? "Upload paused. Your upload progress is still here.",
  };
}

function uploadStatusMessage(upload: UploadRow): string | null {
  if (upload.state === "uploading") {
    return upload.message ?? `Uploading ${upload.progress}%`;
  }
  if (upload.state === "paused" && upload.progress > 0) {
    return `${upload.progress}% uploaded. ${upload.message ?? "Upload paused."}`;
  }
  return upload.message;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) {
    const reason =
      body && typeof body === "object" && "reason" in body
        ? String((body as { reason?: unknown }).reason ?? "request-failed")
        : "request-failed";
    throw new Error(reason);
  }
  return body;
}

export function LibraryView({
  initialAssets,
  initialUploads,
}: {
  initialAssets: FamilyAssetView[];
  initialUploads: FamilyAssetUploadView[];
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const resumePickerRef = useRef<HTMLInputElement>(null);
  const resumeUploadIdRef = useRef<string | null>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [uploads, setUploads] = useState<UploadRow[]>(() =>
    initialUploads.map(rowFromPersistedUpload),
  );
  const [query, setQuery] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyPromptOpen, setPrivacyPromptOpen] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
  const hasRecoverableUpload = uploads.some(
    (upload) =>
      upload.state === "preparing" ||
      upload.state === "uploading" ||
      upload.state === "paused" ||
      upload.state === "remove_failed",
  );

  const visibleAssets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return assets;
    return assets.filter((asset) =>
      `${asset.title} ${asset.originalName}`.toLocaleLowerCase().includes(needle),
    );
  }, [assets, query]);

  function updateUpload(id: string, changes: Partial<UploadRow>) {
    setUploads((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  async function reserveUpload(
    clientRequestId: string,
    file: File,
    mediaType: string,
    fingerprintSha256: string,
  ): Promise<FamilyAssetUploadView> {
    const response = await fetch("/api/library/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientRequestId,
        originalName: file.name,
        mediaType,
        byteSize: file.size,
        lastModified: file.lastModified,
        fingerprintSha256,
      }),
    });
    const result = await readJson<UploadMutationResponse>(response);
    if (!result.ok || !result.upload) throw new Error(result.reason ?? "reserve-failed");
    return result.upload;
  }

  async function patchUpload(
    body: Record<string, unknown>,
  ): Promise<FamilyAssetUploadView> {
    const response = await fetch("/api/library/uploads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await readJson<UploadMutationResponse>(response);
    if (!result.ok || !result.upload) throw new Error(result.reason ?? "update-failed");
    return result.upload;
  }

  async function clientUploadToken(upload: FamilyAssetUploadView): Promise<string> {
    const response = await fetch("/api/library/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: upload.pathname,
          multipart: true,
          clientPayload: JSON.stringify({ reservationId: upload.id }),
        },
      }),
    });
    const result = await readJson<{ clientToken?: string }>(response);
    if (!result.clientToken) throw new Error("token-missing");
    return result.clientToken;
  }

  async function markUploadInterrupted(
    uploadId: string,
    errorCode: "network_interrupted" | "completion_failed",
  ): Promise<void> {
    try {
      await patchUpload({
        operation: "attention",
        id: uploadId,
        errorCode,
      });
    } catch {
      console.error("family Library upload interruption could not be recorded");
    }
  }

  async function performUpload(
    file: File,
    rowId: string,
    reservation: FamilyAssetUploadView,
  ): Promise<void> {
    updateUpload(rowId, {
      reservation,
      progress: familyAssetUploadProgress(
        reservation.byteSize,
        reservation.completedParts,
      ),
      state: "uploading",
      message: null,
    });

    let active = reservation;
    let completionStarted = false;
    try {
      const token = await clientUploadToken(reservation);
      if (!active.blobUploadId || !active.blobKey) {
        const multipart = await createMultipartUpload(active.pathname, {
          access: "public",
          contentType: active.mediaType,
          token,
        });
        active = await patchUpload({
          operation: "start",
          id: active.id,
          blobUploadId: multipart.uploadId,
          blobKey: multipart.key,
        });
        updateUpload(rowId, { reservation: active });
      }
      if (!active.blobUploadId || !active.blobKey) {
        throw new Error("multipart-identity-missing");
      }
      const blobUploadId = active.blobUploadId;
      const blobKey = active.blobKey;
      const pathname = active.pathname;
      const mediaType = active.mediaType;

      const parts = new Map<number, FamilyAssetUploadPart>(
        active.completedParts.map((part) => [part.partNumber, part]),
      );
      for (const persistedPart of parts.values()) {
        const start =
          (persistedPart.partNumber - 1) * LIBRARY_MULTIPART_CHUNK_BYTES;
        const candidateSha256 = await familyAssetUploadPartSha256(
          file.slice(start, start + persistedPart.byteSize),
        );
        if (candidateSha256 !== persistedPart.sha256) {
          throw new Error("resume-file-mismatch");
        }
      }
      const missingPartNumbers: number[] = [];
      for (
        let partNumber = 1;
        partNumber <= familyAssetUploadPartCount(file.size);
        partNumber += 1
      ) {
        if (!parts.has(partNumber)) missingPartNumbers.push(partNumber);
      }

      let completedBytes = [...parts.values()].reduce(
        (total, part) => total + part.byteSize,
        0,
      );
      const inFlightBytes = new Map<number, number>();
      let nextMissingIndex = 0;
      const updateProgress = () => {
        const loadedBytes = [...inFlightBytes.values()].reduce(
          (total, loaded) => total + loaded,
          completedBytes,
        );
        updateUpload(rowId, {
          progress: Math.min(99, Math.floor((loadedBytes / file.size) * 100)),
        });
      };
      const uploadWorker = async () => {
        while (nextMissingIndex < missingPartNumbers.length) {
          const partNumber = missingPartNumbers[nextMissingIndex];
          nextMissingIndex += 1;
          if (!partNumber) return;
          const byteSize = familyAssetUploadPartByteSize(file.size, partNumber);
          if (!byteSize) throw new Error("invalid-part");
          const start = (partNumber - 1) * LIBRARY_MULTIPART_CHUNK_BYTES;
          const chunk = file.slice(start, start + byteSize);
          const sha256 = await familyAssetUploadPartSha256(chunk);
          const uploaded = await uploadPart(
            pathname,
            chunk,
            {
              access: "public",
              contentType: mediaType,
              token,
              uploadId: blobUploadId,
              key: blobKey,
              partNumber,
              onUploadProgress: ({ loaded }) => {
                inFlightBytes.set(partNumber, loaded);
                updateProgress();
              },
            },
          );
          const persisted = await patchUpload({
            operation: "part",
            id: active.id,
            partNumber: uploaded.partNumber,
            etag: uploaded.etag,
            byteSize,
            sha256,
          });
          active = {
            ...persisted,
            completedParts: mergeFamilyAssetUploadParts(
              active.completedParts,
              persisted.completedParts,
            ),
          };
          updateUpload(rowId, { reservation: active });
          inFlightBytes.delete(partNumber);
          completedBytes += byteSize;
          parts.set(partNumber, { ...uploaded, byteSize, sha256 });
          updateProgress();
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(4, Math.max(1, missingPartNumbers.length)) },
          uploadWorker,
        ),
      );

      completionStarted = true;
      active = await patchUpload({ operation: "completing", id: active.id });
      if (!active.blobUploadId || !active.blobKey) {
        throw new Error("multipart-identity-missing");
      }
      updateUpload(rowId, { progress: 100, message: "Finishing your upload…" });
      const blob = await completeMultipartUpload(
        active.pathname,
        [...parts.values()].sort(
          (first, second) => first.partNumber - second.partNumber,
        ),
        {
          access: "public",
          contentType: active.mediaType,
          token,
          uploadId: active.blobUploadId,
          key: active.blobKey,
        },
      );
      const response = await fetch("/api/library/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: active.id, url: blob.url }),
      });
      const result = await readJson<AssetFinalizationResponse>(response);
      if (!result.ok || !result.asset) {
        throw new Error(result.reason ?? "asset-record-missing");
      }
      setAssets((current) => [
        result.asset as FamilyAssetView,
        ...current.filter((asset) => asset.id !== result.asset?.id),
      ]);
      updateUpload(rowId, {
        reservation: active,
        state: "added",
        progress: 100,
        message: "Saved to your Library. You can download it anytime.",
      });
    } catch (error) {
      if (!(error instanceof Error && error.message === "resume-file-mismatch")) {
        await markUploadInterrupted(
          reservation.id,
          completionStarted ? "completion_failed" : "network_interrupted",
        );
      }
      updateUpload(rowId, {
        reservation: active,
        state: "paused",
        message: uploadFailureMessage(error, true),
      });
    }
  }

  async function addFile(file: File) {
    const id = crypto.randomUUID();
    setUploads((current) => [
      ...current,
      {
        id,
        reservation: null,
        name: file.name || "Untitled file",
        progress: 0,
        state: "preparing",
        message: "Getting your upload ready…",
      },
    ]);
    if (file.size < 1 || file.size > MAX_LIBRARY_UPLOAD_BYTES) {
      updateUpload(id, {
        state: "failed",
        message:
          file.size > MAX_LIBRARY_UPLOAD_BYTES
            ? "That file is over 500 MB. Choose a smaller file."
            : "There is nothing in that file to upload. Choose a copy that opens on your device.",
      });
      return;
    }

    try {
      const mediaType = libraryUploadMediaType(file.name, file.type);
      if (!mediaType) throw new Error("unsupported-file");
      const fingerprint = await familyAssetUploadFingerprint(file);
      const reservation = await reserveUpload(
        id,
        file,
        mediaType,
        fingerprint,
      );
      await performUpload(file, id, reservation);
    } catch (error) {
      updateUpload(id, {
        state: "failed",
        message: uploadFailureMessage(error, false),
      });
    }
  }

  function onFilesPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files.slice(0, 10)) void addFile(file);
  }

  async function resumeUpload(file: File, row: UploadRow): Promise<void> {
    const reservation = row.reservation;
    if (!reservation) return;
    updateUpload(row.id, { state: "preparing", message: "Checking that file…" });
    try {
      const fingerprint = await familyAssetUploadFingerprint(file);
      if (fingerprint !== reservation.fingerprintSha256) {
        updateUpload(row.id, {
          state: "paused",
          message: "That is not the file this upload started with.",
        });
        return;
      }
      await performUpload(file, row.id, reservation);
    } catch (error) {
      updateUpload(row.id, {
        state: "paused",
        message: uploadFailureMessage(error, true),
      });
    }
  }

  function beginResumeUpload(id: string) {
    resumeUploadIdRef.current = id;
    resumePickerRef.current?.click();
  }

  async function restartUpload(row: UploadRow) {
    if (!row.reservation) return;
    try {
      const reservation = await patchUpload({
        operation: "restart",
        id: row.reservation.id,
      });
      updateUpload(row.id, {
        reservation,
        progress: 0,
        state: "paused",
        message: "Upload progress cleared. Choose the same file again to restart.",
      });
      resumeUploadIdRef.current = row.id;
      resumePickerRef.current?.click();
    } catch {
      setPageError("The upload could not restart. Your upload progress is still here. Try again.");
    }
  }

  function onResumeFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const id = resumeUploadIdRef.current;
    event.target.value = "";
    resumeUploadIdRef.current = null;
    if (!file || !id) return;
    const row = uploads.find((item) => item.id === id);
    if (row) void resumeUpload(file, row);
  }

  async function dismissUpload(row: UploadRow) {
    if (row.reservation && row.state !== "added") {
      try {
        const response = await fetch(
          `/api/library/uploads?id=${encodeURIComponent(row.reservation.id)}`,
          { method: "DELETE" },
        );
        if (!response.ok) throw new Error("abandon-failed");
      } catch {
        updateUpload(row.id, {
          state: "remove_failed",
          message: "Homa did not remove this unfinished upload. Try again.",
        });
        setPageError("Homa did not remove this unfinished upload. Try again.");
        return;
      }
    }
    setUploads((current) => current.filter((item) => item.id !== row.id));
  }

  function beginAddingResources() {
    setPageError(null);
    if (privacyAccepted) {
      pickerRef.current?.click();
      return;
    }
    setPrivacyPromptOpen(true);
  }

  function continueToFilePicker() {
    setPrivacyAccepted(true);
    setPrivacyPromptOpen(false);
    pickerRef.current?.click();
  }

  async function removeAsset(asset: FamilyAssetView) {
    const confirmed = window.confirm(
      `Remove “${asset.title}” from your Library? Homa will delete the saved copy.`,
    );
    if (!confirmed) return;
    setPageError(null);
    setDeleting((current) => new Set(current).add(asset.id));
    try {
      const response = await fetch(`/api/library/assets?id=${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`delete failed: ${response.status}`);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
    } catch {
      setPageError("That file is still in your Library. Try removing it again.");
    } finally {
      setDeleting((current) => {
        const next = new Set(current);
        next.delete(asset.id);
        return next;
      });
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold text-strong">Library</h1>
          <p className="mt-2 text-base leading-7 text-body">
            Keep the worksheets, books, and curriculums your family uses. Homa saves a
            copy here without moving your file.
          </p>
        </div>
        <input
          ref={pickerRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          hidden
          onChange={onFilesPicked}
        />
        <input
          ref={resumePickerRef}
          type="file"
          accept={FILE_ACCEPT}
          hidden
          onChange={onResumeFilePicked}
        />
        {assets.length > 0 && !hasRecoverableUpload ? (
          <button
            type="button"
            onClick={beginAddingResources}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--clay-700)]"
          >
            <Upload size={18} aria-hidden="true" />
            Add resources
          </button>
        ) : null}
      </header>

      {privacyPromptOpen && (assets.length > 0 || hasRecoverableUpload) ? (
        <section
          aria-labelledby="library-privacy-heading"
          className="mt-5 rounded-md border border-[var(--gold-300)] bg-[var(--warning-soft)] px-4 py-4"
        >
          <h2 id="library-privacy-heading" className="font-semibold text-strong">
            Before you choose files
          </h2>
          <p className="mt-1 text-sm leading-6 text-body">
            These files are not private. Homa does not list them publicly, but anyone
            with a hard-to-guess file link can open one. Skip anything with family
            details you would not want shared.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={continueToFilePicker}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)]"
            >
              Choose files
            </button>
            <button
              type="button"
              onClick={() => setPrivacyPromptOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-muted hover:bg-card hover:text-strong"
            >
              Go back
            </button>
          </div>
        </section>
      ) : null}

      {uploads.length > 0 ? (
        <section aria-label="Uploads" className="mt-6 space-y-2">
          {uploads.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-border-subtle bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 sm:flex-1">
                  <p className="break-words text-sm font-semibold text-strong">
                    {item.name}
                  </p>
                  <p
                    className={
                      item.state === "failed" || item.state === "remove_failed"
                        ? "mt-1 text-sm text-danger"
                        : "mt-1 text-sm text-muted"
                    }
                  >
                    {uploadStatusMessage(item)}
                  </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-1 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end">
                  {item.state === "paused" ? (
                    <button
                      type="button"
                      onClick={() => beginResumeUpload(item.id)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-3 text-sm font-bold text-brand hover:bg-brand-soft sm:w-auto"
                    >
                      Choose file to resume
                    </button>
                  ) : null}
                  {item.state === "paused" && item.progress > 0 ? (
                    <button
                      type="button"
                      onClick={() => void restartUpload(item)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-3 text-sm font-semibold text-muted hover:bg-page hover:text-strong sm:w-auto"
                    >
                      Restart upload
                    </button>
                  ) : null}
                  {item.state === "paused" ||
                  item.state === "remove_failed" ||
                  item.state === "added" ||
                  item.state === "failed" ? (
                    <button
                      type="button"
                      onClick={() => void dismissUpload(item)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-3 text-sm font-semibold text-muted hover:bg-page hover:text-strong sm:w-auto"
                    >
                      {item.state === "paused"
                        ? "Remove upload"
                        : item.state === "remove_failed"
                          ? "Try remove again"
                          : "Dismiss"}
                    </button>
                  ) : null}
                </div>
              </div>
              {item.state === "uploading" ||
              (item.state === "paused" && item.progress > 0) ? (
                <div
                  role="progressbar"
                  aria-label={`Upload progress for ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-page"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-(--dur-fast)"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
              {item.state === "paused" ? (
                <p className="mt-3 text-xs leading-5 text-subtle">
                  Restarting clears upload progress. Removing clears this unfinished
                  upload from Homa. Neither changes the file on your device.
                </p>
              ) : null}
              {item.state === "remove_failed" ? (
                <p className="mt-3 text-xs leading-5 text-subtle">
                  The file on your device was not changed.
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {hasRecoverableUpload ? (
        <button
          type="button"
          onClick={beginAddingResources}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-subtle bg-card px-4 py-2.5 text-sm font-semibold text-strong shadow-sm hover:bg-page"
        >
          <Upload size={18} aria-hidden="true" />
          Add another resource
        </button>
      ) : null}

      {pageError ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-danger">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {pageError}
        </div>
      ) : null}

      {assets.length === 0 && !hasRecoverableUpload ? (
        <section className="mt-8 rounded-lg border border-border-subtle bg-card px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Upload size={22} aria-hidden="true" />
          </div>
          {privacyPromptOpen ? (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-strong">
                Before you choose files
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-body">
                These files are not private. Homa does not list them publicly, but anyone
                with a hard-to-guess file link can open one. Skip anything with family
                details you would not want shared.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={continueToFilePicker}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--clay-700)]"
                >
                  Choose files
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacyPromptOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-muted hover:bg-page hover:text-strong"
                >
                Go back
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-strong">
                Add your first resource
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-body">
                Start with a worksheet, book, or curriculum. You can still sign in and
                download your files after you cancel your membership.
              </p>
              <button
                type="button"
                onClick={beginAddingResources}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--clay-700)]"
              >
                Add a resource
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-muted">
              {assets.length} {assets.length === 1 ? "resource" : "resources"}
            </p>
            <label className="relative block w-full sm:w-72">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <span className="sr-only">Search titles and file names</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles and file names"
                className="min-h-11 w-full rounded-md border border-border-subtle bg-card py-2 pl-9 pr-3 text-sm text-strong outline-none transition-colors placeholder:text-subtle focus:border-brand"
              />
            </label>
          </div>

          {visibleAssets.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border-subtle px-6 py-10 text-center">
              <p className="font-semibold text-strong">Nothing matches that search.</p>
              <p className="mt-1 text-sm text-muted">Try the title or the original file name.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {visibleAssets.map((asset) => {
                const Icon = FILE_KIND_ICONS[asset.fileKind];
                return (
                  <article
                    key={asset.id}
                    className="flex min-h-44 flex-col rounded-lg border border-border-subtle bg-card p-4 shadow-sm sm:min-h-52 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand sm:h-10 sm:w-10">
                        <Icon size={20} aria-hidden="true" />
                      </div>
                      <span className="rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-muted">
                        {fileKindLabel(asset)}
                      </span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 font-display text-lg font-semibold text-strong sm:mt-4">
                      {asset.title}
                    </h2>
                    <p className="mt-1 hidden truncate text-sm text-muted sm:block">
                      {asset.originalName}
                    </p>
                    <p className="mt-1 text-xs text-subtle sm:mt-2">
                      {formatFamilyAssetBytes(asset.byteSize)}
                      <span className="hidden sm:inline">
                        {` · ${stableDateLabel(asset.createdAt)}`}
                      </span>
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-4 sm:pt-5">
                      <a
                        href={asset.downloadUrl}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm font-bold text-strong hover:bg-page"
                      >
                        <Download size={16} aria-hidden="true" />
                        Download file
                      </a>
                      <button
                        type="button"
                        aria-label={`Remove ${asset.title} from Library`}
                        disabled={deleting.has(asset.id)}
                        onClick={() => void removeAsset(asset)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-subtle text-muted hover:bg-page hover:text-danger disabled:cursor-wait disabled:opacity-50"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
