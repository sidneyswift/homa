"use client";

import { useState } from "react";
import { Phone } from "lucide-react";

/**
 * "Have Homa call me" on the signed-in adult's own row (#283).
 *
 * The report page has had an outbound call button since it shipped, aimed
 * at one child's report. This is the same move aimed at ordinary
 * conversation, so a parent who would rather talk than type can start a
 * call from inside the app.
 *
 * Why here and not in the composer. In-app voice was originally scoped as
 * browser audio: WebRTC, a second credential path, and a canary AI SDK
 * dependency, to answer a demand question nobody has data on. The server
 * route already existed; this is the tap that measures whether anyone wants
 * it. It sits beside this adult's own number because that is the fact it
 * acts on, and because a call costs money and interrupts: one careless tap
 * next to Send would dial a real phone.
 *
 * Every failure the route can return is spoken plainly. A button that says
 * "calling you now" when nothing is ringing is the fabrication class this
 * whole voice arc exists to remove.
 */

type Phase = "idle" | "calling" | "ringing" | "error";

/** Every reason POST /api/voice/call-me can return, in the parent's words.
 * Anything unlisted falls through to a plain apology rather than a code. */
const REASONS: Record<string, string> = {
  "no-session": "Your session expired. Sign in again and I can call.",
  "no-family": "I could not find your family account.",
  walled: "Calls are part of a paid plan.",
  "not-included": "Calls are not part of your plan yet.",
  "rate-limited": "That is three calls today already. Let's talk tomorrow.",
  "bad-phone": "That number does not look like a US mobile.",
  "phone-taken": "That number is already linked to another family.",
  "no-phone": "Add your cell number first and I can call you on it.",
  "not-configured": "My phone line is not set up right now.",
  "telnyx-error": "The call would not connect. Worth trying again in a minute.",
};

export function CallMeButton({ hasPhone }: { hasPhone: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function call(): Promise<void> {
    setPhase("calling");
    setMessage(null);
    try {
      const response = await fetch("/api/voice/call-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; reason?: string }
        | null;
      if (response.ok && body?.ok) {
        setPhase("ringing");
        return;
      }
      setPhase("error");
      setMessage(
        (body?.reason ? REASONS[body.reason] : null)
          ?? "That did not go through. Worth trying again in a minute.",
      );
    } catch {
      setPhase("error");
      setMessage("That did not go through. Worth trying again in a minute.");
    }
  }

  if (phase === "ringing") {
    return (
      <span className="text-sm text-muted">
        Calling you now, your phone should ring in a moment.
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={call}
        disabled={phase === "calling" || !hasPhone}
        title={hasPhone ? undefined : "Add your cell number first"}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Phone aria-hidden="true" className="size-4" />
        {phase === "calling" ? "Calling…" : "Have Homa call me"}
      </button>
      {message ? <span className="text-sm text-muted">{message}</span> : null}
    </span>
  );
}
