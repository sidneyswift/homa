"use client";

import { FileCheck2 } from "lucide-react";
import { useState, useTransition } from "react";

import { buildChildReportAction } from "../../actions";

/**
 * The build-it-for-her lever on a ready-to-score kid row (founder ask
 * 2026-07-14). Two taps on purpose: the second tap sends a real family
 * a real email, so the first tap only arms the button and says exactly
 * what will happen. The action revalidates the page, so the row's pill
 * flips to "report just now" on its own.
 */
export function BuildReportButton({
  familyId,
  childId,
  childName,
}: {
  familyId: string;
  childId: string;
  childName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const result = await buildChildReportAction(familyId, childId);
      setError(result.error);
      setArmed(false);
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={act}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-border bg-card px-2.5 py-1 text-[0.7rem] font-bold text-muted shadow-sm transition-colors hover:text-strong disabled:opacity-50"
      >
        <FileCheck2 size={12} aria-hidden="true" />
        {pending
          ? "Building\u2026"
          : armed
            ? `Emails her ${childName}'s report link \u00b7 tap to confirm`
            : "Build report now"}
      </button>
      {armed && !pending ? (
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-[0.7rem] font-semibold text-subtle hover:text-strong"
        >
          Never mind
        </button>
      ) : null}
      {error ? (
        <span className="text-[0.7rem] font-semibold text-[var(--rose-600)]">{error}</span>
      ) : null}
    </span>
  );
}
