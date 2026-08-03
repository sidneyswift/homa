"use client";

import {
  completeMultipartUpload,
  createMultipartUpload,
  uploadPart,
} from "@vercel/blob/client";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { ShelfCover } from "../../../components/library/shelf-cover";
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
  libraryUploadMediaType,
  MAX_LIBRARY_UPLOAD_BYTES,
  type FamilyAssetView,
  type FamilyCurriculumUnitView,
} from "../../../lib/library/family-assets";
import {
  FAMILY_ASSET_RESOURCE_KIND_LABELS,
  FAMILY_ASSET_STATUS_LABELS,
  FAMILY_ASSET_WHOLE_FAMILY_CHILD,
  familyAssetFilterOptions,
  familyAssetStatusCopy,
  filterFamilyAssets,
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

const FILE_KIND_COVER_LABELS: Record<FamilyAssetView["fileKind"], string> = {
  document: "Document",
  image: "Image",
  audio: "Audio",
  video: "Video",
  archive: "Archive",
  link: "Saved link",
  other: "Resource",
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

function uploadStatusTone(
  state: UploadRow["state"],
): "info" | "constructive" | "attention" | "error" {
  if (state === "added") return "constructive";
  if (state === "failed" || state === "remove_failed") return "error";
  if (state === "paused") return "attention";
  return "info";
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
  initialCurriculumUnitsByParent = {},
  initialUploads,
  childOptions = [],
  subjectOptions = [],
  canUpload = true,
  initialSelectedAssetId = null,
  initialSelectedUnitId = null,
}: {
  initialAssets: FamilyAssetView[];
  initialCurriculumUnitsByParent?: Record<string, FamilyCurriculumUnitView[]>;
  initialUploads: FamilyAssetUploadView[];
  childOptions?: LibraryChildOption[];
  subjectOptions?: LibrarySubjectOption[];
  canUpload?: boolean;
  initialSelectedAssetId?: string | null;
  initialSelectedUnitId?: string | null;
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
  const selectedCurriculumUnits = selectedAssetId
    ? initialCurriculumUnitsByParent[selectedAssetId] ?? []
    : [];
  const activeFilterCount = [resourceKind, childId, subjectId, status].filter(Boolean).length;
  const advancedFilterCount = [childId, subjectId, status].filter(Boolean).length;
  const hasSearch = query.trim().length > 0 || activeFilterCount > 0;
  const showStatusFilter = filterOptions.statuses.some(
    (itemStatus) => itemStatus !== "ready",
  );
  const hasAdvancedFilterOptions =
    filterOptions.children.length > 0 ||
    filterOptions.subjects.length > 0 ||
    showStatusFilter;
  const resourceKindCounts = useMemo(() => {
    const counts = new Map<NonNullable<FamilyAssetView["resourceKind"]>, number>();
    for (const asset of assets) {
      if (!asset.resourceKind) continue;
      counts.set(asset.resourceKind, (counts.get(asset.resourceKind) ?? 0) + 1);
    }
    return counts;
  }, [assets]);

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
    <div data-brand-surface="library" data-brand-fixture="quiet-authority-v1">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--homa-brand-text)]">
            Kept close
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--homa-ink)]">
            Library
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
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
          <QuietAction
            onClick={beginAddingResources}
            className="shrink-0 self-start sm:self-auto"
            icon={<Icon name="add" size={20} />}
          >
            Add resources
          </QuietAction>
        ) : null}
      </header>

      {!canUpload ? (
        <QuietFrame as="section" tone="paper" className="mt-5 p-4">
          <h2 className="font-semibold text-[var(--homa-ink)]">Your Library stays with you</h2>
          <p className="mt-1 text-sm leading-6 text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
            Open, organize, download, or remove anything already here. Renew your
            membership when you want to add another resource.
          </p>
          <QuietAction href="/onboarding/trial" kind="quiet" className="mt-3">
            See membership options
          </QuietAction>
        </QuietFrame>
      ) : null}

      {canUpload && privacyPromptOpen && (assets.length > 0 || hasRecoverableUpload) ? (
        <QuietFrame
          as="section"
          aria-labelledby="library-privacy-heading"
          className="mt-5 border-[var(--homa-highlight-ink)] bg-[var(--homa-highlight-tint)] px-4 py-4"
        >
          <h2 id="library-privacy-heading" className="font-semibold text-[var(--homa-ink)]">
            Before you choose files
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
            Each file has a public link that opens without signing in. Homa does not
            list the link, but anyone who gets it can open the file. This Library is
            for curriculum and other files without private family information.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <QuietAction
              onClick={continueToFilePicker}
            >
              Choose files
            </QuietAction>
            <QuietAction
              kind="secondary"
              onClick={() => setPrivacyPromptOpen(false)}
            >
              Go back
            </QuietAction>
          </div>
        </QuietFrame>
      ) : null}

      {uploads.length > 0 ? (
        <section aria-label="Uploads" className="mt-6">
          <details
            open={uploadsExpanded}
            onToggle={(event) => setUploadsExpanded(event.currentTarget.open)}
            className="quiet-frame quiet-frame--paper overflow-hidden"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--homa-ink)] marker:content-none">
              <span>
                {uploads.length} unfinished {uploads.length === 1 ? "upload" : "uploads"}
                <span className="ml-2 font-normal text-[color:color-mix(in_srgb,var(--homa-ink)_62%,var(--homa-canvas))]">
                  Everything already on your shelf is still available.
                </span>
              </span>
              <Icon
                name="collapse"
                size={20}
                className={`${uploadsExpanded ? "rotate-180" : ""} text-[color:color-mix(in_srgb,var(--homa-ink)_62%,var(--homa-canvas))]`}
              />
            </summary>
            <div className="space-y-2 border-t border-[var(--homa-control-boundary)] p-2">
              {uploads.map((item) => (
            <QuietFrame as="article" tone="mineral" key={item.id} className="px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 sm:flex-1">
                  <p className="break-words text-sm font-semibold text-[var(--homa-ink)]">
                    {item.name}
                  </p>
                  {uploadStatusMessage(item) ? (
                    <QuietStatus
                      tone={uploadStatusTone(item.state)}
                      className="mt-2 inline-flex px-2.5 py-1 text-xs font-semibold"
                    >
                      {uploadStatusMessage(item)}
                    </QuietStatus>
                  ) : null}
                </div>
                <div className="grid w-full grid-cols-1 gap-1 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end">
                  {canUpload && item.state === "paused" ? (
                    <QuietAction
                      kind="quiet"
                      onClick={() => beginResumeUpload(item.id)}
                      className="w-full px-3 text-sm sm:w-auto"
                    >
                      Choose same file to resume
                    </QuietAction>
                  ) : null}
                  {canUpload && item.state === "paused" && item.progress > 0 ? (
                    <QuietAction
                      kind="secondary"
                      onClick={() => void restartUpload(item)}
                      className="w-full px-3 text-sm sm:w-auto"
                    >
                      Restart upload
                    </QuietAction>
                  ) : null}
                  {item.state === "paused" ||
                  item.state === "remove_failed" ||
                  item.state === "added" ||
                  item.state === "failed" ? (
                    <QuietAction
                      kind="secondary"
                      onClick={() => void dismissUpload(item)}
                      className="w-full px-3 text-sm sm:w-auto"
                    >
                      {item.state === "paused"
                        ? "Remove upload"
                        : item.state === "remove_failed"
                          ? "Try removing again"
                        : "Dismiss"}
                    </QuietAction>
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
                  className="mt-3 h-1.5 overflow-hidden rounded-[var(--homa-radius-control)] bg-[var(--homa-control-boundary)]"
                >
                  <div
                    className="h-full rounded-[var(--homa-radius-control)] bg-[var(--homa-visual-coral)] transition-[width] duration-(--homa-motion-fast)"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
              {item.state === "paused" ? (
                <p className="mt-3 text-xs leading-5 text-[color:color-mix(in_srgb,var(--homa-ink)_62%,var(--homa-canvas))]">
                  {canUpload
                    ? "Restarting clears upload progress. Removing clears this unfinished upload from Homa. Neither changes the file on your device."
                    : "Removing clears this unfinished upload from Homa. The file on your device stays."}
                </p>
              ) : null}
              {item.state === "remove_failed" ? (
                <p className="mt-3 text-xs leading-5 text-[color:color-mix(in_srgb,var(--homa-ink)_62%,var(--homa-canvas))]">
                  The file on your device was not changed.
                </p>
              ) : null}
            </QuietFrame>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {canUpload && hasRecoverableUpload ? (
        <QuietAction
          kind="secondary"
          onClick={beginAddingResources}
          className="mt-4"
          icon={<Icon name="add" size={20} />}
        >
          Add another resource
        </QuietAction>
      ) : null}

      {pageError ? (
        <QuietStatus tone="error" className="mt-6 flex items-start gap-2 px-4 py-3 text-sm">
          <Icon name="error" size={20} className="mt-0.5 shrink-0" />
          {pageError}
        </QuietStatus>
      ) : null}

      {assets.length === 0 && !hasRecoverableUpload ? (
        <QuietFrame as="section" tone="paper" className="mt-8 px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--homa-radius-control)] bg-[var(--homa-highlight-tint)] text-[var(--homa-highlight-ink)]">
            <Icon name="add" size={24} />
          </div>
          {canUpload && privacyPromptOpen ? (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-[var(--homa-ink)]">
                Before you choose files
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
                Each file has a public link that opens without signing in. Homa does not
                list the link, but anyone who gets it can open the file. This Library is
                for curriculum and other files without private family information.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <QuietAction
                  onClick={continueToFilePicker}
                >
                  Choose files
                </QuietAction>
                <QuietAction
                  kind="secondary"
                  onClick={() => setPrivacyPromptOpen(false)}
                >
                  Go back
                </QuietAction>
              </div>
            </>
          ) : canUpload ? (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-[var(--homa-ink)]">
                Add your first resource
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
                Start with a worksheet, book, or curriculum. You can still sign in and
                download your files after you cancel your membership.
              </p>
              <QuietAction
                onClick={beginAddingResources}
                className="mt-6"
              >
                Add a resource
              </QuietAction>
            </>
          ) : (
            <>
              <h2 className="mt-4 font-display text-2xl font-semibold text-[var(--homa-ink)]">
                Nothing saved here yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
                Renew your membership when you are ready to add a resource.
              </p>
            </>
          )}
        </QuietFrame>
      ) : (
        <section className="mt-8">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--homa-ink)]">Your shelf</h2>
            <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_62%,var(--homa-canvas))]">
              {visibleAssets.length === assets.length
                ? `${assets.length} ${assets.length === 1 ? "resource" : "resources"}`
                : `${visibleAssets.length} of ${assets.length} resources`}
            </p>
          </div>

          <label className="quiet-search mt-4 block w-full max-w-xl" aria-label="Search your Library">
            <span className="sr-only">Search your Library</span>
            <input
              type="search"
              value={query}
              maxLength={180}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, child, or subject"
              className="quiet-search__input"
            />
          </label>

          <div
            role="group"
            className="mt-3 flex flex-wrap items-center gap-2"
            aria-label="Filter by resource type"
          >
            <button
              type="button"
              aria-pressed={resourceKind === null}
              onClick={() => setResourceKind(null)}
              className={resourceKind === null ? "quiet-filter quiet-filter--active" : "quiet-filter"}
            >
              All {assets.length}
            </button>
            {filterOptions.resourceKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={resourceKind === kind}
                onClick={() => setResourceKind(kind)}
                className={resourceKind === kind ? "quiet-filter quiet-filter--active" : "quiet-filter"}
              >
                {FAMILY_ASSET_RESOURCE_KIND_LABELS[kind]} {resourceKindCounts.get(kind) ?? 0}
              </button>
            ))}
            {hasAdvancedFilterOptions ? (
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="quiet-filter"
                aria-expanded={filtersOpen || advancedFilterCount > 0}
              >
                Filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
              </button>
            ) : null}
          </div>

          {hasAdvancedFilterOptions ? (
            <div
              className={`${filtersOpen || advancedFilterCount > 0 ? "grid" : "hidden"} quiet-frame quiet-frame--paper mt-3 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3`}
            >
              {filterOptions.children.length > 0 ? (
                <label className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                  For
                  <select
                    value={childId ?? ""}
                    onChange={(event) => setChildId(event.target.value || null)}
                    className="mt-1 min-h-11 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-2 text-sm font-normal text-[var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                  >
                    <option value="">All resources</option>
                    <option value={FAMILY_ASSET_WHOLE_FAMILY_CHILD}>Whole family</option>
                    {filterOptions.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {filterOptions.subjects.length > 0 ? (
                <label className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                  Subject
                  <select
                    value={subjectId ?? ""}
                    onChange={(event) => setSubjectId(event.target.value || null)}
                    className="mt-1 min-h-11 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-2 text-sm font-normal text-[var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                  >
                    <option value="">All subjects</option>
                    {filterOptions.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {showStatusFilter ? (
                <label className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                  Status
                  <select
                    value={status ?? ""}
                    onChange={(event) =>
                      setStatus(
                        (event.target.value || null) as FamilyAssetView["status"] | null,
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-2 text-sm font-normal text-[var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
                  >
                    <option value="">All statuses</option>
                    {filterOptions.statuses.map((itemStatus) => (
                      <option key={itemStatus} value={itemStatus}>
                        {FAMILY_ASSET_STATUS_LABELS[itemStatus]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {hasSearch ? (
            <QuietAction
              kind="quiet"
              onClick={clearFilters}
              className="mt-3 px-3 text-sm"
            >
              Clear search and filters
            </QuietAction>
          ) : null}

          {visibleAssets.length === 0 ? (
            <QuietFrame as="section" tone="paper" className="mt-5 border-dashed px-6 py-10 text-center">
              <p className="font-semibold text-[var(--homa-ink)]">Nothing on this shelf matches.</p>
              <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">Clear a filter or try another word.</p>
            </QuietFrame>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {visibleAssets.map((asset) => {
                const assetStatus = familyAssetStatusCopy(asset);
                const childNames = asset.children.slice(0, 2).map((child) => child.name);
                const audience =
                  childNames.length === 0
                    ? "Whole family"
                    : `${childNames.join(", ")}${asset.children.length > 2 ? `, +${asset.children.length - 2}` : ""}`;
                const subject = asset.subjects[0]?.label ?? null;
                const curriculumUnitCount =
                  initialCurriculumUnitsByParent[asset.id]?.filter(
                    (unit) => unit.isCurrent,
                  ).length ?? 0;
                return (
                  <article key={asset.id}>
                    <button
                      type="button"
                      onClick={() => openAsset(asset)}
                      aria-label={`Open ${asset.title}`}
                      className="quiet-artifact-card group"
                    >
                      <div className="quiet-artifact-card__preview">
                        <ShelfCover
                          title={asset.title}
                          publisher={asset.publisher}
                          subject={subject}
                          footer={
                            asset.resourceKind
                              ? FAMILY_ASSET_RESOURCE_KIND_LABELS[asset.resourceKind]
                              : FILE_KIND_COVER_LABELS[asset.fileKind]
                          }
                          imageUrl={asset.fileKind === "image" ? asset.url : null}
                          imageAlt={asset.title}
                        />
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-[0.82rem] font-semibold leading-snug text-[var(--homa-ink)] group-hover:text-[var(--homa-brand-text)]">
                        {asset.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-[color:color-mix(in_srgb,var(--homa-ink)_56%,var(--homa-canvas))]">
                        {audience}{subject ? ` · ${subject}` : ""}
                      </p>
                      {curriculumUnitCount > 0 ? (
                        <p className="mt-1 line-clamp-1 text-[0.7rem] font-semibold text-[var(--homa-brand-text)]">
                          {curriculumUnitCount} curriculum {curriculumUnitCount === 1 ? "unit" : "units"}
                        </p>
                      ) : null}
                      {asset.status !== "ready" ? (
                        <QuietStatus
                          tone={assetStatus.tone === "processing" ? "attention" : "error"}
                          className="mt-1 inline-flex px-2 py-1 text-[0.7rem] font-semibold"
                        >
                          {assetStatus.label}
                        </QuietStatus>
                      ) : null}
                    </button>
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
          curriculumUnits={selectedCurriculumUnits}
          highlightedUnitId={initialSelectedUnitId}
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
