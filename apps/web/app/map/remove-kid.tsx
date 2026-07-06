"use client";

import { useState } from "react";

/**
 * The quiet remove affordance on a hub card. First tap swaps in an inline
 * confirm that names what goes with the kid (answers, report); the second
 * tap calls DELETE /api/map/children. No modal: the card is the context.
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
        className="mt-3 block text-sm text-muted underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-strong hover:underline"
      >
        remove {name}
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
