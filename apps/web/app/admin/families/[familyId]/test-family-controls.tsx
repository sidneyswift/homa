"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { deleteSandboxFamilyAction, setFamilySandboxAction } from "../../actions";

/**
 * The founder's test-family controls (founder ask 2026-07-14): mark or
 * unmark a family as a test family, and delete a test family with the
 * same two-tap pattern as the build-report lever (a misclick never
 * deletes; real families cannot be deleted here at all, the action
 * refuses server-side).
 */
export function TestFamilyControls({
  familyId,
  sandbox,
}: {
  familyId: string;
  sandbox: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chipClass =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-border bg-card px-2.5 py-1 text-[0.7rem] font-bold text-muted shadow-sm transition-colors hover:text-strong disabled:opacity-50";

  const toggle = () => {
    startTransition(async () => {
      const result = await setFamilySandboxAction(familyId, !sandbox);
      setError(result.error);
      setArmed(false);
    });
  };

  const remove = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteSandboxFamilyAction(familyId);
      // On success the action redirects to /admin/families; reaching
      // here means it refused and said why.
      setError(result.error);
      setArmed(false);
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={toggle} disabled={pending} className={chipClass}>
        <FlaskConical size={12} aria-hidden="true" />
        {sandbox ? "Not a test family" : "Mark as test family"}
      </button>
      {sandbox ? (
        <button type="button" onClick={remove} disabled={pending} className={chipClass}>
          <Trash2 size={12} aria-hidden="true" />
          {pending
            ? "Deleting\u2026"
            : armed
              ? "Gone from every list, kids and all \u00b7 tap to confirm"
              : "Delete this test family"}
        </button>
      ) : null}
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
