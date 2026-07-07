"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { MapAnswer } from "@homa/core";

/**
 * The sharpness meter's action half: a subject with one clear look gets
 * its single highest-information question inline (the deep dive's probe
 * logic, one tap instead of a page). Answering rescores and rewrites;
 * "not sure" and "skip" stay honest options. Session-gated like every
 * living-record write.
 */
export function SharpenInline({
  childId,
  statement,
  itemId,
}: {
  childId: string;
  statement: string;
  itemId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "no-session">("idle");

  async function answer(value: MapAnswer) {
    setState("busy");
    try {
      const response = await fetch("/api/map/report/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          source: "report_probe",
          changes: [{ itemId, answer: value }],
        }),
      });
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      if (response.ok) {
        setState("done");
        router.refresh();
        return;
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="mt-2 text-xs text-muted print:hidden">
        Noted. The report is rescoring around it now.
      </p>
    );
  }

  if (state === "no-session") {
    return (
      <p className="mt-2 text-xs text-muted print:hidden">
        Answering works on the device you used for the questionnaire, or open your email link here
        first.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border-subtle bg-card p-3 print:hidden">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
        One clear look so far {"\u00b7"} 30 seconds sharpens it
      </p>
      <p className="mt-1 text-sm font-medium text-strong">{statement}?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ["easily", "Easily"],
            ["getting_there", "Getting there"],
            ["not_yet", "Not yet"],
            ["not_sure", "Not sure"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={state === "busy"}
            onClick={() => void answer(value)}
            className="rounded-pill border border-border bg-card px-3 py-1 text-xs font-semibold text-strong hover:border-brand disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
