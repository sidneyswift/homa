"use client";

import { useCallback, useState } from "react";

/**
 * The one address to bookmark for testing onboarding: hit it, and you
 * are a brand new parent again, still signed in as yourself.
 *
 * The server half deletes the family and re-attaches this account to a
 * fresh one. The client half matters just as much and is easy to
 * forget: the transcript cache and the kickoff flag both live in
 * localStorage, so without clearing them the "new" family opens holding
 * yesterday's conversation and never says hello, which looks exactly
 * like the reset silently failing.
 *
 * Keys are cleared by prefix rather than by exact name. The chat key is
 * per user and the kickoff key is per family, and after a reset the
 * family id has changed, so an exact-match clear would leave the old
 * one behind forever.
 */

const CLEARED_PREFIXES = ["homa-chat-", "homa-onboarding-kickoff-"];

type Phase = "idle" | "working" | "failed";

function clearLocalState(): number {
  let cleared = 0;
  try {
    const doomed: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && CLEARED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        doomed.push(key);
      }
    }
    for (const key of doomed) {
      window.localStorage.removeItem(key);
      cleared += 1;
    }
  } catch {
    // Private mode or a blocked store: the server reset still stands,
    // and a stale cache is a worse first render, not a broken one.
  }
  return cleared;
}

export function ResetClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async () => {
    setPhase("working");
    setMessage(null);
    try {
      const response = await fetch("/api/dev/reset-onboarding", { method: "POST" });
      const data = (await response.json()) as {
        ok?: boolean;
        reason?: string;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setPhase("failed");
        setMessage(
          data.reason === "not-sandbox"
            ? "Refused: that is not a test family. Nothing was deleted."
            : (data.message ?? "The reset did not go through."),
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

  return (
    <div className="mx-auto mt-16 w-full max-w-[26rem] px-6">
      <h1 className="font-display text-2xl font-bold text-strong">
        Start onboarding over
      </h1>
      <p className="mt-2 text-body">
        Deletes this test family and everything in it, then gives your account a
        fresh one. You stay signed in.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>Children, answers, reports and plans</li>
        <li>The whole conversation, and Homa&apos;s memories of it</li>
        <li>Materials, hours, and anything scheduled</li>
      </ul>
      <button
        type="button"
        onClick={() => void run()}
        disabled={phase === "working"}
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === "working" ? "Resetting…" : "Reset and start over"}
      </button>
      {message ? <p className="mt-3 text-sm text-body">{message}</p> : null}
      <p className="mt-6 text-xs text-subtle">
        Development only. This route does not exist in production, and it refuses any
        family not marked as a test family.
      </p>
    </div>
  );
}
