"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import type { HoursRecordPreview } from "../../../lib/hours-export";
import { hoursRecordChildLabel, hoursRecordParams, parseHoursRecordRequest, type HoursRecordScope } from "../../../lib/hours-record-scope";
import { resolveHoursWindow } from "../../../lib/hours-summary";
import { formatMinutesAsHours, SUBJECT_LABELS } from "../../../lib/hours-view";

export function HoursRecordExport({ kids, focusChildId, today, schoolYearStartOn }: {
  kids: readonly { id: string; name: string }[];
  focusChildId: string | null;
  today: string;
  schoolYearStartOn: string | null;
}) {
  const [scope, setScope] = useState<HoursRecordScope>(() => ({
    childId: focusChildId,
    from: resolveHoursWindow("school_year", today, schoolYearStartOn).from,
    through: today,
    includeShared: true,
  }));
  const [preview, setPreview] = useState<HoursRecordPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, []);
  const change = (next: HoursRecordScope) => {
    requestId.current += 1;
    setScope(next);
    setPreview(null);
    setError(null);
  };
  const previewRecords = async (event: FormEvent) => {
    event.preventDefault();
    const params = hoursRecordParams(scope);
    if (!parseHoursRecordRequest(params)) {
      setError("Choose valid dates, with the start on or before the end.");
      return;
    }
    params.set("format", "preview");
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const response = await fetch(`/api/hours/export?${params}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error("read");
      const result = await response.json() as HoursRecordPreview & { ok: boolean };
      if (!result.ok) throw new Error("read");
      if (id === requestId.current) setPreview(result);
    } catch {
      if (id === requestId.current) setError("The record didn't load. Your saved entries haven't changed. Try previewing again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  const download = async (format: "entries" | "days") => {
    if (!preview) return;
    const params = hoursRecordParams(preview.scope);
    params.set("format", format);
    params.set("revision", preview.revision);
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/hours/export?${params}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (response.status === 409) {
        if (id === requestId.current) {
          setPreview(null);
          setError("Your record changed since this preview. Preview it again to download the current entries.");
        }
        return;
      }
      if (!response.ok || !response.headers.get("content-type")?.startsWith("text/csv")) throw new Error("download");
      const blob = await response.blob();
      if (id !== requestId.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "days" ? "homa-recorded-learning-days.csv" : "homa-school-hours.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      if (id === requestId.current) setError("The download didn't finish. Your saved entries haven't changed. Try downloading again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  const fieldClass = "mt-1 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-strong";
  return (
    <details className="w-full" data-hours-record-export>
      <summary className="quiet-action quiet-action--secondary quiet-action--default w-fit cursor-pointer">Download records</summary>
      <QuietFrame className="mt-3 p-4">
        <h3 className="font-display text-lg font-semibold text-strong">Choose your record</h3>
        <p className="mt-1 text-sm text-muted">Preview the dates and totals, then download a spreadsheet.</p>
        <form onSubmit={previewRecords} className="mt-4">
          <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-body">For
              <select className={fieldClass} value={scope.childId ?? ""} onChange={(event) => change({ ...scope, childId: event.target.value || null })}>
                <option value="">Whole family</option>
                {kids.map((kid) => <option key={kid.id} value={kid.id}>{hoursRecordChildLabel(kid, kids)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-body">Shared time
              <select className={fieldClass} value={scope.includeShared ? "include" : "exclude"} onChange={(event) => change({ ...scope, includeShared: event.target.value === "include" })}>
                <option value="include">Include whole-family entries</option>
                <option value="exclude">Child-specific entries only</option>
              </select>
            </label>
            <label className="min-w-0 text-sm font-semibold text-body">From
              <input type="date" className={fieldClass} value={scope.from ?? ""} onChange={(event) => change({ ...scope, from: event.target.value || null })} />
            </label>
            <label className="min-w-0 text-sm font-semibold text-body">Through
              <input type="date" className={fieldClass} value={scope.through ?? ""} onChange={(event) => change({ ...scope, through: event.target.value || null })} />
            </label>
            <p className="text-sm text-muted sm:col-span-2">Both dates are included. A blank date leaves that end open.</p>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <QuietAction type="button" kind="quiet" onClick={() => change({ ...scope, from: null, through: null })}>All dates</QuietAction>
              <QuietAction type="submit" kind="primary">{busy ? "Loading record..." : "Preview record"}</QuietAction>
            </div>
          </fieldset>
        </form>
        {error ? <p role="alert" className="mt-3 text-sm text-body">{error}</p> : null}
        {preview ? (
          <section className="mt-4 border-t border-border-subtle pt-4" aria-label="Record preview" aria-live="polite">
            <p className="font-semibold text-strong">{preview.entryCount} entries · {formatMinutesAsHours(preview.totalMinutes)} saved time</p>
            <p className="mt-1 text-sm text-muted">
              {preview.scope.from ?? "First recorded date"} through {preview.scope.through ?? "Last recorded date"}.
              {preview.scope.includeShared ? " Shared time is included." : " Shared time is excluded."}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-body">
              {preview.byChild.map((child) => <li key={child.childId ?? "family"}><strong>{child.childId === null ? child.childName : hoursRecordChildLabel({ id: child.childId, name: child.childName }, kids)}</strong>: {child.recordedDays} recorded learning days · {formatMinutesAsHours(child.minutes)}</li>)}
            </ul>
            <p className="mt-3 text-sm text-muted">A recorded day has at least one timed entry. A blank day does not mean absence.
              {preview.scope.includeShared && preview.scope.childId === null && kids.length > 1 ? " Shared time counts once in the entry total and toward each child's record." : ""}
            </p>
            {preview.entries.length > 0 ? (
              <details className="mt-3 text-sm text-body">
                <summary className="min-h-11 cursor-pointer py-3">View {preview.entries.length < preview.entryCount ? `first ${preview.entries.length}` : "all"} entries</summary>
                <ul className="space-y-3">
                  {preview.entries.map((entry) => <li key={entry.id} className="break-words"><strong>{entry.happenedOn} · {entry.childId === null ? "Whole family" : hoursRecordChildLabel({ id: entry.childId, name: entry.childName ?? "Child" }, kids)}</strong><br />{SUBJECT_LABELS[entry.subject]}{entry.customLabel ? ` · ${entry.customLabel}` : ""} · {formatMinutesAsHours(entry.minutes)}{entry.note ? <p>{entry.note}</p> : null}</li>)}
                </ul>
              </details>
            ) : <p className="mt-3 text-sm text-muted">No timed entries match these choices. The spreadsheets will contain headings only.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <QuietAction disabled={busy} kind="secondary" onClick={() => void download("entries")}>Download time entries</QuietAction>
              <QuietAction disabled={busy} kind="secondary" onClick={() => void download("days")}>Download recorded days</QuietAction>
            </div>
          </section>
        ) : null}
      </QuietFrame>
    </details>
  );
}
