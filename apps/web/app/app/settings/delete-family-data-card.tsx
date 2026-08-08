"use client";

import type { BillingProvider } from "@homa/core";
import { useState } from "react";

import { Icon } from "../../../components/design/Icon";
import { deletionConfirmationFor } from "../../../lib/account-deletion-confirmation";

type DeletionState = "idle" | "submitting" | "complete" | "in_progress" | "blocked";

export function DeleteFamilyDataCard({
  familyName,
  billingProvider,
}: {
  familyName: string;
  billingProvider: BillingProvider | null;
}) {
  const expected = deletionConfirmationFor(familyName);
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<DeletionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const billingMessage = billingProvider === "stripe"
    ? "Homa cancels this family’s subscription before deletion."
    : billingProvider === "apple"
      ? "Cancel the App Store subscription first. Homa can start deletion after the subscription ends."
      : billingProvider === "google"
        ? "Cancel the Google Play subscription first. Homa can start deletion after the subscription ends."
        : "If you subscribed through the App Store or Google Play, cancel there first. Homa can start deletion after the subscription ends.";

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
        | { state?: DeletionState; message?: string; accessClosed?: boolean }
        | null;
      if (!response.ok || !result?.state) {
        setState("idle");
        setMessage(result?.message ?? "Homa could not confirm the deletion status. Refresh before trying again.");
        return;
      }
      setState(result.state);
      setMessage(result.message ?? null);
      if (result.accessClosed === true) {
        window.setTimeout(() => {
          window.location.assign("/signin");
        }, 1800);
      }
    } catch {
      setState("idle");
      setMessage("Homa could not confirm the deletion status. Refresh before trying again.");
    }
  }

  return (
    <section className="rounded-lg border border-danger/40 bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-danger/10 p-2 text-danger">
          <Icon name="warning" size={20} />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-strong">Delete this family&apos;s Homa data</h2>
          <p className="mt-1 text-sm leading-6 text-body">
            This permanently deletes this family&apos;s Homa records and stored files. It cannot be undone.
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">
        Want a copy first? <a className="font-medium text-brand underline underline-offset-2" href="/api/account-deletion/export">Download your family record</a>. It includes children, teaching hours, materials and library lists, calendar, saved details, and conversations. Stored files are not included. Downloading is optional and does not delay deletion.
      </p>
      <p className="mt-4 text-sm leading-6 text-body">
        After Homa confirms billing is safe, access to this family closes and Homa stops future reminders before deleting the family&apos;s data. {billingMessage}
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
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-[var(--homa-radius-control)] bg-danger px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "submitting" ? "Deleting…" : "Permanently delete this family’s Homa data"}
      </button>
    </section>
  );
}
