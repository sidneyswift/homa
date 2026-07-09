"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { MapAnswer } from "@homa/core";

import { reportButtonClass } from "./report-button";

/**
 * The receipts rows for one subject drawer: each question asked, then
 * the answer given, as plain text (founder ask 2026-07-08: the per-row
 * benchmark strip charts repeated the whole-picture chart; receipts
 * read as text now). Still a living record: every answer can be changed
 * in place by the owning parent (tap "change", pick the new chip, save
 * once). One save batches every pending change into one rescore and one
 * rewrite; a shared-link viewer without the session cookie gets the
 * same gentle device hint the rest of the page uses.
 */

export interface ReceiptRow {
  itemId: string;
  statement: string;
  /** Kept for ordering rows easiest-first; never rendered as a chart. */
  typicalMonths: number;
  answer: MapAnswer;
}

const ANSWER_LABELS: Record<MapAnswer, string> = {
  easily: "Easily",
  getting_there: "Getting there",
  not_yet: "Not yet",
  not_sure: "Not sure",
  skip: "Skipped",
};

const CHOICES: MapAnswer[] = ["easily", "getting_there", "not_yet", "not_sure"];

export function ReceiptsList({
  childId,
  rows,
  editable,
}: {
  childId: string;
  rows: ReceiptRow[];
  /** False on the sample (demonstration data is not correctable). */
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, MapAnswer>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "no-session">("idle");

  const pendingCount = Object.keys(pending).length;

  async function saveChanges() {
    if (pendingCount === 0) return;
    setState("busy");
    try {
      const response = await fetch("/api/map/report/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          source: "report_correction",
          changes: Object.entries(pending).map(([itemId, answer]) => ({ itemId, answer })),
        }),
      });
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      if (response.ok) {
        setPending({});
        setEditing(null);
        setState("idle");
        router.refresh();
        return;
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  }

  return (
    <>
      <ul className="mt-2 flex flex-col gap-2">
        {[...rows]
          .sort((a, b) => a.typicalMonths - b.typicalMonths)
          .map((row) => {
            const shown = pending[row.itemId] ?? row.answer;
            return (
              <li key={row.itemId} className="rounded-md bg-[var(--surface-sunken)] px-4 py-3">
                {/* One flowing line: the question, a quiet leader, the
                    answer. Literally what was asked and what she said. */}
                <p className="text-sm leading-relaxed text-strong">
                  <span className="font-medium">{row.statement}?</span>{" "}
                  <span aria-hidden="true" className="text-subtle">
                    {"\u2026"}
                  </span>{" "}
                  <span className="font-semibold">
                    {shown === "skip" ? "Skipped" : ANSWER_LABELS[shown]}
                  </span>
                  {pending[row.itemId] ? (
                    <span
                      className="ml-1.5 font-mono text-[0.65rem] font-bold"
                      style={{ color: "var(--sky-600)" }}
                    >
                      {"\u00b7"} updated
                    </span>
                  ) : null}
                  {editable && editing !== row.itemId ? (
                    <button
                      type="button"
                      onClick={() => setEditing(row.itemId)}
                      className="ml-2 text-xs font-semibold text-brand underline-offset-2 hover:underline print:hidden"
                    >
                      change
                    </button>
                  ) : null}
                </p>

                {editable && editing === row.itemId ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                    {CHOICES.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => {
                          setPending((current) =>
                            choice === row.answer
                              ? Object.fromEntries(
                                  Object.entries(current).filter(([key]) => key !== row.itemId),
                                )
                              : { ...current, [row.itemId]: choice },
                          );
                          setEditing(null);
                        }}
                        className={
                          shown === choice
                            ? "rounded-pill bg-brand px-3 py-1 text-xs font-semibold text-on-brand"
                            : "rounded-pill border border-border bg-card px-3 py-1 text-xs font-semibold text-strong transition duration-(--dur-fast) ease-out hover:border-brand motion-safe:active:scale-[var(--press-scale)]"
                        }
                      >
                        {ANSWER_LABELS[choice]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
      </ul>

      {state === "no-session" ? (
        <p className="mt-2 text-xs text-muted print:hidden">
          Changes work on the device you used for the questionnaire, or open your email link here
          first.
        </p>
      ) : pendingCount > 0 ? (
        <div className="mt-3 flex items-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => void saveChanges()}
            disabled={state === "busy"}
            className={reportButtonClass("primary", "px-4 py-1.5 text-xs font-semibold disabled:opacity-50")}
          >
            {state === "busy"
              ? "Updating\u2026"
              : `Save ${pendingCount} ${pendingCount === 1 ? "change" : "changes"}`}
          </button>
          <span className="text-xs text-muted">
            Saving updates the whole report around your new answer.
          </span>
        </div>
      ) : null}
    </>
  );
}
