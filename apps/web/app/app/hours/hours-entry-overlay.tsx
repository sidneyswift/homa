"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { HOURS_SUBJECTS } from "../../../lib/hours-model";
import { SUBJECT_LABELS, subjectDisplayLabel, type HoursEntry } from "../../../lib/hours-view";
import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import {
  deleteHoursEntryAction,
  updateHoursEntryAction,
  type HoursActionState,
} from "./actions";

/**
 * The recorded-time dialog: edit subject, minutes, and note, or delete the
 * entry. Focus-trap and Escape behavior mirror the house pattern for
 * centered dialogs (the Binder's MaterialDetailOverlay, the Tasks
 * editor), rather than inventing a new one.
 */

const INITIAL_STATE: HoursActionState = { error: null };

const SOURCE_EXPLANATIONS = {
  chat: "Added after you mentioned it in Chat.",
  sms: "Added after you mentioned it by text.",
  call: "Added after you mentioned it on a phone call.",
} as const;

function DeleteEntryButton({ entry, onDone }: { entry: HoursEntry; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="quiet-action quiet-action--quiet min-h-9 px-0 text-xs"
        >
          Delete this entry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          {`Delete this ${entry.minutes}-minute ${subjectDisplayLabel(entry).toLowerCase()} entry? This can't be undone.`}
        </p>
        <div className="flex shrink-0 gap-2">
          <QuietAction
            kind="secondary"
            size="default"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await deleteHoursEntryAction(entry.id);
                if (result.error === null) {
                  onDone();
                  router.refresh();
                } else {
                  setError(result.error);
                }
              });
            }}
            className="px-3.5 text-xs text-[color:var(--homa-error-ink)]"
          >
            {pending ? "Deleting\u2026" : "Delete"}
          </QuietAction>
          <QuietAction
            kind="quiet"
            size="default"
            onClick={() => setConfirming(false)}
            className="px-3.5 text-xs"
          >
            Keep
          </QuietAction>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-[color:var(--homa-error-ink)]">{error}</p> : null}
    </div>
  );
}

export function HoursEntryOverlay({
  entry,
  onClose,
}: {
  entry: HoursEntry;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [subject, setSubject] = useState(entry.subject);

  const [state, formAction, pending] = useActionState(
    async (prev: HoursActionState, formData: FormData) => {
      const result = await updateHoursEntryAction(entry.id, prev, formData);
      if (result.error === null) {
        onClose();
        router.refresh();
      }
      return result;
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    function focusableElements(): HTMLElement[] {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!active || !dialogRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hours-entry-title"
      className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="quiet-artifact-dialog quiet-frame quiet-frame--paper"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="hours-entry-title" className="font-display text-xl font-semibold text-[color:var(--homa-ink)]">
            Edit recorded time
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="quiet-action quiet-action--quiet min-h-10 min-w-10 px-2 text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          {entry.childName ? `For ${entry.childName}.` : "For the whole family."}
        </p>
        <p className="mt-0.5 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
          {SOURCE_EXPLANATIONS[entry.source]}
        </p>

        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[color:var(--homa-ink)]">
            Subject
            <select
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value as typeof subject)}
              className="min-h-11 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
            >
              {HOURS_SUBJECTS.map((option) => (
                <option key={option} value={option}>
                  {SUBJECT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[color:var(--homa-ink)]">
            Your own category (optional)
            <input
              type="text"
              name="customLabel"
              maxLength={40}
              defaultValue={entry.customLabel ?? ""}
              placeholder="Literature journal, karate, whatever you call it"
              className="min-h-11 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[color:var(--homa-ink)]">
            Minutes
            <input
              type="number"
              name="minutes"
              min={1}
              max={600}
              step={1}
              defaultValue={entry.minutes}
              className="min-h-11 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[color:var(--homa-ink)]">
            Note
            <textarea
              name="note"
              maxLength={200}
              defaultValue={entry.note ?? ""}
              rows={3}
              placeholder="Optional, for your own record"
              className="rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)] outline-none focus:border-[var(--homa-midnight-action)]"
            />
          </label>
          {state.error ? <p className="text-sm text-[color:var(--homa-error-ink)]">{state.error}</p> : null}
          <div className="mt-1 flex justify-end gap-2">
            <QuietAction
              kind="quiet"
              size="default"
              onClick={onClose}
              className="px-4 text-sm"
            >
              Cancel
            </QuietAction>
            <QuietAction
              kind="primary"
              size="default"
              type="submit"
              disabled={pending}
              className="px-5 text-sm"
            >
              {pending ? "Saving\u2026" : "Save changes"}
            </QuietAction>
          </div>
        </form>

        <DeleteEntryButton entry={entry} onDone={onClose} />
      </div>
    </div>
  );
}
