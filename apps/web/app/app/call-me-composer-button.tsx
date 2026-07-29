"use client";

import { useState } from "react";
import { AudioLines, Phone } from "lucide-react";
import Link from "next/link";

/**
 * The composer's primary action while the box is empty: start a voice
 * conversation. The moment she types, chat-client swaps this for Send, so
 * the two never compete for the same tap (founder direction 2026-07-29,
 * the ChatGPT composer shape).
 *
 * What "voice" means here is a real phone call, not browser audio. Homa
 * rings the number this adult has linked. That is the whole of #283: in-app
 * voice was scoped as WebRTC plus a second credential path plus a canary
 * dependency to answer a demand question nobody had data on, and the call
 * route already existed. This button is the discovery loop that produces
 * the data. If the taps come, browser audio is worth building.
 *
 * Why it is safe here despite ringing a real phone. It only ever occupies
 * the primary slot when the composer is EMPTY, so it cannot be hit while
 * reaching for Send. There is no confirm step on purpose: a parent who taps
 * a phone icon is asking to talk, and a dialog asking whether she meant it
 * reads as Homa second-guessing her.
 *
 * Honesty: the ringing line only appears on an ok response. A button that
 * says "calling you now" when nothing is ringing is the fabrication class
 * the whole voice arc exists to remove.
 */

type Phase = "idle" | "calling" | "ringing" | "blocked";

/** Every reason POST /api/voice/call-me can return, in the parent's words.
 * Anything unlisted falls through to a plain apology rather than a code. */
const REASONS: Record<string, string> = {
  "no-session": "Your session expired. Sign in again and I can call.",
  "no-family": "I could not find your family account.",
  walled: "Calls come with a paid plan.",
  "not-included": "Calls are not part of your plan yet.",
  "rate-limited": "That is three calls today already. Let's talk tomorrow.",
  "bad-phone": "That number does not look like a US mobile.",
  "phone-taken": "That number is already linked to another family.",
  "not-configured": "My phone line is not set up right now.",
  "telnyx-error": "The call would not connect. Worth trying again in a minute.",
};

export function CallMeComposerButton({
  canBeCalled,
  onCallPlaced,
}: {
  /** Whether this adult has a number linked. False sends her to settings
   * instead of firing a request that can only fail. */
  canBeCalled: boolean;
  onCallPlaced?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function call(): Promise<void> {
    if (!canBeCalled) {
      setPhase("blocked");
      setMessage(null);
      return;
    }
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
        onCallPlaced?.();
        window.setTimeout(() => setPhase("idle"), 12000);
        return;
      }
      if (body?.reason === "no-phone") {
        setPhase("blocked");
        setMessage(null);
        return;
      }
      setPhase("idle");
      setMessage(
        (body?.reason ? REASONS[body.reason] : null)
          ?? "That did not go through. Worth trying again in a minute.",
      );
    } catch {
      setPhase("idle");
      setMessage("That did not go through. Worth trying again in a minute.");
    }
  }

  return (
    <>
      {/* The hint sits above the composer row rather than beside the button,
          so a long line never squeezes the buttons on a 390px screen. */}
      {phase === "ringing" || phase === "blocked" || message ? (
        <span className="pointer-events-auto absolute bottom-full right-0 mb-2 max-w-[min(20rem,80vw)] rounded-md border border-border bg-card px-3 py-2 text-sm text-body shadow-sm">
          {phase === "ringing" ? (
            "Calling you now, your phone should ring in a moment."
          ) : phase === "blocked" ? (
            <>
              Add your cell number in{" "}
              <Link href="/app/settings" className="font-semibold text-strong underline">
                Settings
              </Link>{" "}
              and I can call you.
            </>
          ) : (
            message
          )}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Have Homa call you"
        title="Have Homa call you"
        onClick={call}
        disabled={phase === "calling"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {phase === "ringing" ? (
          <Phone size={17} aria-hidden="true" />
        ) : (
          <AudioLines size={18} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
