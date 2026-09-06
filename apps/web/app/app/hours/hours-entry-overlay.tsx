"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { HOURS_SUBJECTS } from "../../../lib/hours-model";
import { recordedTimeAudience, type HoursEditContext } from "../../../lib/hours-edit";
import { SUBJECT_LABELS, type HoursEntry } from "../../../lib/hours-view";
import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { deleteHoursEntryAction, getHoursEntryEditContextAction, updateHoursEntryAction } from "./actions";

const SOURCE_EXPLANATIONS: Record<string, string> = {
  sms: "Added after you mentioned it by text.",
  call: "Added after you mentioned it on a phone call.",
  email: "Added after you mentioned it by email.",
  dispatch: "Added by Homa during a scheduled check-in.",
};

const FIELD_CLASS = "min-h-11 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm font-normal text-[color:var(--homa-ink)]";

export function HoursEntryForm({ context, pending, onSave, onClose }: {
  context: HoursEditContext;
  pending: "save" | "delete" | null;
  onSave: (formData: FormData) => void;
  onClose: () => void;
}) {
  const { entry } = context;
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} className="mt-4">
      <fieldset disabled={pending !== null} className="flex min-w-0 flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Subject
          <select name="subject" defaultValue={entry.subject} className={FIELD_CLASS}>
            {HOURS_SUBJECTS.map((subject) => <option key={subject} value={subject}>{SUBJECT_LABELS[subject]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Minutes
          <input name="minutes" type="number" inputMode="numeric" min={1} max={600} step={1} required defaultValue={entry.minutes} className={FIELD_CLASS} />
        </label>
        {context.activity && context.activity.children.length > 1 ? (
          <p className="text-sm">Time and subject change for {recordedTimeAudience(context)}. The category and note below stay with {entry.childName}&apos;s record.</p>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Your own category (optional)
          <input name="customLabel" defaultValue={entry.customLabel ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Note
          <textarea name="note" defaultValue={entry.note ?? ""} rows={4} className={FIELD_CLASS} />
        </label>
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <QuietAction kind="quiet" onClick={onClose} disabled={pending !== null}>Cancel</QuietAction>
          <QuietAction kind="primary" type="submit" disabled={pending !== null}>{pending === "save" ? "Saving…" : "Save changes"}</QuietAction>
        </div>
      </fieldset>
    </form>
  );
}

/** One editor is used from Day, Week and Hours. Context always comes from the
 * authenticated junction lookup, including when Hours loads no Planner rows. */
export function HoursEntryOverlay({ entry, onClose }: { entry: HoursEntry; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const deleteAreaRef = useRef<HTMLDivElement>(null);
  const wasConfirming = useRef(false);
  const closeHandler = useRef(onClose);
  const busy = useRef(false);
  const deleted = useRef(false);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [context, setContext] = useState<HoursEditContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { closeHandler.current = onClose; }, [onClose]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (confirming || wasConfirming.current) deleteAreaRef.current?.querySelector<HTMLButtonElement>(confirming ? "button:last-child" : "button")?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  useEffect(() => {
    let active = true;
    startTransition(async () => {
      try {
        const result = await getHoursEntryEditContextAction(entry.id);
        if (!active) return;
        setContext(result.context);
        setLoadError(result.error);
      } catch {
        if (active) setLoadError("That record couldn't load. Check your connection and try again.");
      }
    });
    return () => { active = false; };
  }, [entry.id, attempt]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const anchor = opener?.closest<HTMLElement>("[data-hours-focus-anchor]")
      ?? document.querySelector<HTMLElement>("[data-hours-focus-anchor]");
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy.current) closeHandler.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!dialogRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (!deleted.current && opener?.isConnected) opener.focus();
      else anchor?.focus();
    };
  }, []);

  function close() { if (!busy.current) onClose(); }
  function mutate(kind: "save" | "delete", formData?: FormData) {
    if (!context || busy.current) return;
    busy.current = true;
    setPending(kind);
    setError(null);
    startTransition(async () => {
      try {
        const result = kind === "delete"
          ? await deleteHoursEntryAction(context.entry.id, context.revision)
          : await updateHoursEntryAction(context.entry.id, context.revision, formData!);
        if (result.error) setError(result.error);
        else {
          deleted.current = kind === "delete";
          onClose();
          router.refresh();
        }
      } catch {
        setError("The change couldn't be confirmed. Reopen the record to check before trying again.");
      } finally {
        busy.current = false;
        setPending(null);
      }
    });
  }

  const displayed = context?.entry ?? entry;
  const audience = context ? recordedTimeAudience(context) : null;
  const recordedDate = new Date(`${displayed.happenedOn}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hours-entry-title" aria-busy={pending !== null} tabIndex={-1}
      className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
      <div className="quiet-artifact-dialog quiet-frame quiet-frame--paper text-[color:var(--homa-ink)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="hours-entry-title" className="font-display text-xl font-semibold">Edit recorded time</h2>
          <button ref={closeRef} type="button" onClick={close} disabled={pending !== null} aria-label="Close"
            className="quiet-action quiet-action--quiet min-h-11 min-w-11 px-2"><Icon name="close" size={20} /></button>
        </div>
        <p className="mt-2 text-sm">{recordedDate}</p>
        <p className="mt-1 text-sm">{displayed.childName ? `For ${displayed.childName}.` : "For the whole family."}</p>
        <p className="mt-1 text-sm">{SOURCE_EXPLANATIONS[displayed.source] ?? "Saved in your school-time record."}</p>
        {!context ? (
          <div className="mt-4">
            {loadError ? <><p role="alert" className="text-sm">{loadError}</p><QuietAction kind="secondary" className="mt-3"
              onClick={() => { setLoadError(null); setAttempt((value) => value + 1); }}>Try again</QuietAction></>
              : <p role="status" className="text-sm">Loading the full record…</p>}
          </div>
        ) : <>
          {context.activity ? <div className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
            <p className="text-sm font-semibold">{context.activity.title}</p>
            {context.activity.note ? <><p className="mt-2 text-sm font-semibold">Planner notes</p><p className="whitespace-pre-wrap break-words text-sm">{context.activity.note}</p></> : null}
            <p className="mt-2 text-sm">Recorded time for {audience}.</p>
          </div> : null}
          <HoursEntryForm key={context.revision} context={context} pending={pending} onSave={(data) => mutate("save", data)} onClose={close} />
          {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="mt-3 text-sm text-[color:var(--homa-error-ink)]">{error}</p> : null}
          <div ref={deleteAreaRef} className="mt-4 border-t border-[var(--homa-control-boundary)] pt-3">
            {!confirming ? <QuietAction kind="quiet" disabled={pending !== null} onClick={() => setConfirming(true)}>Delete recorded time</QuietAction> : <>
              <p className="text-sm">{context.activity
                ? `Remove this recorded time for ${audience}? The activity stays finished in Planner. This can't be undone.`
                : `Delete this ${displayed.minutes}-minute entry for ${audience}? This can't be undone.`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <QuietAction kind="secondary" disabled={pending !== null} onClick={() => mutate("delete")}>{pending === "delete" ? "Deleting…" : "Delete"}</QuietAction>
                <QuietAction kind="quiet" disabled={pending !== null} onClick={() => setConfirming(false)}>Keep</QuietAction>
              </div>
            </>}
          </div>
        </>}
      </div>
    </div>
  );
}
