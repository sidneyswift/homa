"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ageLabel, type MapAnswer } from "@homa/core";

/**
 * The receipts rows for one subject drawer, now a living record: every
 * answer can be changed in place by the owning parent (tap "change",
 * pick the new chip, save once). One save batches every pending change
 * into one rescore and one rewrite; a shared-link viewer without the
 * session cookie gets the same gentle device hint the whats-working box
 * uses. Benchmarks render as a typical WINDOW band where the corpus
 * documents a real range, and the single dot elsewhere.
 */

export interface ReceiptRow {
  itemId: string;
  statement: string;
  typicalMonths: number;
  typicalRangeMonths: [number, number] | null;
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
  childName,
  ageMonths,
  rows,
  editable,
}: {
  childId: string;
  childName: string;
  ageMonths: number;
  rows: ReceiptRow[];
  /** False on the sample (demonstration data is not correctable). */
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, MapAnswer>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "no-session">("idle");

  const rowAges = rows.flatMap((row) =>
    row.typicalRangeMonths ? [...row.typicalRangeMonths] : [row.typicalMonths],
  );
  const scaleMin = Math.min(...rowAges, ageMonths) - 6;
  const scaleMax = Math.max(...rowAges, ageMonths) + 6;
  const agePercent = (value: number) =>
    12 + ((value - scaleMin) / Math.max(1, scaleMax - scaleMin)) * 76;

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
      <ul className="mt-3 flex flex-col gap-2.5">
        {[...rows]
          .sort((a, b) => a.typicalMonths - b.typicalMonths)
          .map((row) => {
            const shown = pending[row.itemId] ?? row.answer;
            const range = row.typicalRangeMonths;
            return (
              <li key={row.itemId} className="rounded-md bg-[var(--surface-sunken)] px-4 pb-3 pt-3">
                <p className="text-sm font-medium leading-snug text-strong">{row.statement}?</p>
                <p className="mt-1 text-sm text-muted">
                  {shown === "skip" ? (
                    "You skipped this one"
                  ) : (
                    <>
                      You said:{" "}
                      <span className="font-semibold text-strong">{ANSWER_LABELS[shown]}</span>
                      {pending[row.itemId] ? (
                        <span className="ml-1 font-mono text-[0.65rem] font-bold" style={{ color: "var(--sky-600)" }}>
                          {"\u00b7"} updated
                        </span>
                      ) : null}
                    </>
                  )}
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
                            : "rounded-pill border border-border bg-card px-3 py-1 text-xs font-semibold text-strong hover:border-brand"
                        }
                      >
                        {ANSWER_LABELS[choice]}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* The age strip: the child's clay marker against the
                    national benchmark, drawn as a window band when the
                    corpus documents a real range (single anchors
                    understate normal spread), a neutral dot otherwise. */}
                <div className="relative mt-2 h-12" aria-hidden="false">
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--stone-300)]" />
                  {range ? (
                    <span
                      className="absolute top-[calc(50%-5px)] h-2.5 rounded-pill"
                      style={{
                        left: `${agePercent(range[0])}%`,
                        width: `${Math.max(2, agePercent(range[1]) - agePercent(range[0]))}%`,
                        background: "var(--accent-sage-soft)",
                        border: "1px solid var(--sage-300, #A7CFB0)",
                      }}
                    />
                  ) : null}
                  <span
                    className="absolute top-[13px] h-[22px] w-[3px] -translate-x-1/2 rounded-pill bg-brand"
                    style={{ left: `${agePercent(ageMonths)}%` }}
                  />
                  <span
                    className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[0.6rem] font-medium text-brand"
                    style={{ left: `${agePercent(ageMonths)}%` }}
                  >
                    {childName} {"\u00b7"} {ageLabel(ageMonths)}
                  </span>
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[var(--stone-500)]"
                    style={{ left: `${agePercent(row.typicalMonths)}%` }}
                  />
                  <span
                    className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-[0.6rem] text-subtle"
                    style={{
                      left: `${agePercent(range ? (range[0] + range[1]) / 2 : row.typicalMonths)}%`,
                    }}
                  >
                    {range
                      ? `most kids: ${ageLabel(range[0])} to ${ageLabel(range[1])}`
                      : `most kids by ${ageLabel(row.typicalMonths)}`}
                  </span>
                </div>
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
            className="rounded-pill bg-brand px-4 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            {state === "busy"
              ? "Rescoring\u2026"
              : `Save ${pendingCount} ${pendingCount === 1 ? "change" : "changes"}`}
          </button>
          <span className="text-xs text-muted">
            Saving rescores the report and rewrites it around the new answer.
          </span>
        </div>
      ) : null}
    </>
  );
}
