"use client";

import { useState, useTransition } from "react";

import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { KIND_LABELS, type BinderMaterial } from "../../../lib/materials/binder";
import { deleteMaterialAction } from "./delete-material-action";
import { keepMaterialAction } from "./keep-material-action";

/**
 * Materials she started and never kept (gh#197, gh#175, gh#241).
 *
 * Fleet-wide, 59% of revision chains never reach final (gh#348), and
 * until now every one of them was invisible: the binder shows finals
 * only and the chat session rotates daily. A parent who liked a
 * worksheet, printed it, and moved on had no way back to it, and the
 * ones she was mid-revision on simply vanished overnight.
 *
 * Voice: this is not a chore list and not a red "unfinished" badge.
 * Nothing here is wrong; she just has not said which one to keep. One
 * card per chain, newest first, and keeping one is a single tap.
 */
export function InProgressShelf({ materials, scopeChildName = null }: {
  materials: BinderMaterial[];
  scopeChildName?: string | null;
}) {
  const [kept, setKept] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; note: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const remaining = materials.filter((material) => !kept[material.id] && !removed[material.id]);
  if (remaining.length === 0) return null;

  function keep(material: BinderMaterial) {
    setPendingId(material.id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await keepMaterialAction(material.id);
        if (result.kept) {
          setKept((current) => ({ ...current, [material.id]: result.note }));
        } else {
          setError({ id: material.id, note: result.note });
        }
      } catch {
        setError({ id: material.id, note: "That did not save. Try again in a moment." });
      } finally {
        setPendingId(null);
      }
    });
  }

  function remove(material: BinderMaterial) {
    setPendingId(material.id);
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteMaterialAction(material.id);
        if (result.deleted) {
          setRemoved((current) => ({ ...current, [material.id]: true }));
          setConfirmingDeleteId(null);
        } else {
          setError({ id: material.id, note: result.note });
        }
      } catch {
        setError({ id: material.id, note: "That did not delete. Try again in a moment." });
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <QuietFrame as="section" tone="paper" className="mb-8 p-5" aria-labelledby="in-progress-heading">
      <h2
        id="in-progress-heading"
        className="font-display text-xl font-semibold text-[color:var(--homa-ink)]"
      >
        Still in progress
      </h2>
      <p className="mt-1 text-xs font-semibold text-[var(--homa-ink)]">
        {scopeChildName ? `For ${scopeChildName}, plus shared family materials` : "For the whole family"}
      </p>
      <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
        {remaining.length === 1
          ? "One thing we made together that is not in your binder yet."
          : `${remaining.length} things we made together that are not in your binder yet.`}{" "}
        Keep the ones you want to come back to.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {remaining.map((material) => (
          <li key={material.id} className="min-w-0" aria-busy={isPending && pendingId === material.id}>
            <span className="quiet-artifact-card__preview block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={material.previewUrl}
                alt={`Preview of ${material.title}`}
                className="block aspect-[8.5/11] w-full object-contain"
                loading="lazy"
              />
            </span>
            <span className="mt-2 block break-words font-semibold text-[color:var(--homa-ink)]">
              {material.title}
            </span>
            <span className="mt-0.5 block break-words text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
              {KIND_LABELS[material.kind] ?? material.kind}
              {material.childName ? ` for ${material.childName}` : null}
            </span>
            {confirmingDeleteId === material.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="w-full text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                  Delete this from the shelf?
                </span>
                <QuietAction
                  kind="secondary"
                  onClick={() => remove(material)}
                  disabled={isPending}
                  className="text-xs"
                >
                  {isPending && pendingId === material.id ? "Deleting…" : "Delete"}
                </QuietAction>
                <QuietAction
                  kind="quiet"
                  onClick={() => setConfirmingDeleteId(null)}
                  disabled={isPending}
                  className="text-xs"
                >
                  Cancel
                </QuietAction>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <QuietAction
                  kind="secondary"
                  onClick={() => keep(material)}
                  disabled={isPending}
                  className="text-xs"
                >
                  {isPending && pendingId === material.id ? "Keeping..." : "Keep this one"}
                </QuietAction>
                <a
                  href={`/api/materials/${material.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="quiet-action quiet-action--quiet text-xs underline underline-offset-2"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(material.id)}
                  disabled={isPending}
                  className="quiet-action quiet-action--quiet text-xs"
                >
                  Delete
                </button>
              </div>
            )}
            {error?.id === material.id ? (
              <p role="alert" className="mt-2 break-words text-sm text-[color:var(--homa-error-ink)]">
                {error.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </QuietFrame>
  );
}
