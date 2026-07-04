"use client";

import { useEffect, useState } from "react";

import {
  KID_AGE_BANDS,
  KID_AGE_BAND_LABELS,
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
 * Wireframe styling only: the visual design pass replaces the look, not the
 * behavior or the copy.
 */

type FormPhase = "editing" | "submitting" | "saved" | "queued";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm({ source }: { source: WaitlistSource }) {
  const [phase, setPhase] = useState<FormPhase>("editing");
  const [email, setEmail] = useState("");
  const [usState, setUsState] = useState("");
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
      usState: usState || undefined,
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
        className="rounded-lg border border-neutral-400 bg-neutral-50 p-6"
      >
        <p className="text-lg font-semibold">You&apos;re on the list.</p>
        <p className="mt-2 text-neutral-700">
          We&apos;re letting families in a few at a time, so every family gets
          real attention. Your invite will come by email.
        </p>
        {phase === "queued" ? (
          <p className="mt-3 text-sm text-neutral-600">
            The wifi here is struggling, so your spot is saved on this phone
            and will send itself the moment signal returns. Keep this page
            open for a minute if you can.
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
      className="rounded-lg border border-neutral-400 p-6"
    >
      <label className="block font-medium" htmlFor="waitlist-email">
        Your email
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
        className="mt-2 w-full rounded-md border border-neutral-500 px-4 py-3 text-base"
      />
      {emailError ? (
        <p className="mt-2 text-sm" role="alert">
          That email doesn&apos;t look complete. Mind checking it?
        </p>
      ) : null}

      <fieldset className="mt-6">
        <legend className="font-medium">
          Optional: a little about your family
        </legend>
        <p className="mt-1 text-sm text-neutral-600">
          So we invite families we&apos;re ready to serve well.
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor="waitlist-state">
          Your state
        </label>
        <select
          id="waitlist-state"
          value={usState}
          onChange={(event) => setUsState(event.target.value)}
          className="mt-2 w-full rounded-md border border-neutral-500 px-4 py-3 text-base"
        >
          <option value="">Choose a state (optional)</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>

        <p className="mt-4 text-sm font-medium">Your kids&apos; ages</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KID_AGE_BANDS.map((band) => {
            const selected = ageBands.includes(band);
            return (
              <button
                key={band}
                type="button"
                onClick={() => toggleAgeBand(band)}
                aria-pressed={selected}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm ${
                  selected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-500 bg-white text-neutral-900"
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
        className="mt-6 min-h-12 w-full rounded-full bg-neutral-900 px-6 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving your spot…" : "Join the founding families waitlist"}
      </button>
      <p className="mt-3 text-center text-sm text-neutral-600">
        We&apos;ll only use your email to send your invite. No spam,
        unsubscribe anytime.
      </p>
    </form>
  );
}
