"use client";

import {
  AlertCircle,
  Download,
  FileText,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

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
  FAMILY_CURRICULUM_UNIT_REVIEW_LABELS,
  FAMILY_ASSET_RESOURCE_KINDS,
  familyAssetProcessingRetryAvailable,
  formatFamilyAssetBytes,
  type FamilyAssetResourceKind,
  type FamilyAssetView,
  type FamilyCurriculumUnitView,
} from "../../../lib/library/family-assets";
import { familyAssetLibraryHref } from "../../../lib/library/family-asset-reference";

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

function hasSameIds(current: Set<string>, saved: readonly string[]): boolean {
  return current.size === saved.length && saved.every((id) => current.has(id));
}

function editableSubjectIds(
  asset: FamilyAssetView,
  subjectOptions: readonly LibrarySubjectOption[],
): string[] {
  return asset.subjects
    .map((subject) => subject.id)
    .filter((id) => subjectOptions.some((option) => option.id === id));
}

interface LibraryDetailsDraft {
  title: string;
  resourceKind: FamilyAssetResourceKind | "";
  childIds: Set<string>;
  subjectIds: Set<string>;
}

function libraryDetailsDraft(
  asset: FamilyAssetView,
  subjectOptions: readonly LibrarySubjectOption[],
): LibraryDetailsDraft {
  return {
    title: asset.title,
    resourceKind: asset.resourceKind ?? "",
    childIds: new Set(asset.children.map((child) => child.id)),
    subjectIds: new Set(editableSubjectIds(asset, subjectOptions)),
  };
}

function draftDiffersFromAsset(
  draft: LibraryDetailsDraft,
  asset: FamilyAssetView,
  subjectOptions: readonly LibrarySubjectOption[],
): boolean {
  return (
    draft.title.trim() !== asset.title ||
    draft.resourceKind !== (asset.resourceKind ?? "") ||
    !hasSameIds(
      draft.childIds,
      asset.children.map((child) => child.id),
    ) ||
    !hasSameIds(draft.subjectIds, editableSubjectIds(asset, subjectOptions))
  );
}

