"use client";

import { useState, type ReactNode } from "react";

import { reportButtonClass } from "./report-button";

/**
 * Tap-to-enlarge for a server-rendered chart (founder ask 2026-07-08:
 * see the chart, one sentence about it, and click into it to view it
 * larger). The inline chart is the tap target; the same children render
 * again inside a full-screen overlay on a wider canvas with horizontal
 * scrolling, so the lines are genuinely readable on a phone. Print shows
 * the inline chart only.
 */
export function ChartLightbox({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title}. Tap to view larger.`}
        className="block w-full cursor-zoom-in rounded-md text-left transition-transform duration-(--dur-fast) ease-out motion-safe:active:scale-[0.99]"
      >
        {children}
        <span className="mt-1.5 block text-center font-mono text-[0.6rem] uppercase tracking-widest text-subtle print:hidden">
          tap to view larger
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="chart-lightbox fixed inset-0 z-50 flex flex-col justify-center bg-page px-4 pb-4 pt-3 print:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
              {title}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={reportButtonClass("secondary", "inline-flex min-h-10 items-center px-4 py-1.5 text-sm font-semibold")}
            >
              Close
            </button>
          </div>
          {/* Content-sized, vertically centered card (UX read 2026-07-08:
              a screen-filling panel left a broken-looking blank area under
              the chart). Stop propagation so panning never closes it. */}
          <div
            className="chart-lightbox-panel mt-3 max-h-[80vh] overflow-auto overscroll-contain rounded-lg border border-border-subtle bg-card p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-w-[640px]">{children}</div>
          </div>
          <p className="mt-2 text-center font-mono text-[0.6rem] uppercase tracking-widest text-subtle">
            drag sideways to see the rest {"\u00b7"} tap outside to close
          </p>
        </div>
      ) : null}
    </>
  );
}
