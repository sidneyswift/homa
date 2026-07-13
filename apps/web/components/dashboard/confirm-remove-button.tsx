"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A two-tap remove: the first tap arms the button ("Remove?" in the
 * danger color), the second submits the form it sits in; it disarms by
 * itself after a beat. The 2026-07-12 UX read found bare Remove buttons
 * one thumb-slip from a linked phone or a saved memory made her steer
 * around that side of the screen; this is the smallest "are you sure"
 * that needs no dialog. Used by the settings phone rows and the
 * what-Homa-remembers card. In-flight state comes from the surrounding
 * form (useFormStatus) or the pending prop, whichever fires.
 */
export function ConfirmRemoveButton({
  pending: pendingProp = false,
  pendingLabel = "Removing\u2026",
  ariaLabel,
}: {
  pending?: boolean;
  pendingLabel?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending: formPending } = useFormStatus();
  const pending = pendingProp || formPending;

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!armed) {
          event.preventDefault();
          setArmed(true);
        }
      }}
      className={
        armed
          ? "min-h-9 cursor-pointer rounded-pill border border-[var(--danger)] bg-card px-4 py-1.5 text-sm font-semibold text-danger transition-colors disabled:opacity-60"
          : "min-h-9 cursor-pointer rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand hover:text-strong disabled:opacity-60"
      }
    >
      {pending ? pendingLabel : armed ? "Remove?" : "Remove"}
    </button>
  );
}
