"use client";

import { useRef, useState } from "react";
import { typeRoles } from "@homa/design/contract";
import { printPageSummary, printPdfPath, refreshPrintHandoff, type PrintHandoff } from "@homa/core";

/** A deliberate click owns the download; history/stream rendering has no effect. */
export function MaterialPrintCard({ handoff }: { handoff: PrintHandoff }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function openPrintPdf() {
    if (!handoff.ready || pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice(null);
    // Reserve the parent's new tab during the gesture, before awaiting auth.
    const tab = window.open("about:blank", "_blank");
    if (tab) { tab.opener = null; tab.document.title = "Preparing your PDF"; tab.document.body.textContent = "Checking the selected pages…"; }
    try {
      if (!tab) throw new Error("Allow this site to open a new tab, then try again.");
      const signal = AbortSignal.timeout(50_000);
      const fresh = await refreshPrintHandoff(handoff.request, async (id, options) => {
        const response = await fetch(`/api/materials/${id}/print`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options), signal });
        const body: unknown = await response.json().catch(() => null);
        return response.ok ? body : { ready: false, note: typeof body === "object" && body !== null && "note" in body ? body.note : "I could not prepare this PDF. Sign in again or show the material again." };
      });
      if (!fresh.ready) throw new Error(fresh.note);
      if (tab.closed) throw new Error("The PDF tab was closed. Tap again when you are ready.");
      const response = await fetch(printPdfPath(fresh.request), { credentials: "same-origin", headers: { Accept: "application/pdf" }, signal, cache: "no-store" });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { note?: unknown } | null;
        throw new Error(typeof error?.note === "string" ? error.note : "I could not open these pages. Prepare the material again.");
      }
      if (response.headers.get("content-type")?.split(";")[0] !== "application/pdf") throw new Error("I could not verify this PDF. Prepare the material again.");
      const blob = await response.blob();
      if (tab.closed) throw new Error("The PDF tab was closed. Tap again when you are ready.");
      const url = URL.createObjectURL(blob);
      tab.location.replace(url);
      // The PDF viewer has its own loaded copy by then. Never keep a session URL indefinitely.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("The selected PDF is open. Use its print button and confirm the copies in your system print dialog.");
    } catch (error) {
      tab?.close();
      setNotice(error instanceof Error ? error.message : "I could not open this PDF. Please try again.");
    } finally { pending.current = false; setBusy(false); }
  }
  return (
    <div className="quiet-artifact-card quiet-artifact-card--material" data-brand-layer="material-print-card">
      <p className="quiet-artifact-card__headline">{handoff.ready ? "Print request" : "Print preparation stopped"}</p>
      {handoff.ready ? <>
        <p className="quiet-artifact-card__title" style={{ fontSize: typeRoles.cardTitle.phone.size, lineHeight: `${typeRoles.cardTitle.phone.lineHeight}px` }}>{handoff.request.title}</p>
        <p className="quiet-artifact-card__meta">{printPageSummary(handoff.request)}</p>
        <p className="quiet-artifact-card__meta">Confirm the copies in your system print dialog.</p>
        <button className="quiet-action quiet-action--primary quiet-artifact-card__print-action" type="button" disabled={busy} aria-busy={busy} onClick={() => void openPrintPdf()}>{busy ? "Preparing PDF…" : "Open selected PDF to print"}</button>
      </> : <p className="quiet-artifact-card__meta">{handoff.note}</p>}
      {notice ? <p role="status" className="quiet-artifact-card__meta">{notice}</p> : null}
    </div>
  );
}
