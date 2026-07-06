"use client";

import { useEffect, useState } from "react";

import { US_STATES } from "@homa/core";

import { flushWaitlistQueue, submitWaitlist } from "../../lib/waitlist-client";

/**
 * S1: email first, before any work is asked. The lead is the floor;
 * everything after it is upside. If the map session can't start (dead
 * conference wifi), the email still lands via the battle-tested waitlist
 * queue (timeout, retry, localStorage, flush-on-reconnect), so the lead
 * is never lost even when the checklist has to wait.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readUtm(): Record<string, string> {
  const utm: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of params.entries()) {
    if (key.startsWith("utm_") || key === "ref") utm[key] = value.slice(0, 200);
  }
  return utm;
}

export function EmailStep({ onDone }: { onDone: (returning: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [usState, setUsState] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Reassurance (not an error) when the lead was captured via the offline queue. */
  const [notice, setNotice] = useState<string | null>(null);

  // Deliver anything a previous visit left stranded on this device.
  useEffect(() => {
    void flushWaitlistQueue();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);

    if (honeypot.length > 0) {
      onDone(false);
      return;
    }

    try {
      const response = await fetch("/api/map/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          firstName: firstName.trim() || undefined,
          usState: usState || undefined,
          source: "organic",
          utm: readUtm(),
        }),
      });
      const data = (await response.json()) as { ok: boolean; returning?: boolean };
      if (!data.ok) {
        setError("That didn't go through. One more try usually does it.");
        setBusy(false);
        return;
      }
      onDone(Boolean(data.returning));
    } catch {
      // Dead wifi: capture the lead through the offline waitlist queue so
      // the email is never lost, and say so honestly.
      const outcome = await submitWaitlist({
        email: normalized,
        firstName: firstName.trim() || undefined,
        usState: usState || undefined,
        kidCount: undefined,
        kidAgeBands: [],
        source: "organic",
        utm: readUtm(),
      });
      setError(null);
      setNotice(
        outcome === "queued"
          ? "You're offline, so your spot is saved on this device and will send itself when connection returns. The checklist needs a connection, come back to it anytime."
          : "Your spot on the list is saved. The checklist needs a steadier connection, come back to it anytime.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        See where your child stands
      </h1>
      <p className="mt-3 text-body">
        Answer a five-minute checklist about what you&apos;ve seen your child do. Homa checks it
        against national benchmarks for their age and sends you a free progress report.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <label className="block font-medium text-strong" htmlFor="map-email">
          Where should I send the maps?
        </label>
        <input
          id="map-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-2 rounded-md bg-[var(--accent-sage-soft)] p-3 text-sm text-body" role="status">
            {notice}
          </p>
        ) : null}

        <label className="mt-4 block font-medium text-strong" htmlFor="map-first-name">
          First name (optional)
        </label>
        <input
          id="map-first-name"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />

        <label className="mt-4 block font-medium text-strong" htmlFor="map-state">
          Your state (optional)
        </label>
        <select
          id="map-state"
          value={usState}
          onChange={(event) => setUsState(event.target.value)}
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="">Choose a state</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>

        {/* Honeypot: visually hidden, tabbed past by humans, filled by bots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="map-website">Website</label>
          <input
            id="map-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Saving\u2026" : "Start the checklist"}
        </button>
        <p className="mt-3 text-center text-sm text-muted">
          Your email gets each child&apos;s progress report and your founding-family invite. That&apos;s it,
          and you can delete everything anytime.
        </p>
      </form>
    </div>
  );
}
