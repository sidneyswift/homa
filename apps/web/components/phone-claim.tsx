"use client";

import { useState } from "react";

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

/**
 * The verified phone claim (sms-onboarding-plan U2/U7): shown wherever
 * a number turns out to belong to another family. Texts a 6-digit code
 * to the number; a correct code routes the number to the caller's own
 * family (server rules in lib/phone-claim.ts). Used by the settings
 * texting card and the onboarding family step.
 */
export function PhoneClaim({
  phoneDisplay,
  phone,
  onClaimed,
}: {
  /** Formatted for copy: "(954) 555-0123". */
  phoneDisplay: string;
  /** The raw value to submit, as the user typed it. */
  phone: string;
  onClaimed: () => void;
}) {
  const [phase, setPhase] = useState<"offer" | "code" | "done">("offer");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/phone-claim/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (data.ok) {
        setPhase("code");
      } else if (data.reason === "send-limit") {
        setError("That number has had its three codes for today. Try again tomorrow.");
      } else if (data.reason === "already-yours") {
        setError("That number already reaches this family; nothing to verify.");
      } else {
        setError("The code didn't send. Give it another try in a minute.");
      }
    } catch {
      setError("Couldn't reach us just now. Try again in a minute.");
    }
    setBusy(false);
  }

  async function confirmCode() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/phone-claim/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (data.ok) {
        setPhase("done");
        onClaimed();
      } else if (data.reason === "wrong-code") {
        setError("That code doesn't match. Check the text and try again.");
      } else if (data.reason === "too-many-attempts") {
        setError("Too many tries. Send a fresh code and use that one.");
      } else if (data.reason === "expired" || data.reason === "no-code") {
        setError("That code expired. Send a fresh one.");
        setPhase("offer");
      } else {
        setError("That didn't work. Try once more.");
      }
    } catch {
      setError("Couldn't reach us just now. Try again in a minute.");
    }
    setBusy(false);
  }

  if (phase === "done") {
    return (
      <p className="mt-3 text-sm text-body" role="status">
        Verified. Texts from {phoneDisplay} reach this family now.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface p-4">
      {phase === "offer" ? (
        <>
          <p className="text-sm text-body">
            If {phoneDisplay} is your number, Homa can text it a 6-digit code; entering the
            code moves it here.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={sendCode}
            className="mt-3 min-h-10 rounded-pill border border-border bg-card px-5 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            {busy ? "Sending…" : "Text me the code"}
          </button>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium text-strong" htmlFor="phone-claim-code">
            The 6-digit code from the text
          </label>
          <input
            id="phone-claim-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className={inputClass}
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={confirmCode}
            className="mt-3 min-h-10 rounded-pill border border-border bg-card px-5 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
          >
            {busy ? "Checking…" : "Verify"}
          </button>
        </>
      )}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
