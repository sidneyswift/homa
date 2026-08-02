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
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

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
  type FamilyAssetView,
} from "../../../lib/library/family-assets";
import {
  FAMILY_ASSET_RESOURCE_KIND_LABELS,
  FAMILY_ASSET_STATUS_LABELS,
  FAMILY_ASSET_WHOLE_FAMILY_CHILD,
  familyAssetFilterOptions,
  familyAssetStatusCopy,
  filterFamilyAssets,
  stableFamilyAssetDate,
} from "../../../lib/library/family-asset-shelf";
import { familyAssetLibraryHref } from "../../../lib/library/family-asset-reference";
import {
  LibraryDetailPanel,
  type LibraryChildOption,
  type LibrarySubjectOption,
} from "./library-detail-panel";

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

const FILE_KIND_ICONS = {
  document: FileText,
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  link: FileText,
  other: FileQuestion,
} as const;

function uploadFailureMessage(error: unknown, resumable: boolean): string {
  if (error instanceof Error && error.message === "unsupported-file") {
    return "Homa cannot save that file type yet. Try a PDF, photo, audio, video, ebook, ZIP, Word, Excel, or PowerPoint file.";
  }
  if (error instanceof Error && error.message === "resume-file-mismatch") {
    return "That is not the original file. Choose the same file this upload started with.";
  }
  if (resumable) {
    return "Upload paused. Your progress is saved. Choose the same file to resume.";
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
    message:
      upload.statusNote ??
      "Upload paused. Your progress is saved. Choose the same file to resume.",
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
  childOptions = [],
  subjectOptions = [],
  canUpload = true,
  initialSelectedAssetId = null,
}: {
  initialAssets: FamilyAssetView[];
  initialUploads: FamilyAssetUploadView[];
  childOptions?: LibraryChildOption[];
  subjectOptions?: LibrarySubjectOption[];
  canUpload?: boolean;
  initialSelectedAssetId?: string | null;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const resumePickerRef = useRef<HTMLInputElement>(null);
  const resumeUploadIdRef = useRef<string | null>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [uploads, setUploads] = useState<UploadRow[]>(() =>
    initialUploads.map(rowFromPersistedUpload),
  );
  const [query, setQuery] = useState("");
  const [resourceKind, setResourceKind] = useState<FamilyAssetView["resourceKind"]>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<FamilyAssetView["status"] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [uploadsExpanded, setUploadsExpanded] = useState(
    initialAssets.length === 0 && initialUploads.length > 0,
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(() =>
    initialSelectedAssetId &&
    initialAssets.some((asset) => asset.id === initialSelectedAssetId)
      ? initialSelectedAssetId
      : null,
  );
  const [pageError, setPageError] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyPromptOpen, setPrivacyPromptOpen] = useState(false);
  const hasRecoverableUpload = uploads.some(
    (upload) =>
      upload.state === "preparing" ||
      upload.state === "uploading" ||
      upload.state === "paused" ||
      upload.state === "remove_failed",
  );

  const filterOptions = useMemo(() => familyAssetFilterOptions(assets), [assets]);
  const visibleAssets = useMemo(
    () =>
      filterFamilyAssets(assets, {
        query,
        resourceKind,
        childId,
        subjectId,
        status,
      }),
    [assets, query, resourceKind, childId, subjectId, status],
  );
  const selectedAsset = selectedAssetId
    ? assets.find((asset) => asset.id === selectedAssetId) ?? null
    : null;
  const activeFilterCount = [resourceKind, childId, subjectId, status].filter(Boolean).length;
  const hasSearch = query.trim().length > 0 || activeFilterCount > 0;

  useEffect(() => {
    if (!hasSearch) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/library/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "searched",
          queryLength: Math.min(180, query.trim().length),
          activeFilters: activeFilterCount,
          resultCount: visibleAssets.length,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeFilterCount, hasSearch, query, visibleAssets.length]);

  const processingAssetKey = assets
    .filter((asset) => asset.status === "processing")
    .map((asset) => asset.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!processingAssetKey) return;
    const assetIds = processingAssetKey.split(",");
    let refreshing = false;
    const timer = window.setInterval(() => {
      if (refreshing) return;
      refreshing = true;
      void Promise.all(
        assetIds.map(async (assetId) => {
          const response = await fetch(
            `/api/library/assets?id=${encodeURIComponent(assetId)}`,
          );
          return await readJson<AssetFinalizationResponse>(response);
        }),
      )
        .then((responses) => {
          const refreshed = new Map(
            responses.flatMap((response) =>
              response.asset ? [[response.asset.id, response.asset] as const] : [],
            ),
          );
          setAssets((current) =>
            current.map((asset) => refreshed.get(asset.id) ?? asset),
          );
        })
        .catch(() => undefined)
        .finally(() => {
          refreshing = false;
        });
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [processingAssetKey]);

  function openAsset(asset: FamilyAssetView) {
    setSelectedAssetId(asset.id);
    window.history.replaceState(
      window.history.state,
      "",
      familyAssetLibraryHref(asset.id),
    );
    void fetch("/api/library/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reopened", assetId: asset.id }),
      keepalive: true,
    }).catch(() => undefined);
  }

  function closeAsset() {
    setSelectedAssetId(null);
    window.history.replaceState(window.history.state, "", "/app/library");
  }

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
        message: "Saved to your Library. Download the original whenever you are signed in.",
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
    setUploadsExpanded(true);
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
            : "That file is empty. Choose a file that opens on your device.",
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
          message: "That is not the original file. Choose the same file this upload started with.",
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
    setUploadsExpanded(true);
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
    if (!canUpload) return;
    setPageError(null);
    if (privacyAccepted) {
      pickerRef.current?.click();
      return;
    }
    setPrivacyPromptOpen(true);
  }

  function continueToFilePicker() {
    if (!canUpload) return;
    setPrivacyAccepted(true);
    setPrivacyPromptOpen(false);
    pickerRef.current?.click();
  }

  function clearFilters() {
    setQuery("");
    setResourceKind(null);
    setChildId(null);
    setSubjectId(null);
    setStatus(null);
  }

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold text-strong">Library</h1>
          <p className="mt-2 text-base leading-7 text-body">
            Keep your family&apos;s worksheets, books, and curriculum in one place. Homa
            saves a copy here without moving the original on your device.
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
        {canUpload && assets.length > 0 && !hasRecoverableUpload ? (
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

      {!canUpload ? (
        <section className="mt-5 rounded-md border border-border-subtle bg-card px-4 py-4 shadow-sm">
          <h2 className="font-semibold text-strong">Your Library stays with you</h2>
          <p className="mt-1 text-sm leading-6 text-body">
            Open, organize, download, or remove anything already here. Renew your
            membership when you want to add another resource.
          </p>
          <a
            href="/onboarding/trial"
            className="mt-3 inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
          >
            See membership options
          </a>
        </section>
      ) : null}

      {canUpload && privacyPromptOpen && (assets.length > 0 || hasRecoverableUpload) ? (
        <section
          aria-labelledby="library-privacy-heading"
          className="mt-5 rounded-md border border-[var(--gold-300)] bg-[var(--warning-soft)] px-4 py-4"
        >
          <h2 id="library-privacy-heading" className="font-semibold text-strong">
            Before you choose files
          </h2>
          <p className="mt-1 text-sm leading-6 text-body">
            Each file has a public link that opens without signing in. Homa does not
            list the link, but anyone who gets it can open the file. This Library is
            for curriculum and other files without private family information.
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
        <section aria-label="Uploads" className="mt-6">
          <details
            open={uploadsExpanded}
            onToggle={(event) => setUploadsExpanded(event.currentTarget.open)}
            className="rounded-lg border border-border-subtle bg-card shadow-sm"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-strong marker:content-none">
              <span>
                {uploads.length} unfinished {uploads.length === 1 ? "upload" : "uploads"}
                <span className="ml-2 font-normal text-muted">
                  Everything already on your shelf is still available.
                </span>
              </span>
              <ChevronDown
                size={18}
                className={uploadsExpanded ? "rotate-180 text-muted" : "text-muted"}
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-2 border-t border-border-subtle p-2">
              {uploads.map((item) => (
            <div
              key={item.id}
              className="rounded-md bg-page px-4 py-3"
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
                  {canUpload && item.state === "paused" ? (
                    <button
                      type="button"
                      onClick={() => beginResumeUpload(item.id)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-3 text-sm font-bold text-brand hover:bg-brand-soft sm:w-auto"
                    >
                      Choose same file to resume
                    </button>
                  ) : null}
                  {canUpload && item.state === "paused" && item.progress > 0 ? (
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
                          ? "Try removing again"
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
                  {canUpload
                    ? "Restarting clears upload progress. Removing clears this unfinished upload from Homa. Neither changes the file on your device."
                    : "Removing clears this unfinished upload from Homa. The file on your device stays."}
                </p>
              ) : null}
              {item.state === "remove_failed" ? (
                <p className="mt-3 text-xs leading-5 text-subtle">
                  The file on your device was not changed.
                </p>
              ) : null}
            </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {canUpload && hasRecoverableUpload ? (
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
          {canUpload && privacyPromptOpen ? (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-strong">
                Before you choose files
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-body">
                Each file has a public link that opens without signing in. Homa does not
                list the link, but anyone who gets it can open the file. This Library is
                for curriculum and other files without private family information.
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
          ) : canUpload ? (
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
          ) : (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-strong">
                Nothing saved here yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-body">
                Renew your membership when you are ready to add a resource.
              </p>
            </>
          )}
        </section>
      ) : (
        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-strong">Your shelf</h2>
              <p className="mt-1 text-sm text-muted">
                {visibleAssets.length === assets.length
                  ? `${assets.length} ${assets.length === 1 ? "resource" : "resources"}`
                  : `${visibleAssets.length} of ${assets.length} resources`}
              </p>
            </div>
            <label className="relative block w-full sm:w-80">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <span className="sr-only">Search your Library</span>
              <input
                type="search"
                value={query}
                maxLength={180}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, child, or subject"
                className="min-h-11 w-full rounded-md border border-border-subtle bg-card py-2 pl-9 pr-3 text-sm text-strong outline-none transition-colors placeholder:text-subtle focus:border-brand"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft sm:hidden"
            aria-expanded={filtersOpen || hasSearch}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>

          <div
            className={`${filtersOpen || hasSearch ? "grid" : "hidden"} mt-2 gap-2 sm:mt-4 sm:grid sm:grid-cols-2 xl:grid-cols-4`}
          >
            <label className="text-xs font-semibold text-muted">
              Type
              <select
                value={resourceKind ?? ""}
                onChange={(event) =>
                  setResourceKind(
                    (event.target.value || null) as FamilyAssetView["resourceKind"],
                  )
                }
                className="mt-1 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
              >
                <option value="">All types</option>
                {filterOptions.resourceKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {FAMILY_ASSET_RESOURCE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              For
              <select
                value={childId ?? ""}
                onChange={(event) => setChildId(event.target.value || null)}
                className="mt-1 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
              >
                <option value="">All resources</option>
                <option value={FAMILY_ASSET_WHOLE_FAMILY_CHILD}>Whole family</option>
                {filterOptions.children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Subject
              <select
                value={subjectId ?? ""}
                onChange={(event) => setSubjectId(event.target.value || null)}
                className="mt-1 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
              >
                <option value="">All subjects</option>
                {filterOptions.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Status
              <select
                value={status ?? ""}
                onChange={(event) =>
                  setStatus((event.target.value || null) as FamilyAssetView["status"] | null)
                }
                className="mt-1 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
              >
                <option value="">All statuses</option>
                {filterOptions.statuses.map((itemStatus) => (
                  <option key={itemStatus} value={itemStatus}>
                    {FAMILY_ASSET_STATUS_LABELS[itemStatus]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasSearch ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
            >
              Clear search and filters
            </button>
          ) : null}

          {visibleAssets.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border-subtle px-6 py-10 text-center">
              <p className="font-semibold text-strong">Nothing on this shelf matches.</p>
              <p className="mt-1 text-sm text-muted">Clear a filter or try another word.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {visibleAssets.map((asset) => {
                const Icon = FILE_KIND_ICONS[asset.fileKind];
                const assetStatus = familyAssetStatusCopy(asset);
                return (
                  <article
                    key={asset.id}
                    className="flex min-h-44 flex-col rounded-lg border border-border-subtle bg-card p-4 shadow-sm sm:min-h-52 sm:p-5"
                  >
                    <button
                      type="button"
                      onClick={() => openAsset(asset)}
                      className="group block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand sm:h-10 sm:w-10">
                          <Icon size={20} aria-hidden="true" />
                        </div>
                        <span className="rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-muted">
                          {assetStatus.label}
                        </span>
                      </div>
                      <h2 className="mt-3 line-clamp-2 font-display text-lg font-semibold text-strong group-hover:text-brand sm:mt-4">
                        {asset.title}
                      </h2>
                      <p className="mt-1 hidden truncate text-sm text-muted sm:block">
                        {asset.originalName}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {asset.resourceKind ? (
                          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                            {FAMILY_ASSET_RESOURCE_KIND_LABELS[asset.resourceKind]}
                          </span>
                        ) : null}
                        {asset.children.slice(0, 2).map((child) => (
                          <span key={child.id} className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
                            {child.name}
                          </span>
                        ))}
                        {asset.children.length === 0 ? (
                          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">Whole family</span>
                        ) : null}
                        {asset.subjects.slice(0, 1).map((subject) => (
                          <span key={subject.id} className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
                            {subject.label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-subtle sm:mt-2">
                        {formatFamilyAssetBytes(asset.byteSize)}
                        <span className="hidden sm:inline">
                          {` · ${stableFamilyAssetDate(asset.createdAt)}`}
                        </span>
                      </p>
                    </button>
                    <div className="mt-auto flex items-center gap-2 pt-4 sm:pt-5">
                      <a
                        href={`/api/library/assets/${encodeURIComponent(asset.id)}/download?surface=shelf`}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm font-bold text-strong hover:bg-page"
                      >
                        <Download size={16} aria-hidden="true" />
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => openAsset(asset)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
                      >
                        View details
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {selectedAsset ? (
        <LibraryDetailPanel
          key={selectedAsset.id}
          asset={selectedAsset}
          childOptions={childOptions}
          subjectOptions={subjectOptions}
          onClose={closeAsset}
          onUpdated={(updated) =>
            setAssets((current) =>
              current.map((asset) => (asset.id === updated.id ? updated : asset)),
            )
          }
          onDeleted={(assetId) => {
            setAssets((current) => current.filter((asset) => asset.id !== assetId));
            closeAsset();
          }}
        />
      ) : null}
    </div>
  );
}
