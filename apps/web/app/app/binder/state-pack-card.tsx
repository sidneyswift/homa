"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, Loader2 } from "lucide-react";

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
    <section className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
        Your state {"·"} rules verified {verifiedMonthYear}
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold text-strong">
        Your {stateName} pack
      </h2>
      <p className="mt-2 max-w-[42rem] text-sm text-body">
        The key requirements, deadlines, and record templates for the
        pathway most {stateName} families use, in one printable pack of
        about {expectedPages} pages. Made fresh each time from the
        current rules, so it is always worth regenerating before a new
        school year.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={makePack}
          disabled={status.kind === "working"}
          className="inline-flex items-center gap-2 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {status.kind === "working" ? (
            <>
              <Loader2 size={16} aria-hidden="true" className="animate-spin" />
              Making your pack...
            </>
          ) : (
            <>
              <FileDown size={16} aria-hidden="true" />
              Get your {stateName} pack
            </>
          )}
        </button>
        {status.kind === "done" ? (
          <a
            href={status.pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand underline underline-offset-2"
          >
            Open your pack
          </a>
        ) : null}
      </div>
      {status.kind === "error" ? (
        <p className="mt-3 text-sm text-muted">{status.note}</p>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        Not {stateName}?{" "}
        <Link
          href="/app/settings"
          className="underline underline-offset-2 hover:text-brand"
        >
          Update your state in settings
        </Link>
        . The pack is legal information, not legal advice, and making it
        does not notify your state.
      </p>
    </section>
  );
}
