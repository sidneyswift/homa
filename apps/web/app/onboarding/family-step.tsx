"use client";

import { useRef, useState } from "react";

import { normalizeUsPhoneE164, US_STATES } from "@homa/core";

import { PhoneClaim } from "../../components/phone-claim";
import { uploadAvatarPhoto } from "../../lib/avatar-upload";

/**
 * The create-your-family step (founder call 2026-07-08: one onboarding
 * for every door). Right after the account moment, before kids: family
 * name, the parent's name (prefilled from signup or the Google profile),
 * address, cell number, and an optional profile photo. Visual language
 * matches the add-a-child card (labels above inputs, one card) so the
 * two setup moments read as siblings.
 *
 * The photo uploads straight from the browser to the avatars bucket
 * (owner-scoped storage policies, migration #26) and only its public URL
 * travels to /api/map/family, which re-checks the URL points at our
 * bucket before storing it.
 */

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-card px-4 py-3 text-base text-strong transition-colors duration-(--dur-fast) ease-out focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

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
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [usState, setUsState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTaken, setPhoneTaken] = useState<string | null>(null);
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
    if (!addressLine.trim() || !city.trim() || !usState || !zip.trim()) {
      setError("Add your address, it helps Homa follow your state's homeschool rules.");
      return;
    }
    if (!phone.trim() || !normalizeUsPhoneE164(phone)) {
      setError("That doesn't look like a US cell number. It needs all ten digits.");
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
          addressLine: addressLine.trim(),
          city: city.trim(),
          usState,
          zip: zip.trim(),
          phone: phone.trim(),
          ...(avatarUrl ? { avatarUrl } : {}),
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        reason?: string;
        phoneTaken?: boolean;
      };
      if (!data.ok) {
        setError(
          data.reason === "bad-phone"
            ? "That doesn't look like a US cell number. It needs all ten digits."
            : "That didn't save. One more try usually does it.",
        );
        setBusy(false);
        return;
      }
      if (data.phoneTaken) {
        // Profile saved; the number belongs to another family. Offer
        // the verified claim instead of a dead end (U7); she can also
        // skip it and keep going.
        setPhoneTaken(phone.trim());
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
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        {firstName ? `Nice to meet you, ${firstName}.` : "Let's set up your family."}
      </h1>
      <p className="mt-3 text-body">
        One quick card about your family, then we&apos;ll add your kids.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm"
      >
        <h2 className="font-display text-xl font-semibold text-strong">Create your family</h2>

        <label className="mt-4 block font-medium text-strong" htmlFor="family-name">
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

        <label className="mt-4 block font-medium text-strong" htmlFor="family-parent-name">
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

        <label className="mt-4 block font-medium text-strong" htmlFor="family-address">
          Street address{" "}
          <span className="font-normal text-muted">(so Homa can follow your state&apos;s rules)</span>
        </label>
        {/* address-line1, not street-address: the latter is the token for
            a WHOLE address in one field, and with separate city/state/zip
            fields it makes browser autofill dump everything here. */}
        <input
          id="family-address"
          type="text"
          autoComplete="address-line1"
          required
          value={addressLine}
          onChange={(event) => setAddressLine(event.target.value)}
          placeholder="123 Maple Street"
          className={inputClass}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label className="block font-medium text-strong" htmlFor="family-city">
              City
            </label>
            <input
              id="family-city"
              type="text"
              autoComplete="address-level2"
              required
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block font-medium text-strong" htmlFor="family-state">
              State
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
                State
              </option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-strong" htmlFor="family-zip">
              ZIP
            </label>
            <input
              id="family-zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <label className="mt-4 block font-medium text-strong" htmlFor="family-phone">
          Cell number <span className="font-normal text-muted">(so you can text Homa)</span>
        </label>
        <input
          id="family-phone"
          type="tel"
          inputMode="tel"
          autoComplete="mobile tel"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(954) 555-0123"
          className={inputClass}
        />

        <label className="mt-4 block font-medium text-strong" htmlFor="family-photo">
          Your photo <span className="font-normal text-muted">(optional)</span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          {photoPreview ? (
            // Plain <img>: a local object URL preview, nothing for
            // next/image to optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="Your profile photo preview"
              className="h-12 w-12 rounded-full border border-border object-cover"
            />
          ) : null}
          <input
            ref={fileInputRef}
            id="family-photo"
            type="file"
            accept="image/*"
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
            className="text-sm text-body file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-sm file:font-semibold file:text-strong hover:file:border-brand"
          />
          {photo ? (
            <button
              type="button"
              onClick={() => {
                choosePhoto(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-sm text-subtle underline-offset-2 hover:underline"
            >
              remove
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {phoneTaken ? (
          <>
            <p className="mt-3 text-sm text-body" role="alert">
              Everything saved. That number is connected to a different Homa family right
              now; if it&apos;s yours, verify it and it moves here.
            </p>
            <PhoneClaim
              phone={phoneTaken}
              phoneDisplay={phoneTaken}
              onClaimed={() => setPhoneTaken(null)}
            />
            <button
              type="button"
              onClick={onDone}
              className="mt-4 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
            >
              Continue
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
          >
            {busy ? "Saving\u2026" : "Continue"}
          </button>
        )}
      </form>
    </div>
  );
}
