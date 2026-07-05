"use client";

import { useEffect, useState } from "react";

import {
  KID_AGE_BANDS,
  KID_AGE_BAND_LABELS,
  KID_COUNT_MAX,
  US_STATES,
  type KidAgeBand,
  type WaitlistSource,
} from "@homa/core";

import {
  flushWaitlistQueue,
  readUtmFromLocation,
  submitWaitlist,
} from "../lib/waitlist-client";

/**
 * The waitlist capture form (BUILD.md Deliverable 0). Optimistic: the moment
 * a valid email is submitted the UI confirms, while delivery retries in the
 * background and falls back to an on-device queue on dead wifi.
 *
 * Labels stay neutral functional text on purpose (form UX best practice:
 * visible labels, plain error text); visual system is homa-design v3 via the
 * token pass in globals.css.
 */

type FormPhase = "editing" | "submitting" | "saved" | "queued";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm({ source }: { source: WaitlistSource }) {
  const [phase, setPhase] = useState<FormPhase>("editing");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [usState, setUsState] = useState("");
  const [kidCount, setKidCount] = useState<number | null>(null);
  const [ageBands, setAgeBands] = useState<KidAgeBand[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [emailError, setEmailError] = useState(false);

  // Deliver anything a previous visit left stranded on this device.
  useEffect(() => {
    void flushWaitlistQueue();
    const onOnline = () => void flushWaitlistQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  function toggleAgeBand(band: KidAgeBand) {
    setAgeBands((current) =>
      current.includes(band)
        ? current.filter((item) => item !== band)
        : [...current, band],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError(true);
      return;
    }
    setEmailError(false);
    setPhase("submitting");

    if (honeypot.length > 0) {
      // Bot path: confirm and drop, same as the server would.
      setPhase("saved");
      return;
    }

    const outcome = await submitWaitlist({
      email: normalizedEmail,
      firstName: firstName.trim() || undefined,
      usState: usState || undefined,
      kidCount: kidCount ?? undefined,
      kidAgeBands: ageBands,
      source,
      utm: readUtmFromLocation(),
    });
    setPhase(outcome);
  }

  if (phase === "saved" || phase === "queued") {
    return (
      <div
        aria-live="polite"
        className="rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <p className="font-display text-lg font-semibold text-strong">
          You&apos;re on the waitlist.
        </p>
        <p className="mt-2 text-body">Your invite will come by email.</p>
        {phase === "queued" ? (
          <p className="mt-3 text-sm text-muted">
            You&apos;re offline. Your signup is saved on this device and will
            send automatically when connection returns.
          </p>
        ) : null}
      </div>
    );
  }

  const busy = phase === "submitting";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <label className="block font-medium text-strong" htmlFor="waitlist-first-name">
        First name (optional)
      </label>
      <input
        id="waitlist-first-name"
        type="text"
        autoComplete="given-name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />

      <label className="mt-4 block font-medium text-strong" htmlFor="waitlist-email">
        Email
      </label>
      <input
        id="waitlist-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {emailError ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          Enter a valid email address.
        </p>
      ) : null}

      <fieldset className="mt-6">
        <legend className="font-medium text-strong">Family details (optional)</legend>

        <label className="mt-4 block text-sm font-medium text-strong" htmlFor="waitlist-state">
          State
        </label>
        <select
          id="waitlist-state"
          value={usState}
          onChange={(event) => setUsState(event.target.value)}
          className="mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="">Choose a state</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>

        <p className="mt-4 text-sm font-medium text-strong">Number of kids</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: KID_COUNT_MAX }, (_, i) => i + 1).map((count) => {
            const selected = kidCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => setKidCount(selected ? null : count)}
                aria-pressed={selected}
                className={`min-h-11 min-w-11 rounded-pill border px-4 py-2 text-sm transition-colors ${
                  selected
                    ? "border-brand bg-brand text-on-brand"
                    : "border-border bg-card text-strong hover:border-brand"
                }`}
              >
                {count === KID_COUNT_MAX ? `${KID_COUNT_MAX}+` : count}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-medium text-strong">Kids&apos; ages</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KID_AGE_BANDS.map((band) => {
            const selected = ageBands.includes(band);
            return (
              <button
                key={band}
                type="button"
                onClick={() => toggleAgeBand(band)}
                aria-pressed={selected}
                className={`min-h-11 rounded-pill border px-4 py-2 text-sm transition-colors ${
                  selected
                    ? "border-brand bg-brand text-on-brand"
                    : "border-border bg-card text-strong hover:border-brand"
                }`}
              >
                {KID_AGE_BAND_LABELS[band]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Honeypot: visually hidden, tabbed past by humans, filled by bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="waitlist-website">Website</label>
        <input
          id="waitlist-website"
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
        className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Join the waitlist"}
      </button>
      {/* Privacy microcopy stays: form-adjacent trust note is a best practice,
          and this exact claim is the vetted always-true one (build log #1). */}
      <p className="mt-3 text-center text-sm text-muted">
        Your email is only used to send your invite.
      </p>
    </form>
  );
}
