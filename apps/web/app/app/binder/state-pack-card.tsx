"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";

/**
 * The state pack card (plans/2026-07-28-state-pack.md D6): the one
 * button. Generation always runs fresh on the server from session auth;
 * this component sends no state and no family data, it only asks. On
 * success the pack opens through the authenticated materials pdf route
 * and the Binder list refreshes to show the new current pack.
 */
export function StatePackCard({
  stateName,
  verifiedMonthYear,
  expectedPages,
}: {
  stateName: string;
  verifiedMonthYear: string;
  expectedPages: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "working" }
    | { kind: "done"; pdfPath: string }
    | { kind: "error"; note: string }
  >({ kind: "idle" });

  async function makePack() {
    setStatus({ kind: "working" });
    try {
      const response = await fetch("/api/compliance/pack", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; pdfPath: string }
        | { ok: false; note?: string }
        | null;
      if (!body || !("ok" in body) || !body.ok) {
        setStatus({
          kind: "error",
          note:
            (body && "note" in body && body.note) ||
            "The pack maker had trouble just now. Nothing was saved; try again in a moment.",
        });
        return;
      }
      setStatus({ kind: "done", pdfPath: body.pdfPath });
      window.open(body.pdfPath, "_blank", "noopener");
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        note: "The pack maker had trouble just now. Nothing was saved; try again in a moment.",
      });
    }
  }

  return (
    <QuietFrame tone="paper" as="section" className="p-6">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        Your state {"·"} rules verified {verifiedMonthYear}
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold text-[color:var(--homa-ink)]">
        Your {stateName} pack
      </h2>
      <p className="mt-2 max-w-[42rem] text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
        The key requirements, deadlines, and record templates for the
        pathway most {stateName} families use, in one printable pack of
        about {expectedPages} pages. Made fresh each time from the
        current rules, so it is always worth regenerating before a new
        school year.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <QuietAction
          onClick={makePack}
          disabled={status.kind === "working"}
          icon={status.kind === "working" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--homa-paper)] border-t-transparent" /> : <Icon name="print" size={16} />}
        >
          {status.kind === "working" ? (
            "Making your pack..."
          ) : (
            `Get your ${stateName} pack`
          )}
        </QuietAction>
        {status.kind === "done" ? (
          <a
            href={status.pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[color:var(--homa-brand-text)] underline underline-offset-2"
          >
            Open your pack
          </a>
        ) : null}
      </div>
      {status.kind === "error" ? (
        <QuietStatus tone="error" className="mt-3 text-sm">{status.note}</QuietStatus>
      ) : null}
      <p className="mt-3 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        Not {stateName}?{" "}
        <a
          href="/app/settings"
          className="underline underline-offset-2 hover:text-[color:var(--homa-brand-text)]"
        >
          Update your state in settings
        </a>
        . The pack is legal information, not legal advice, and making it
        does not notify your state.
      </p>
    </QuietFrame>
  );
}
