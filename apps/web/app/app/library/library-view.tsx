"use client";

import { upload } from "@vercel/blob/client";
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
import { useMemo, useRef, useState } from "react";

import {
  formatFamilyAssetBytes,
  libraryUploadMediaType,
  MAX_LIBRARY_UPLOAD_BYTES,
  safeLibraryPathName,
  type FamilyAssetFileKind,
  type FamilyAssetView,
} from "../../../lib/library/family-assets";

interface UploadRow {
  id: string;
  name: string;
  progress: number;
  state: "uploading" | "added" | "failed";
  message: string | null;
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
  document: "Document",
  image: "Image",
  audio: "Audio",
  video: "Video",
  archive: "Archive",
  link: "Link",
  other: "File",
};

function fileKindLabel(asset: FamilyAssetView): string {
  if (asset.fileKind !== "archive") return FILE_KIND_LABELS[asset.fileKind];
  if (
    asset.mediaType === "application/epub+zip" ||
    asset.mediaType === "application/vnd.amazon.ebook" ||
    asset.mediaType === "application/x-mobipocket-ebook"
  ) {
    return "Ebook";
  }
  if (asset.mediaType === "application/zip") return "ZIP";
  return "Archive";
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

function uploadFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message === "unsupported-file") {
    return "Homa cannot save that file type yet. Try a PDF, photo, ebook, ZIP, Word, Excel, or PowerPoint file.";
  }
  return "That file did not save. Nothing was added. Try again.";
}

export function LibraryView({
  familyId,
  initialAssets,
}: {
  familyId: string;
  initialAssets: FamilyAssetView[];
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [query, setQuery] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyPromptOpen, setPrivacyPromptOpen] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(() => new Set());

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

  async function addFile(file: File) {
    const id = crypto.randomUUID();
    setUploads((current) => [
      ...current,
      { id, name: file.name || "Untitled file", progress: 0, state: "uploading", message: null },
    ]);
    if (file.size > MAX_LIBRARY_UPLOAD_BYTES) {
      updateUpload(id, {
        state: "failed",
        message: "That file is over 500 MB. Choose a smaller file.",
      });
      return;
    }

    try {
      const mediaType = libraryUploadMediaType(file.name, file.type);
      if (!mediaType) throw new Error("unsupported-file");
      const blob = await upload(
        `families/${familyId}/library/${safeLibraryPathName(file.name)}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/library/upload",
          clientPayload: JSON.stringify({ fileSize: file.size }),
          contentType: mediaType,
          multipart: true,
          onUploadProgress: ({ percentage }) => {
            updateUpload(id, { progress: Math.round(percentage) });
          },
        },
      );
      const response = await fetch("/api/library/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: blob.url, originalName: file.name }),
      });
      if (!response.ok) {
        if (response.status === 400) throw new Error("unsupported-file");
        throw new Error(`asset record failed: ${response.status}`);
      }
      const result = (await response.json()) as { ok: boolean; asset?: FamilyAssetView };
      if (!result.ok || !result.asset) throw new Error("asset record missing");
      setAssets((current) => [
        result.asset as FamilyAssetView,
        ...current.filter((asset) => asset.id !== result.asset?.id),
      ]);
      updateUpload(id, {
        state: "added",
        progress: 100,
        message: "Saved to your Library and ready to download.",
      });
    } catch (error) {
      updateUpload(id, { state: "failed", message: uploadFailureMessage(error) });
    }
  }

  function onFilesPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files.slice(0, 10)) void addFile(file);
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
        {assets.length > 0 ? (
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

      {privacyPromptOpen && assets.length > 0 ? (
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
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-strong">{item.name}</p>
                  <p className={item.state === "failed" ? "mt-1 text-sm text-danger" : "mt-1 text-sm text-muted"}>
                    {item.state === "uploading"
                      ? `Uploading ${item.progress}%`
                      : item.message}
                  </p>
                </div>
                {item.state !== "uploading" ? (
                  <button
                    type="button"
                    onClick={() => setUploads((current) => current.filter((row) => row.id !== item.id))}
                    className="text-sm font-semibold text-muted hover:text-strong"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
              {item.state === "uploading" ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-page">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-(--dur-fast)"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {pageError ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-danger">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {pageError}
        </div>
      ) : null}

      {assets.length === 0 ? (
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
