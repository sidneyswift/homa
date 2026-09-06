"use client";

import { useEffect, useId, useRef, useState, useTransition, type Ref } from "react";
import { useRouter } from "next/navigation";

import { HOURS_SUBJECTS } from "../../../lib/hours-model";
import { hoursNoteCharacterCount, recordedTimeAudience, type HoursEditContext } from "../../../lib/hours-edit";
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
const SUMMARY_CLASS = "min-h-11 cursor-pointer py-3 text-sm font-semibold";

function recordedDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export function HoursEntryForm({ context, pending, error, errorRef, onSave, onClose, onDeleteRequest }: {
  context: HoursEditContext;
  pending: "save" | "delete" | null;
  error?: string | null;
  errorRef?: Ref<HTMLParagraphElement>;
  onSave: (formData: FormData) => void;
  onClose: () => void;
  onDeleteRequest?: () => void;
}) {
  const { entry } = context;
  const audience = recordedTimeAudience(context);
  const [note, setNote] = useState(entry.note ?? "");
  const noteCount = hoursNoteCharacterCount(note);
  const noteCountId = useId();
  const categoryHintId = useId();
  const annotationOwner = entry.childName ?? "the whole family";
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} className="flex min-h-0 flex-col">
      <div className="min-h-0 overflow-y-auto">
        {context.activity ? <p className="mt-2 break-words text-sm font-semibold">{context.activity.title}</p> : null}
        <p className="mt-2 text-sm">{recordedDate(entry.happenedOn)}</p>
        <p className="mt-2 text-sm">{context.activity
          ? `Time and subject changes apply to ${audience}.`
          : `Recorded time for ${audience}.`}</p>
        <fieldset disabled={pending !== null} className="mt-4 flex min-w-0 flex-col gap-3"
          onFocus={(event) => event.target.scrollIntoView({ block: "nearest" })}>
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
          <details className="border-t border-[var(--homa-control-boundary)]">
            <summary className={SUMMARY_CLASS}>Category and note for {annotationOwner}</summary>
            <p className="mb-3 text-sm">{entry.childName ? `These belong only to ${entry.childName}'s recorded-time entry.` : "These belong to this whole-family recorded-time entry."}</p>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Category (optional)
              <input name="customLabel" defaultValue={entry.customLabel ?? ""} aria-describedby={categoryHintId} className={FIELD_CLASS} />
            </label>
            <p id={categoryHintId} className="mt-1 text-sm">A name within the subject, like Math club. Up to 40 characters.</p>
            <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
              Note for {annotationOwner}
              <textarea name="note" value={note} onChange={(event) => setNote(event.target.value)} rows={4}
                aria-describedby={noteCountId} aria-invalid={noteCount > 200 || undefined} className={FIELD_CLASS} />
            </label>
            <p id={noteCountId} className="mt-1 text-sm">{noteCount}/200 characters{noteCount > 200 ? ". Shorten the note to save." : ""}</p>
          </details>
        </fieldset>
        {context.activity?.note ? <details className="border-t border-[var(--homa-control-boundary)]">
          <summary className={SUMMARY_CLASS}>Planner notes (read only)</summary>
          <p className="pb-3 whitespace-pre-wrap break-words text-sm">{context.activity.note}</p>
        </details> : null}
        <p className="mt-2 text-sm">{SOURCE_EXPLANATIONS[entry.source] ?? "Saved in your school-time record."}</p>
        {onDeleteRequest ? <div className="mt-4 border-t border-[var(--homa-control-boundary)] py-3">
          <p className="mb-2 text-sm">Deleting recorded time removes the categories and notes for {audience} too.</p>
          <QuietAction kind="quiet" disabled={pending !== null} onClick={onDeleteRequest}>Delete recorded time</QuietAction>
        </div> : null}
      </div>
      <div className="shrink-0 border-t border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] pt-3">
        {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="mb-3 text-sm text-[color:var(--homa-error-ink)]">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <QuietAction kind="quiet" onClick={onClose} disabled={pending !== null}>Cancel</QuietAction>
          <QuietAction kind="primary" type="submit" disabled={pending !== null || noteCount > 200}>{pending === "save" ? "Saving…" : "Save changes"}</QuietAction>
        </div>
      </div>
    </form>
  );
}

/** One editor is used from Day, Week and Hours. Context always comes from the
 * authenticated junction lookup, including when Hours loads no Planner rows. */
export function HoursEntryOverlay({ entry, onClose }: { entry: HoursEntry; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const deleteTrigger = useRef<HTMLElement | null>(null);
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

  useEffect(() => { closeHandler.current = confirming ? () => setConfirming(false) : onClose; }, [onClose, confirming]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (confirming) confirmationRef.current?.querySelector<HTMLButtonElement>("button:last-child")?.focus();
    else if (wasConfirming.current) deleteTrigger.current?.focus();
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
        'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
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

  function close() { if (!busy.current) closeHandler.current(); }
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

  const audience = context ? recordedTimeAudience(context) : null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hours-entry-title" aria-busy={pending !== null} tabIndex={-1}
      className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
      <div className="quiet-artifact-dialog quiet-frame quiet-frame--paper flex flex-col !overflow-hidden text-[color:var(--homa-ink)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between gap-3">
          <h2 id="hours-entry-title" className="font-display text-xl font-semibold">{confirming ? "Delete recorded time?" : "Edit recorded time"}</h2>
          {!confirming ? <button ref={closeRef} type="button" onClick={close} disabled={pending !== null} aria-label="Close"
            className="quiet-action quiet-action--quiet min-h-11 min-w-11 px-2"><Icon name="close" size={20} /></button> : null}
        </div>
        {!context ? <div className="mt-4">
          <p className="mb-2 text-sm">{recordedDate(entry.happenedOn)}</p>
          {loadError ? <><p role="alert" className="text-sm">{loadError}</p><QuietAction kind="secondary" className="mt-3"
            onClick={() => { setLoadError(null); setAttempt((value) => value + 1); }}>Try again</QuietAction></>
            : <p role="status" className="text-sm">Loading the full record…</p>}
        </div> : <>
          <div className={confirming ? "hidden" : "flex min-h-0 flex-col"}>
            <HoursEntryForm key={context.revision} context={context} pending={pending} error={confirming ? null : error} errorRef={errorRef}
              onSave={(data) => mutate("save", data)} onClose={close} onDeleteRequest={() => {
                deleteTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setError(null);
                setConfirming(true);
              }} />
          </div>
          {confirming ? <div ref={confirmationRef} className="min-h-0 overflow-y-auto">
            {context.activity ? <p className="mt-3 break-words text-sm font-semibold">{context.activity.title}</p> : null}
            <p className="mt-3 text-sm">{context.activity
              ? `This deletes the recorded time, categories and notes for ${audience}. The activity stays finished in Planner, with its Planner notes. This can't be undone.`
              : `This deletes the ${context.entry.minutes}-minute entry for ${audience}, including its category and note. This can't be undone.`}</p>
            {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="mt-3 text-sm text-[color:var(--homa-error-ink)]">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <QuietAction kind="secondary" disabled={pending !== null} onClick={() => mutate("delete")}>{pending === "delete" ? "Deleting…" : "Delete recorded time"}</QuietAction>
              <QuietAction kind="quiet" disabled={pending !== null} onClick={() => setConfirming(false)}>Go back</QuietAction>
            </div>
          </div> : null}
        </>}
      </div>
    </div>
  );
}
