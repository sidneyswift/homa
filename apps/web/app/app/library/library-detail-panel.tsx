"use client";

import {
  AlertCircle,
  Download,
  FileText,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";

import { SidePanel } from "../../../components/chassis/side-panel";
import {
  FAMILY_ASSET_DELETE_CONSEQUENCE,
  FAMILY_ASSET_RESOURCE_KIND_LABELS,
  familyAssetSourceLabel,
  familyAssetStatusCopy,
  stableFamilyAssetDate,
} from "../../../lib/library/family-asset-shelf";
import {
  type FamilyAssetFileKind,
  FAMILY_ASSET_RESOURCE_KINDS,
  familyAssetProcessingRetryAvailable,
  formatFamilyAssetBytes,
  type FamilyAssetResourceKind,
  type FamilyAssetView,
} from "../../../lib/library/family-assets";

const FILE_KIND_LABELS: Record<FamilyAssetFileKind, string> = {
  document: "Document",
  image: "Image",
  audio: "Audio",
  video: "Video",
  archive: "Archive",
  link: "Saved link",
  other: "Other file",
};

function fileKindLabel(asset: FamilyAssetView): string {
  if (
    asset.mediaType === "application/epub+zip" ||
    asset.mediaType === "application/vnd.amazon.ebook" ||
    asset.mediaType === "application/x-mobipocket-ebook"
  ) {
    return "Ebook";
  }
  if (asset.mediaType === "application/zip") return "ZIP archive";
  return FILE_KIND_LABELS[asset.fileKind];
}

export interface LibraryChildOption {
  id: string;
  name: string;
}

export interface LibrarySubjectOption {
  id: string;
  label: string;
}

interface AssetUpdateResponse {
  ok: boolean;
  reason?: string;
  asset?: FamilyAssetView;
}

function statusClasses(tone: ReturnType<typeof familyAssetStatusCopy>["tone"]): string {
  if (tone === "ready") return "border-sage/30 bg-[var(--accent-sage-soft)]";
  if (tone === "processing") return "border-[var(--gold-300)] bg-[var(--warning-soft)]";
  return "border-[var(--danger)] bg-[var(--danger-soft)]";
}

async function readAssetUpdate(response: Response): Promise<FamilyAssetView> {
  const body = (await response.json()) as AssetUpdateResponse;
  if (!response.ok || !body.ok || !body.asset) {
    throw new Error(body.reason ?? "update-failed");
  }
  return body.asset;
}

export function LibraryDetailPanel({
  asset,
  childOptions,
  subjectOptions,
  onClose,
  onUpdated,
  onDeleted,
}: {
  asset: FamilyAssetView;
  childOptions: LibraryChildOption[];
  subjectOptions: LibrarySubjectOption[];
  onClose: () => void;
  onUpdated: (asset: FamilyAssetView) => void;
  onDeleted: (assetId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(asset.title);
  const [resourceKind, setResourceKind] = useState<FamilyAssetResourceKind | "">(
    asset.resourceKind ?? "",
  );
  const [childIds, setChildIds] = useState(
    () => new Set(asset.children.map((child) => child.id)),
  );
  const [subjectIds, setSubjectIds] = useState(
    () => new Set(
      asset.subjects
        .map((subject) => subject.id)
        .filter((id) => subjectOptions.some((option) => option.id === id)),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = familyAssetStatusCopy(asset);
  const canRetryProcessing = familyAssetProcessingRetryAvailable(asset);
  const headingId = `library-asset-${asset.id}`;

  function toggle(setter: (next: Set<string>) => void, current: Set<string>, id: string) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function resetDraft() {
    setTitle(asset.title);
    setResourceKind(asset.resourceKind ?? "");
    setChildIds(new Set(asset.children.map((child) => child.id)));
    setSubjectIds(
      new Set(
        asset.subjects
          .map((subject) => subject.id)
          .filter((id) => subjectOptions.some((option) => option.id === id)),
      ),
    );
  }

  function beginEditing() {
    resetDraft();
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!title.trim()) {
      setError("Give this resource a title before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await readAssetUpdate(
        await fetch("/api/library/assets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: asset.id,
            title,
            resourceKind: resourceKind || null,
            childIds: [...childIds],
            subjectIds: [...subjectIds],
          }),
        }),
      );
      onUpdated(updated);
      setTitle(updated.title);
      setResourceKind(updated.resourceKind ?? "");
      setEditing(false);
    } catch {
      setError("Those changes did not save. Your earlier details are still here.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/library/assets?id=${encodeURIComponent(asset.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete-failed");
      onDeleted(asset.id);
    } catch {
      setError("The saved original is still in your Library. Try removing it again.");
      setConfirmingRemoval(false);
    } finally {
      setRemoving(false);
    }
  }

  async function retryProcessing() {
    setRetrying(true);
    setError(null);
    try {
      const updated = await readAssetUpdate(
        await fetch(
          `/api/library/assets/${encodeURIComponent(asset.id)}/process`,
          { method: "POST" },
        ),
      );
      onUpdated(updated);
    } catch {
      setError(
        "Homa could not start organizing again. Your original is saved and ready to download. Try again.",
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <SidePanel labelledBy={headingId} onClose={onClose} initialFocusRef={closeRef}>
      <header className="flex items-start gap-3 border-b border-border-subtle px-5 pb-4 pt-3 lg:pt-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <FileText size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {editing ? "Edit Library resource" : "Library resource"}
          </p>
          <h2
            id={headingId}
            className="mt-0.5 break-words font-display text-xl font-semibold text-strong"
          >
            {asset.title}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close resource details"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-page hover:text-strong"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <section className={`rounded-md border p-4 ${statusClasses(status.tone)}`}>
          <p className="text-sm font-bold text-strong">{status.label}</p>
          <p className="mt-1 text-sm leading-6 text-body">{status.detail}</p>
          {canRetryProcessing ? (
            <button
              type="button"
              disabled={retrying}
              onClick={() => void retryProcessing()}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-brand hover:bg-card disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {retrying ? "Starting…" : "Try organizing again"}
            </button>
          ) : null}
          {asset.status === "failed" && asset.processingErrorCode !== "blob_delete_failed" ? (
            <p className="mt-2 text-xs leading-5 text-muted">
              Use Edit details to add or change the title, resource type, children, and
              subjects.
            </p>
          ) : null}
        </section>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-3 text-sm text-danger">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        {editing ? (
          <section aria-label="Edit resource details" className="mt-5 space-y-5">
            <h3 className="font-display text-lg font-semibold text-strong">
              Edit details
            </h3>
            <label className="block text-sm font-semibold text-strong">
              Title
              <input
                value={title}
                maxLength={180}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
              />
            </label>
            <label className="block text-sm font-semibold text-strong">
              Resource type
              <select
                value={resourceKind}
                onChange={(event) =>
                  setResourceKind(event.target.value as FamilyAssetResourceKind | "")
                }
                className="mt-2 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
              >
                <option value="">Not set</option>
                {FAMILY_ASSET_RESOURCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {FAMILY_ASSET_RESOURCE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-strong">For</legend>
              <p className="mt-1 text-xs leading-5 text-muted">
                Leaving all children unchecked saves this as Whole family.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {childOptions.map((child) => (
                  <label
                    key={child.id}
                    className="flex min-h-11 items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-body"
                  >
                    <input
                      type="checkbox"
                      checked={childIds.has(child.id)}
                      onChange={() => toggle(setChildIds, childIds, child.id)}
                      className="h-4 w-4 accent-[var(--clay-600)]"
                    />
                    {child.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-strong">Subjects</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {subjectOptions.map((subject) => (
                  <label
                    key={subject.id}
                    className="flex min-h-11 items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-body"
                  >
                    <input
                      type="checkbox"
                      checked={subjectIds.has(subject.id)}
                      onChange={() => toggle(setSubjectIds, subjectIds, subject.id)}
                      className="h-4 w-4 accent-[var(--clay-600)]"
                    />
                    {subject.label}
                  </label>
                ))}
              </div>
            </fieldset>

          </section>
        ) : (
          <>
            <section className="mt-5">
              <h3 className="font-display text-lg font-semibold text-strong">Details</h3>
              <dl className="mt-3 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted">Source</dt>
                <dd className="text-right text-strong">{familyAssetSourceLabel(asset)}</dd>
                <dt className="text-muted">Original file</dt>
                <dd className="break-all text-right text-strong">{asset.originalName}</dd>
                <dt className="text-muted">Size</dt>
                <dd className="text-right text-strong">{formatFamilyAssetBytes(asset.byteSize)}</dd>
                <dt className="text-muted">File type</dt>
                <dd className="text-right text-strong">{fileKindLabel(asset)}</dd>
                <dt className="text-muted">Added</dt>
                <dd className="text-right text-strong">{stableFamilyAssetDate(asset.createdAt)}</dd>
                <dt className="text-muted">Resource type</dt>
                <dd className="text-right text-strong">
                  {asset.resourceKind
                    ? FAMILY_ASSET_RESOURCE_KIND_LABELS[asset.resourceKind]
                    : "Not set"}
                </dd>
                {asset.authors.length > 0 ? (
                  <>
                    <dt className="text-muted">Author</dt>
                    <dd className="text-right text-strong">{asset.authors.join(", ")}</dd>
                  </>
                ) : null}
                {asset.publisher ? (
                  <>
                    <dt className="text-muted">Publisher</dt>
                    <dd className="text-right text-strong">{asset.publisher}</dd>
                  </>
                ) : null}
                <dt className="text-muted">For</dt>
                <dd className="text-right text-strong">
                  {asset.children.length > 0
                    ? asset.children.map((child) => child.name).join(", ")
                    : "Whole family"}
                </dd>
                <dt className="text-muted">Subjects</dt>
                <dd className="text-right text-strong">
                  {asset.subjects.length > 0
                    ? asset.subjects.map((subject) => subject.label).join(", ")
                    : "Not set"}
                </dd>
              </dl>
            </section>

            <section className="mt-8 border-t border-border-subtle pt-5">
              {confirmingRemoval ? (
                <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-4">
                  <h3 className="font-semibold text-strong">Remove this original?</h3>
                  <p className="mt-2 text-sm leading-6 text-body">
                    {FAMILY_ASSET_DELETE_CONSEQUENCE}
                  </p>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmingRemoval(false)}
                      className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold text-muted hover:bg-card hover:text-strong"
                    >
                      Keep original
                    </button>
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => void remove()}
                      className="min-h-11 rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      {removing ? "Removing…" : "Remove original"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRemoval(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-danger hover:bg-[var(--danger-soft)]"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {asset.processingErrorCode === "blob_delete_failed"
                    ? "Try removal again"
                    : "Remove from Library"}
                </button>
              )}
            </section>
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-border-subtle bg-card px-5 py-3">
        {editing ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setEditing(false);
                setError(null);
              }}
              className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold text-muted hover:bg-page hover:text-strong"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="min-h-11 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`/api/library/assets/${encodeURIComponent(asset.id)}/download?surface=detail`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)]"
            >
              <Download size={17} aria-hidden="true" />
              Download
            </a>
            <button
              type="button"
              onClick={beginEditing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
            >
              <Pencil size={15} aria-hidden="true" />
              Edit details
            </button>
          </div>
        )}
      </footer>
    </SidePanel>
  );
}
