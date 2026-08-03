"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { deletionConfirmationFor } from "../../../lib/account-deletion-confirmation";

type DeletionState = "idle" | "submitting" | "complete" | "in_progress" | "blocked";

export function DeleteFamilyDataCard({ familyName }: { familyName: string }) {
  const expected = deletionConfirmationFor(familyName);
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<DeletionState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function deleteFamily(): Promise<void> {
    setState("submitting");
    setMessage(null);
    try {
      const response = await fetch("/api/account-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = (await response.json().catch(() => null)) as
        | { state?: DeletionState; message?: string }
        | null;
      if (!response.ok || !result?.state) {
        setState("idle");
        setMessage(result?.message ?? "That did not go through. Your account is still available.");
        return;
      }
      setState(result.state);
      setMessage(result.message ?? null);
      if (result.state === "complete" || result.state === "in_progress") {
        window.setTimeout(() => {
          window.location.assign("/signin");
        }, 1800);
      }
    } catch {
      setState("idle");
      setMessage("That did not go through. Your account is still available.");
    }
  }

  return (
    <section className="rounded-lg border border-danger/40 bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-danger/10 p-2 text-danger">
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-strong">Delete account and family data</h2>
          <p className="mt-1 text-sm leading-6 text-body">
            This permanently deletes your family&apos;s Homa records and stored files. It cannot be undone.
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">
        Want to keep a copy first? <a className="font-medium text-brand underline underline-offset-2" href="/api/account-deletion/export">Download your family record</a>. Exporting is optional, it will not delay deletion.
      </p>
      <p className="mt-4 text-sm leading-6 text-body">
        Homa stops Stripe billing immediately, signs every parent out, and removes future reminders before erasing your data. App Store or Google Play subscriptions must be cancelled with that store first.
      </p>

      <label className="mt-5 block text-sm font-medium text-strong" htmlFor="delete-family-confirmation">
        Type <span className="font-mono text-[0.82rem]">{expected}</span> to enable deletion
      </label>
      <input
        id="delete-family-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="mt-2 min-h-11 w-full rounded-md border border-border bg-page px-3 text-sm text-strong outline-none transition-shadow placeholder:text-subtle focus:border-danger focus:shadow-focus"
        placeholder={expected}
      />

      {message ? <p className="mt-3 text-sm leading-6 text-body" role="status">{message}</p> : null}
      <button
        type="button"
        onClick={() => void deleteFamily()}
        disabled={confirmation !== expected || state === "submitting" || state === "complete" || state === "in_progress"}
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-pill bg-danger px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "submitting" ? "Deleting…" : "Permanently delete my family"}
      </button>
    </section>
  );
}
