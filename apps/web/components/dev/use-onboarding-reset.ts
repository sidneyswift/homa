"use client";

import { useCallback, useState } from "react";

/**
 * Becoming a brand new parent again, in one call.
 *
 * The server half deletes the family and re-attaches this account to a
 * fresh one. The client half matters just as much and is easy to
 * forget: the transcript cache and the kickoff flag both live in
 * localStorage, so without clearing them the "new" family opens holding
 * yesterday's conversation and never says hello, which looks exactly
 * like the reset silently failing.
 *
 * Shared by the /dev/reset page and the floating dev button, so the two
 * cannot drift into clearing different things.
 */

/** Cleared by prefix, not by exact name: the chat key is per user and
 *  the kickoff key is per family, and after a reset the family id has
 *  changed, so an exact-match clear would orphan the old one forever. */
const CLEARED_PREFIXES = ["homa-chat-", "homa-onboarding-kickoff-"];

function clearLocalState(): void {
  try {
    const doomed: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && CLEARED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        doomed.push(key);
      }
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    // Private mode or a blocked store: the server reset still stands,
    // and a stale cache is a worse first render, not a broken one.
  }
}

export type OnboardingResetPhase = "idle" | "working" | "failed";

export function useOnboardingReset(): {
  phase: OnboardingResetPhase;
  message: string | null;
  reset: () => Promise<void>;
} {
  const [phase, setPhase] = useState<OnboardingResetPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(async () => {
    setPhase("working");
    setMessage(null);
    try {
      const response = await fetch("/api/dev/reset-onboarding", { method: "POST" });
      // A route that throws returns an HTML error page, not JSON, so
      // parsing first turns every real server failure into "Unexpected
      // end of JSON input" and hides the thing that actually broke. Read
      // the body as text, then try to make sense of it.
      const raw = await response.text();
      let data: { ok?: boolean; reason?: string; message?: string } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        data = {};
      }
      if (!response.ok || !data.ok) {
        setPhase("failed");
        setMessage(
          data.reason === "not-sandbox"
            ? "Refused: not a test family. Nothing was deleted."
            : (data.message ??
                `The reset did not go through (${response.status}). ${raw.slice(0, 160)}`),
        );
        return;
      }
      clearLocalState();
      // A full navigation, not a router push: the chat client reads
      // localStorage in a state initializer, so it has to mount fresh.
      window.location.assign("/onboarding");
    } catch (error) {
      setPhase("failed");
      setMessage(error instanceof Error ? error.message : "unknown");
    }
  }, []);

  return { phase, message, reset };
}
