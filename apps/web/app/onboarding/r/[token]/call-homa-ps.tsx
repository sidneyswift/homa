"use client";

import { useState } from "react";

import { sendWallBeacon } from "../../../../components/billing/wall-beacon";
import { WALL_STALE_CALL_LINE } from "../../../../components/billing/wall-copy";
import { WallModal } from "../../../../components/billing/wall-modal";
import type { WallCheckout } from "../../../../lib/billing/wall-types";

/**
 * The call offer, one plain line inside the letter from Homa (folded
 * into the letter body instead of its own boxed P.S., founder ask
 * 2026-07-09; reworded 2026-07-11: the tappable text is the action
 * itself, "have me call you now", because a link labeled "click" says
 * nothing to a screen reader and nothing on a phone, where nobody
 * clicks, and "now" warns that the tap dials immediately). One tap
 * rings the number the family already gave during
 * onboarding; no phone input here. Homa talks the report through on a
 * real call and builds the curriculum from the conversation (it lands
 * on the kid's page, /app/kids/[childId], when ready).
 *
 * The wall (plans/2026-07-11-the-wall.md, DARK behind
 * HOMA_WALL_ENABLED): the call is a door. A walled family's tap opens
 * the offer instead of dialing. Every tap beacons report.action_tapped,
 * flag on or off, for baseline funnel data.
 */
export function CallHomaPs({
  childId,
  childName,
  wall = null,
}: {
  childId: string;
  childName: string;
  /** Checkout URLs when this family is walled; null means the door is open. */
  wall?: WallCheckout | null;
}) {
  const [state, setState] = useState<
    "idle" | "busy" | "called" | "error" | "no-session" | "walled"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [wallOpen, setWallOpen] = useState(false);

  async function call() {
    sendWallBeacon({ kind: "door_tap", door: "call", childId });
    if (wall) {
      setWallOpen(true);
      return;
    }
    setState("busy");
    setError(null);
    try {
      const response = await fetch("/api/voice/curriculum/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      });
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      if (response.status === 403) {
        // The wall went up between this page's render and the tap (rare
        // race); the refreshed page carries the offer.
        setState("walled");
        return;
      }
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (!data.ok) {
        setState("error");
        setError(
          data.reason === "no-phone" || data.reason === "bad-phone"
            ? "I don't have your number yet. Add it under Settings, then try again."
            : "That didn't go through. Try once more.",
        );
        return;
      }
      setState("called");
    } catch {
      setState("error");
      setError("Couldn't reach us just now. Try again in a moment.");
    }
  }

  if (state === "called") {
    return (
      <p className="mt-2 text-body print:hidden" role="status">
        Calling you now. Pick up and we&apos;ll talk through {childName}&apos;s report.
      </p>
    );
  }

  return (
    <div className="print:hidden">
      {state === "busy" ? (
        // The whole line becomes the status while dialing (swapping
        // only the button's label used to leave a broken sentence:
        // "BTW, calling... if you'd rather I give you a call").
        <p className="text-body" role="status">
          Calling you now{"\u2026"}
        </p>
      ) : (
        <p className="text-body">
          If you&apos;d rather talk through the report,{" "}
          <button
            type="button"
            onClick={() => void call()}
            className="font-semibold text-brand underline underline-offset-2 transition-opacity duration-(--dur-fast) ease-out hover:opacity-80"
          >
            have me call you now
          </button>
          .
        </p>
      )}
      {state === "no-session" ? (
        // Copy-kit shape (name it, settle it, next step), and the SAME
        // wording as MonthButton's no-session state: one failure, one
        // vocabulary (editor gate, 2026-07-11).
        <p className="mt-1 text-xs text-muted">
          The call didn&apos;t start. I don&apos;t recognize this device yet. Open your email
          link on this device once, then try again.
        </p>
      ) : null}
      {state === "walled" ? (
        <p className="mt-1 text-xs text-muted">{WALL_STALE_CALL_LINE}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {wall ? (
        <WallModal
          door="call"
          childName={childName}
          checkout={wall}
          open={wallOpen}
          onClose={() => setWallOpen(false)}
        />
      ) : null}
    </div>
  );
}
