"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { MapAnswer } from "@homa/core";

import {
  classifyMapAnswerRequestStatus,
} from "../../map-answer-attempt";
import {
  clearAcceptedReceiptChanges,
  snapshotReceiptChanges,
  type VersionedReceiptChange,
} from "../../receipt-correction-intent";
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
  const [pending, setPending] =
    useState<Record<string, VersionedReceiptChange>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<
    "idle" | "busy" | "no-session" | "conflict" | "error"
  >("idle");
  const correctionAttemptKey = useRef<string | null>(null);
  const changeVersion = useRef(0);

  const pendingCount = Object.keys(pending).length;

  async function saveChanges() {
    if (pendingCount === 0) return;
    setState("busy");
    const submitted = snapshotReceiptChanges(pending);
    const idempotencyKey =
      correctionAttemptKey.current ?? crypto.randomUUID();
    correctionAttemptKey.current = idempotencyKey;
    try {
      const response = await fetch("/api/map/report/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          source: "report_correction",
          changes: Object.entries(submitted).map(
            ([itemId, change]) => ({
              itemId,
              answer: change.answer,
            }),
          ),
          idempotencyKey,
        }),
      });
      const outcome =
        classifyMapAnswerRequestStatus(response.status);
      if (outcome === "success") {
        correctionAttemptKey.current = null;
        setPending((current) =>
          clearAcceptedReceiptChanges(current, submitted)
        );
        setState("idle");
        router.refresh();
        return;
      }
      if (outcome === "retryable") {
        setState("idle");
        return;
      }
      correctionAttemptKey.current = null;
      setState(
        response.status === 401
          ? "no-session"
          : response.status === 409
            ? "conflict"
            : "error",
      );
    } catch {
      setState("idle");
    }
  }

  return (
    <>
      <ul className="quiet-report__receipt-list mt-2">
        {[...rows]
          .sort((a, b) => a.typicalMonths - b.typicalMonths)
          .map((row) => {
            const shown =
              pending[row.itemId]?.answer ?? row.answer;
            return (
              <li key={row.itemId} className="quiet-report__receipt-row">
                {/* One flowing line: the question, a quiet leader, the
                    answer. Literally what was asked and what she said. */}
                <p className="quiet-report__receipt-copy">
                  <span className="quiet-report__receipt-question">{row.statement}?</span>{" "}
                  <span aria-hidden="true" className="quiet-report__receipt-leader">
                    {"\u2026"}
                  </span>{" "}
                  <span className="quiet-report__receipt-answer">
                    {shown === "skip" ? "Skipped" : ANSWER_LABELS[shown]}
                  </span>
                  {pending[row.itemId] ? (
                    <span
                      className="quiet-report__receipt-updated ml-1.5"
                      style={{ color: "var(--homa-info-ink)" }}
                    >
                      {"\u00b7"} updated
                    </span>
                  ) : null}
                  {editable && editing !== row.itemId ? (
                    <button
                      type="button"
                      onClick={() => setEditing(row.itemId)}
                      disabled={state === "busy"}
                      className="quiet-report__receipt-change ml-2 print:hidden"
                    >
                      change
                    </button>
                  ) : null}
                </p>

                {editable && editing === row.itemId ? (
                  <div className="quiet-report__receipt-choices mt-2 print:hidden">
                    {CHOICES.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        disabled={state === "busy"}
                        onClick={() => {
                          correctionAttemptKey.current = null;
                          setState("idle");
                          changeVersion.current += 1;
                          const version = changeVersion.current;
                          setPending((current) =>
                            choice === row.answer
                              ? Object.fromEntries(
                                  Object.entries(current).filter(([key]) => key !== row.itemId),
                                )
                              : {
                                  ...current,
                                  [row.itemId]: {
                                    answer: choice,
                                    version,
                                  },
                                },
                          );
                          setEditing(null);
                        }}
                        className={
                          shown === choice
                            ? "quiet-report__receipt-choice quiet-action quiet-action--primary"
                            : "quiet-report__receipt-choice quiet-action quiet-action--secondary motion-safe:active:scale-[var(--press-scale)]"
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
        <p className="quiet-report__receipt-status mt-2 print:hidden">
          Changes work on the device you used for the questionnaire, or open your email link here
          first.
        </p>
      ) : state === "conflict" ? (
        <p className="quiet-report__receipt-status mt-2 print:hidden">
          This answer needs confirmation in Progress before it can be changed here.
        </p>
      ) : state === "error" ? (
        <p className="quiet-report__receipt-status mt-2 print:hidden">
          Those changes were not saved. They are still here for you to review.
        </p>
      ) : pendingCount > 0 ? (
        <div className="quiet-report__receipt-save mt-3 print:hidden">
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
          <span className="quiet-report__receipt-save-note">
            Saving updates the whole report around your new answer.
          </span>
        </div>
      ) : null}
    </>
  );
}
