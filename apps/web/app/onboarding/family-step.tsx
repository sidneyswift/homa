"use client";

import { useRef, useState } from "react";

import { US_STATES } from "@homa/core";

import { QuietAction, QuietFeedback, QuietField, QuietFrame } from "../../components/design";
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
    <div data-brand-surface="onboarding-family" className="quiet-onboarding__step">
      <h1 className="font-display text-3xl font-bold leading-tight text-[var(--homa-ink)]">
        {firstName ? `Nice to meet you, ${firstName}.` : "Let's set up your family."}
      </h1>
      <p className="mt-3 text-[var(--homa-ink)]">
        One quick card about your family, then we&apos;ll add your kids.
      </p>

      <QuietFrame as="article" className="quiet-onboarding__form mt-6 p-6">
        <form onSubmit={handleSubmit} noValidate>
          <h2 className="quiet-onboarding__form-title">Create your family</h2>

          <QuietField id="family-name" label="Family name" required className="mt-5">
            <input
              type="text"
              autoFocus
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="The Swift family"
              aria-describedby={error ? "family-form-error" : undefined}
            />
          </QuietField>

          <QuietField id="family-parent-name" label="Your name" required className="mt-4">
            <input
              type="text"
              autoComplete="name"
              value={parentName}
              onChange={(event) => setParentName(event.target.value)}
              placeholder="Sarah Chen"
              aria-describedby={error ? "family-form-error" : undefined}
            />
          </QuietField>

          <QuietField
            id="family-state"
            label="State"
            hint="So Homa can follow your state&apos;s homeschool rules."
            required
            className="mt-4"
          >
            <select
              autoComplete="address-level1"
              value={usState}
              onChange={(event) => setUsState(event.target.value)}
              aria-describedby={error ? "family-form-error" : undefined}
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
          </QuietField>

          <QuietField
            id="family-photo"
            label={<>Your photo <span className="quiet-field__optional">(optional)</span></>}
            hint={
              photoPreview || photo ? (
                <div className="quiet-onboarding__photo-row">
                  {photoPreview ? (
                    // Plain <img>: a local object URL preview, nothing for
                    // next/image to optimize.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Your profile photo preview"
                      className="quiet-onboarding__photo-preview"
                    />
                  ) : null}
                  {photo ? (
                    <QuietAction
                      kind="quiet"
                      type="button"
                      className="quiet-onboarding__remove-action"
                      onClick={() => {
                        choosePhoto(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </QuietAction>
                  ) : null}
                </div>
              ) : undefined
            }
            className="mt-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
              className="quiet-onboarding__file-input"
              aria-describedby={error ? "family-form-error" : undefined}
            />
          </QuietField>

          {error ? (
            <QuietFeedback id="family-form-error" tone="error" className="mt-4">
              {error}
            </QuietFeedback>
          ) : null}

          <QuietAction type="submit" disabled={busy} size="large" className="mt-6 w-full">
            {busy ? "Saving…" : "Continue"}
          </QuietAction>
        </form>
      </QuietFrame>
    </div>
  );
}