export function LibraryDetailPanel({
  asset,
  curriculumUnits = [],
  highlightedUnitId,
  childOptions,
  subjectOptions,
  onClose,
  onUpdated,
  onDeleted,
}: {
  asset: FamilyAssetView;
  curriculumUnits?: FamilyCurriculumUnitView[];
  highlightedUnitId?: string | null;
  childOptions: LibraryChildOption[];
  subjectOptions: LibrarySubjectOption[];
  onClose: () => void;
  onUpdated: (asset: FamilyAssetView) => void;
  onDeleted: (assetId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const highlightedUnitRef = useRef<HTMLLIElement>(null);
  const [draft, setDraft] = useState<LibraryDetailsDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = familyAssetStatusCopy(asset);
  const canRetryProcessing = familyAssetProcessingRetryAvailable(asset);
  const headingId = `library-asset-${asset.id}`;
  const detailsFormId = `library-asset-details-${asset.id}`;
  const currentCurriculumUnitCount = curriculumUnits.filter(
    (unit) => unit.isCurrent,
  ).length;
  const currentDraft = draft ?? libraryDetailsDraft(asset, subjectOptions);
  const { title, resourceKind, childIds, subjectIds } = currentDraft;
  const hasChanges =
    draft !== null && draftDiffersFromAsset(draft, asset, subjectOptions);
  const displayedStatus = hasChanges
    ? {
        label: "Changes not saved",
        detail: "Your original is safe. Save changes when these details look right.",
        tone: "processing" as const,
      }
    : status;

  useEffect(() => {
    if (!highlightedUnitId || !highlightedUnitRef.current) return;
    highlightedUnitRef.current.scrollIntoView({ block: "center" });
  }, [highlightedUnitId]);

  function updateDraft(
    update: (current: LibraryDetailsDraft) => LibraryDetailsDraft,
  ) {
    setDraft((current) => {
      const next = update(current ?? libraryDetailsDraft(asset, subjectOptions));
      return draftDiffersFromAsset(next, asset, subjectOptions) ? next : null;
    });
  }

  function toggle(field: "childIds" | "subjectIds", id: string) {
    updateDraft((current) => {
      const nextIds = new Set(current[field]);
      if (nextIds.has(id)) nextIds.delete(id);
      else nextIds.add(id);
      return { ...current, [field]: nextIds };
    });
    setError(null);
  }

  function resetDraft() {
    setDraft(null);
  }

  async function save() {
    if (!hasChanges || saving) return;
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
            title: title.trim(),
            resourceKind: resourceKind || null,
            childIds: [...childIds],
            subjectIds: [...subjectIds],
          }),
        }),
      );
      onUpdated(updated);
      setDraft(null);
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
            Library resource
          </p>
          <h2
            id={headingId}
            className="mt-0.5 break-words font-display text-xl font-semibold text-strong"
          >
            {title.trim() || "Untitled resource"}
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
        <section
          className={`rounded-md border p-4 ${statusClasses(displayedStatus.tone)}`}
        >
          <p className="text-sm font-bold text-strong">{displayedStatus.label}</p>
          <p className="mt-1 text-sm leading-6 text-body">{displayedStatus.detail}</p>
          {!hasChanges && canRetryProcessing ? (
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
          {!hasChanges &&
          asset.status === "failed" &&
          asset.processingErrorCode !== "blob_delete_failed" ? (
            <p className="mt-2 text-xs leading-5 text-muted">
              You can add or correct the details below.
            </p>
          ) : null}
        </section>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-3 text-sm text-danger">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        <form
          id={detailsFormId}
          aria-label="Resource details"
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3 className="font-display text-lg font-semibold text-strong">Details</h3>
          <label className="block text-sm font-semibold text-strong">
            Title
            <input
              name="title"
              value={title}
              maxLength={180}
              onChange={(event) => {
                const nextTitle = event.target.value;
                updateDraft((current) => ({ ...current, title: nextTitle }));
                setError(null);
              }}
              className="mt-2 min-h-11 w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm font-normal text-strong outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm font-semibold text-strong">
            Resource type
            <select
              name="resourceKind"
              value={resourceKind}
              onChange={(event) => {
                const nextResourceKind = event.target.value as
                  | FamilyAssetResourceKind
                  | "";
                updateDraft((current) => ({
                  ...current,
                  resourceKind: nextResourceKind,
                }));
                setError(null);
              }}
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
            <div className="mt-2 grid grid-cols-2 gap-2">
              {childOptions.map((child) => (
                <label
                  key={child.id}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-body"
                >
                  <input
                    name="childIds"
                    value={child.id}
                    type="checkbox"
                    checked={childIds.has(child.id)}
                    onChange={() => toggle("childIds", child.id)}
                    className="h-4 w-4 accent-[var(--clay-600)]"
                  />
                  {child.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-strong">Subjects</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {subjectOptions.map((subject) => (
                <label
                  key={subject.id}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-body"
                >
                  <input
                    name="subjectIds"
                    value={subject.id}
                    type="checkbox"
                    checked={subjectIds.has(subject.id)}
                    onChange={() => toggle("subjectIds", subject.id)}
                    className="h-4 w-4 accent-[var(--clay-600)]"
                  />
                  {subject.label}
                </label>
              ))}
            </div>
          </fieldset>
        </form>

            <section className="mt-8 border-t border-border-subtle pt-5">
              <h3 className="font-display text-lg font-semibold text-strong">File details</h3>
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
              </dl>
            </section>

            {curriculumUnits.length > 0 ? (
              <section className="mt-8 border-t border-border-subtle pt-5">
                <h3 className="font-display text-lg font-semibold text-strong">
                  Curriculum units
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Homa saved {currentCurriculumUnitCount} approved {currentCurriculumUnitCount === 1 ? "unit" : "units"} from this curriculum. Each one shows where it came from in the file.
                </p>
                <ol className="mt-3 space-y-2">
                  {curriculumUnits.map((unit) => {
                    const highlighted = unit.id === highlightedUnitId;
                    return (
                      <li
                        key={unit.id}
                        ref={highlighted ? highlightedUnitRef : undefined}
                        id={`library-unit-${unit.id}`}
                        className={`rounded-md border p-3 ${
                          highlighted
                            ? "border-brand bg-brand-soft"
                            : "border-border-subtle bg-page"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <a
                            href={familyAssetLibraryHref(unit.id)}
                            className="font-semibold text-strong hover:text-brand"
                          >
                            {unit.unitLabel}
                          </a>
                          <span className="text-xs text-muted">{unit.sourceLocator}</span>
                        </div>
                        {!unit.isCurrent ? (
                          <p className="mt-1 text-xs font-semibold text-muted">
                            Earlier approved unit
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm leading-6 text-body">{unit.summary}</p>
                        <p className="mt-1 text-xs text-muted">
                          {unit.subjects.length > 0
                            ? unit.subjects.map((subject) => subject.label).join(" · ")
                            : "Subject not set"}
                          {` · ${FAMILY_CURRICULUM_UNIT_REVIEW_LABELS[unit.confidence]}`}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}

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
      </div>

      <footer className="shrink-0 border-t border-border-subtle bg-card px-5 py-3">
        {hasChanges ? (
          <p className="mb-2 text-xs font-semibold text-muted" aria-live="polite">
            Unsaved changes
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {hasChanges ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                resetDraft();
                setError(null);
              }}
              className="min-h-11 rounded-md border border-border-subtle px-3 py-2 text-sm font-bold text-strong hover:bg-page disabled:cursor-wait disabled:opacity-60"
            >
              Cancel changes
            </button>
          ) : (
            <a
              href={`/api/library/assets/${encodeURIComponent(asset.id)}/download?surface=detail`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)]"
            >
              <Download size={17} aria-hidden="true" />
              Download
            </a>
          )}
          <button
            type="submit"
            form={detailsFormId}
            disabled={!hasChanges || saving}
            className="min-h-11 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-[var(--clay-700)] disabled:cursor-not-allowed disabled:bg-[var(--stone-200)] disabled:text-muted"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </footer>
    </SidePanel>
  );
}
