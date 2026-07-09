"use client";

import { useState } from "react";

/**
 * The P.S. at the end of Homa's note (founder ask 2026-07-08: the call
 * offer became a low-stakes sign-off, not its own section). One tap
 * rings the number the family already gave during onboarding; no phone
 * input here. Homa talks the report through on a real call and builds
 * the curriculum from the conversation (it lands on /home when ready).
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
      <p className="mt-3 text-sm text-body print:hidden">
        Calling you now. Pick up and we&apos;ll talk through {childName}&apos;s report together.
      </p>
    );
  }

  return (
    <div className="mt-3 print:hidden">
      <p className="text-sm text-body">
        P.S. Rather talk it through?{" "}
        <button
          type="button"
          onClick={() => void call()}
          disabled={state === "busy"}
          className="font-semibold text-brand underline underline-offset-2 transition-opacity duration-(--dur-fast) ease-out hover:opacity-80 disabled:opacity-50"
        >
          {state === "busy" ? "Calling\u2026" : "Call me"}
        </button>{" "}
        and your phone will ring. Yes, really me.
      </p>
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
