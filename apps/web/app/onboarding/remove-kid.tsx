"use client";

import { useState } from "react";

import { QuietAction, QuietFeedback } from "../../components/design";
import { Icon } from "../../components/design/Icon";

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
      <QuietAction
        kind="quiet"
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${name}`}
        className="quiet-remove__trigger absolute top-2 right-2"
        icon={<Icon name="close" size={16} />}
      >
        Remove
      </QuietAction>
    );
  }

  return (
    <div className="quiet-remove__confirm mt-3 pt-3">
      <p className="quiet-remove__copy">
        This deletes everything saved for {name}, and there&apos;s no undo. Adding {name} back
        later starts fresh.
      </p>
      {failed ? (
        <QuietFeedback tone="error" className="mt-2">
          That didn&apos;t work. One more try usually does it.
        </QuietFeedback>
      ) : null}
      <div className="quiet-remove__actions mt-3">
        <QuietAction
          kind="secondary"
          type="button"
          onClick={() => void removeKid()}
          disabled={busy}
          className="quiet-remove__destructive"
        >
          {busy ? "Removing\u2026" : `Yes, remove ${name}`}
        </QuietAction>
        <QuietAction
          kind="secondary"
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="quiet-remove__keep"
        >
          Keep {name}
        </QuietAction>
      </div>
    </div>
  );
}
