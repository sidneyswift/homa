"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { HOURS_SUBJECTS } from "../../../lib/hours-model";
import { SUBJECT_LABELS, type HoursEntry } from "../../../lib/hours-view";
import {
  deleteHoursEntryAction,
  updateHoursEntryAction,
  type HoursActionState,
} from "./actions";

/**
 * The hours entry dialog: edit subject, minutes, and note, or delete the
 * block. Focus-trap and Escape behavior mirror the house pattern for
 * centered dialogs (the Binder's MaterialDetailOverlay, the Tasks
 * editor), rather than inventing a new one.
 */

const INITIAL_STATE: HoursActionState = { error: null };

function DeleteEntryButton({ entry, onDone }: { entry: HoursEntry; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <div className="mt-4 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-semibold text-muted hover:underline"
        >
          Delete this entry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border-subtle pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">
          {`Delete this ${entry.minutes}-minute ${SUBJECT_LABELS[entry.subject].toLowerCase()} block? This can't be undone.`}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
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
            className="rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            {pending ? "Deleting\u2026" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-pill px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:text-body"
          >
            Keep
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-muted">{error}</p> : null}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,42,33,0.42)] p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-[var(--shadow-xl)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="hours-entry-title" className="font-display text-xl font-semibold text-strong">
            Edit this block
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted">
          {entry.childName ? `Logged for ${entry.childName}.` : "Logged for the whole family."}
        </p>

        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-strong">
            Subject
            <select
              name="subject"
              defaultValue={entry.subject}
              className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-normal text-body outline-none focus:border-brand"
            >
              {HOURS_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {SUBJECT_LABELS[subject]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-strong">
            Minutes
            <input
              type="number"
              name="minutes"
              min={1}
              max={600}
              step={1}
              defaultValue={entry.minutes}
              className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-normal text-body outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-strong">
            Note
            <textarea
              name="note"
              maxLength={200}
              defaultValue={entry.note ?? ""}
              rows={3}
              placeholder="Optional, for your own record"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-normal text-body outline-none focus:border-brand"
            />
          </label>
          {state.error ? <p className="text-sm text-muted">{state.error}</p> : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-pill px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-body"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {pending ? "Saving\u2026" : "Save changes"}
            </button>
          </div>
        </form>

        <DeleteEntryButton entry={entry} onDone={onClose} />
      </div>
    </div>
  );
}
