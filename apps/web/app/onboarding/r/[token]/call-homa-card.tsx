"use client";

import { useState } from "react";

/**
 * The "Call Homa" curriculum feature (founder decision 2026-07-07):
 * Homa reviews this report on a real phone call, digs deeper, and
 * builds a curriculum from it, shown on /home once ready. Reuses the
 * same phone number as texting (family_phones); a family with one
 * already linked skips straight to calling.
 */
export function CallHomaCard({
  childId,
  childName,
  familyPhone,
}: {
  childId: string;
  childName: string;
  familyPhone: string | null;
}) {
  const [phone, setPhone] = useState(familyPhone ?? "");
  const [state, setState] = useState<"idle" | "busy" | "called" | "error" | "no-session">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function call() {
    setState("busy");
    setError(null);
    try {
      const response = await fetch("/api/voice/curriculum/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, ...(phone.trim() ? { phone: phone.trim() } : {}) }),
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
            ? "Add your cell number first."
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
      <div className="mt-9 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
        <p className="font-display text-lg font-semibold text-strong">
          I&apos;m calling you now.
        </p>
        <p className="mt-1 text-sm text-body">
          We&apos;ll talk through {childName}&apos;s report together, and I&apos;ll build a
          curriculum from the conversation. It shows up on your home page once
          it&apos;s ready.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-9 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
      <p className="font-display text-lg font-semibold text-strong">
        Want me to call you about {childName}&apos;s report?
      </p>
      <p className="mt-1 text-sm text-body">
        I&apos;ll call your phone (yes, me, Homa) and walk through what I found.
        Ask me anything. From that conversation I&apos;ll build {childName}&apos;s
        curriculum.
      </p>
      {state === "no-session" ? (
        <p className="mt-3 text-xs text-muted">
          This works on the device you used for the questionnaire, or open your
          email link here first.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="mobile tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(954) 555-0123"
            className="min-h-11 rounded-md border-[1.5px] border-border px-3 py-2 text-sm text-strong focus:border-[var(--clay-400)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void call()}
            disabled={state === "busy"}
            className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
          >
            {state === "busy" ? "Calling\u2026" : "Call me"}
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
