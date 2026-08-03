"use client";

import { useRef, useState } from "react";

import { US_STATES } from "@homa/core";

import { uploadAvatarPhoto } from "../../lib/avatar-upload";

/**
 * The create-your-family step (founder call 2026-07-08: one onboarding for
 * every door). Right after the account moment, before kids: family name,
 * the parent's name (prefilled from signup or the Google profile), the
 * state, and an optional profile photo.
 *
 * Funnel fix 2026-07-20 (docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md):
 * the mailing address and cell number left this card. Production showed
 * ~17% of new accounts stopping at exactly this screen, before answering a
 * single question, because a full street address and a phone number were
 * demanded before the parent had seen any value. The two heavy, sensitive
 * asks move to an optional "complete your profile" card AFTER the first
 * report is on screen (CompleteProfilePrompt), where the parent has
 * already done the whole assessment and the mailing-address value framing
 * ("so Homa can mail materials and point you to activities near you") can
 * actually land. State stays here: it is one tap, it is not sensitive, and
 * it is the field Homa needs to follow the right state's homeschool rules.
 * The server schema already treats address and phone as optional
 * (mapFamilySetupSchema), so this is a client-only change.
 *
 * The photo uploads straight from the browser to the avatars bucket
 * (owner-scoped storage policies, migration #26) and only its public URL
 * travels to /api/map/family, which re-checks the URL points at our
 * bucket before storing it.
 */

const inputClass =
  "mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-3 text-base text-[var(--homa-ink)] transition-colors duration-(--homa-motion-fast) ease-out focus:border-[var(--homa-visual-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30";

export function FamilyStep({
  firstName,
  lastName,
  onDone,
}: {
  /** From signup (or the Google profile), for prefilling. */
  firstName: string | null;
  lastName: string | null;
  onDone: () => void;
}) {
  const [familyName, setFamilyName] = useState(lastName ? `The ${lastName} family` : "");
  const [parentName, setParentName] = useState(
    [firstName, lastName].filter(Boolean).join(" "),
  );
  const [usState, setUsState] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function choosePhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedFamilyName = familyName.trim();
    const trimmedParentName = parentName.trim().replace(/\s+/g, " ");
    if (!trimmedFamilyName) {
      setError("Add a family name and we're off.");
      return;
    }
    if (!trimmedParentName) {
      setError("Add your name so Homa knows what to call you.");
      return;
    }
    if (!usState) {
      setError("Pick your state, it helps Homa follow your state's homeschool rules.");
      return;
    }
    setError(null);
    setBusy(true);

    let avatarUrl: string | undefined;
    if (photo) {
      const uploaded = await uploadAvatarPhoto(photo);
      if (!uploaded) {
        setError("That photo didn't upload. Try a different one, or remove it and continue.");
        setBusy(false);
        return;
      }
      avatarUrl = uploaded;
    }

    try {
      const response = await fetch("/api/map/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName: trimmedFamilyName,
          parentName: trimmedParentName,
          usState,
          ...(avatarUrl ? { avatarUrl } : {}),
        }),
      });
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (!data.ok) {
        setError("That didn't save. One more try usually does it.");
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError("Couldn't reach us just now. Nothing you typed is lost, try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-[var(--homa-ink)]">
        {firstName ? `Nice to meet you, ${firstName}.` : "Let's set up your family."}
      </h1>
      <p className="mt-3 text-[var(--homa-ink)]">
        One quick card about your family, then we&apos;ll add your kids.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm"
      >
        <h2 className="font-display text-xl font-semibold text-[var(--homa-ink)]">Create your family</h2>

        <label className="mt-4 block font-medium text-[var(--homa-ink)]" htmlFor="family-name">
          Family name
        </label>
        <input
          id="family-name"
          type="text"
          autoFocus
          required
          value={familyName}
          onChange={(event) => setFamilyName(event.target.value)}
          placeholder="The Swift family"
          className={inputClass}
        />

        <label className="mt-4 block font-medium text-[var(--homa-ink)]" htmlFor="family-parent-name">
          Your name
        </label>
        <input
          id="family-parent-name"
          type="text"
          autoComplete="name"
          required
          value={parentName}
          onChange={(event) => setParentName(event.target.value)}
          placeholder="Sarah Chen"
          className={inputClass}
        />

        <label className="mt-4 block font-medium text-[var(--homa-ink)]" htmlFor="family-state">
          State{" "}
          <span className="font-normal text-[var(--homa-muted-ink)]">(so Homa can follow your state&apos;s rules)</span>
        </label>
        <select
          id="family-state"
          autoComplete="address-level1"
          required
          value={usState}
          onChange={(event) => setUsState(event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Pick your state
          </option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>

        <label className="mt-4 block font-medium text-[var(--homa-ink)]" htmlFor="family-photo">
          Your photo <span className="font-normal text-[var(--homa-muted-ink)]">(optional)</span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          {photoPreview ? (
            // Plain <img>: a local object URL preview, nothing for
            // next/image to optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="Your profile photo preview"
              className="h-12 w-12 rounded-full border border-[var(--homa-control-boundary)] object-cover"
            />
          ) : null}
          <input
            ref={fileInputRef}
            id="family-photo"
            type="file"
            accept="image/*"
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
            className="text-sm text-[var(--homa-ink)] file:mr-3 file:cursor-pointer file:rounded-[var(--homa-radius-control)] file:border file:border-[var(--homa-control-boundary)] file:bg-[var(--homa-paper)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--homa-ink)] hover:file:border-[var(--homa-visual-coral)]"
          />
          {photo ? (
            <button
              type="button"
              onClick={() => {
                choosePhoto(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-sm text-[var(--homa-muted-ink)] underline-offset-2 hover:underline"
            >
              remove
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-[var(--homa-error-ink)]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-6 py-3 text-base font-semibold text-[var(--homa-paper)] shadow-sm transition duration-(--homa-motion-fast) ease-out hover:bg-[var(--homa-ink)] motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
