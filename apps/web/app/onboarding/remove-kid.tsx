"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * The quiet remove affordance on a hub card. First tap swaps in an inline
 * confirm that names what goes with the kid (answers, report); the second
 * tap calls DELETE /api/map/children. No modal: the card is the context.
 *
 * Follow-up (2026-07-07, "how can we make remove better design"): the
 * trigger used to be a full "remove {name}" text link sitting right
 * under the primary button, matching its visual rhythm even though
 * removal is rare and destructive. Moved to a quiet icon button in the
 * card's corner instead (the parent card needs `relative` for this to
 * position against), a lighter-weight, more standard place for a
 * "remove this card" control to live. The confirm step, once
 * triggered, still reads inline in the card body: that part is common
 * enough in the moment it's shown to deserve full sentences.
 */
export function RemoveKid({
  childId,
  name,
  onRemoved,
}: {
  childId: string;
  name: string;
  /** Parent refetches state so the card disappears with the row. */
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function removeKid() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/map/children", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      const data = (await response.json()) as { ok: boolean };
      if (!data.ok) throw new Error("remove failed");
      onRemoved();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${name}`}
        className="absolute top-3 right-3 rounded-full p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] hover:text-danger"
      >
        <X size={16} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-border-subtle pt-3 text-sm">
      <p className="text-body">
        This deletes everything saved for {name}, and there&apos;s no undo. Adding {name} back
        later starts fresh.
      </p>
      {failed ? (
        <p className="mt-2 text-danger" role="alert">
          That didn&apos;t work. One more try usually does it.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void removeKid()}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 py-2 font-semibold text-danger transition duration-(--dur-fast) ease-out hover:border-danger motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Removing\u2026" : `Yes, remove ${name}`}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-4 py-2 font-semibold text-strong transition duration-(--dur-fast) ease-out hover:border-brand motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          Keep {name}
        </button>
      </div>
    </div>
  );
}
