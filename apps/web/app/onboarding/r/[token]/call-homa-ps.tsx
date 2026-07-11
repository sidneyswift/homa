"use client";

import { useState } from "react";

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
 */
export function CallHomaPs({ childId, childName }: { childId: string; childName: string }) {
  const [state, setState] = useState<"idle" | "busy" | "called" | "error" | "no-session">("idle");
  const [error, setError] = useState<string | null>(null);

  async function call() {
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
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (!data.ok) {
        setState("error");
        setError(
          data.reason === "no-phone" || data.reason === "bad-phone"
            ? "I don't have your number yet. Add it under Settings and I'm one tap away."
            : "That didn't go through. One more try usually does it.",
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
        Calling you now. Pick up and we&apos;ll talk through {childName}&apos;s report together.
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
        <p className="mt-1 text-xs text-muted">
          Calling works from the device you used for the questionnaire, or open your email link
          here first.
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
