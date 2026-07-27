"use client";

import { Check, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

import { acknowledgeAlertAction, unacknowledgeAlertAction } from "./actions";
import type { AlertSource } from "../../lib/admin/alert-acks";

/**
 * The alert strip's check-off control (founder ask 2026-07-13). One
 * small chip per alert: "Mark handled" hides the row, "Bring back" on
 * the handled list un-hides it. Client component only for the pending
 * state; the actions revalidate /admin so the row leaves on its own.
 */

export function AlertAckButton({
  source,
  sourceId,
  mode = "acknowledge",
}: {
  source: AlertSource;
  sourceId: string;
  mode?: "acknowledge" | "undo";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = () => {
    startTransition(async () => {
      const result =
        mode === "undo"
          ? await unacknowledgeAlertAction(source, sourceId)
          : await acknowledgeAlertAction(source, sourceId);
      setError(result.error);
    });
  };

  const Icon = mode === "undo" ? Undo2 : Check;
  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-[0.7rem] font-semibold text-[var(--rose-600)]">{error}</span> : null}
      <button
        type="button"
        onClick={act}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-border bg-card px-2.5 py-1 text-[0.7rem] font-bold text-muted shadow-sm transition-colors hover:text-strong disabled:opacity-50"
      >
        <Icon size={12} aria-hidden="true" />
        {mode === "undo" ? "Bring back" : "Mark handled"}
      </button>
    </span>
  );
}
