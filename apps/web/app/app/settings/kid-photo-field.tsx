"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { prepareChildPhotoForUpload } from "../../../lib/child-photo-prepare";
import { KidAvatar } from "../../../components/dashboard/kid-avatar";
import { agreeChildPhotoConsentAction } from "./profile-actions";

/**
 * The photo block inside a kid's settings editor (D4 photo
 * personalization, migration #75). Two shapes:
 *
 *   no consent yet · a one-line offer, and behind its button the
 *     dedicated consent screen D4 requires (separate from signup, once
 *     per family). Agreeing stamps the family and reveals the picker.
 *   consented · the picker itself: current photo, choose-a-photo, and
 *     Remove. Changes save with the kid form's own Save.
 *
 * The chosen file is downscaled in the browser immediately
 * (child-photo-prepare: small JPEG, EXIF dropped) and the PREPARED blob
 * is what the form submits; the file input deliberately has no name so
 * the camera original never rides the POST. The parent form applies
 * photo/removePhoto on submit via getPhotoFormData().
 */

// Reworded through both copy gates (2026-07-13): the art tool is named
// plainly (an unnamed "image tool" read as a stranger touching the
// photo), referents stay stable (no bare "it" switching between tool
// and photo), "learns from" replaces the ML word "trains on", and the
// removal line keeps the fact the reader valued most: removed means
// deleted.
const CONSENT_COMMITMENTS = [
  "Photos are used one way: drawing your own family's materials.",
  "Homa draws with an art tool from another company. The tool sees the photo just long enough to draw, and never learns from the photo.",
  "No face recognition, ever.",
  "Remove the photo any time. Removing deletes it, not just hides it.",
];

export interface KidPhotoState {
  /** The prepared (downscaled) photo waiting for Save, if any. */
  blob: Blob | null;
  /** True when Save should clear the existing photo. */
  remove: boolean;
}

export function applyKidPhotoToFormData(formData: FormData, state: KidPhotoState): void {
  if (state.blob) {
    formData.set("child_photo", state.blob, "photo.jpg");
  } else if (state.remove) {
    formData.set("remove_photo", "1");
  }
}

export function KidPhotoField({
  kidId,
  kidName,
  kidIndex,
  currentUrl,
  consentGranted,
  state,
  onChange,
}: {
  kidId: string;
  kidName: string;
  kidIndex: number;
  /** The saved photo on the children row, if any. */
  currentUrl: string | null;
  /** families.child_photo_consent_at is set (or was agreed just now). */
  consentGranted: boolean;
  state: KidPhotoState;
  onChange: (next: KidPhotoState) => void;
}) {
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentedNow, setConsentedNow] = useState(false);
  const [consentPending, startConsent] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const consented = consentGranted || consentedNow;
  const shownUrl = state.blob ? previewUrl : state.remove ? null : currentUrl;

  function setPreview(url: string | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
  }

  async function choosePhoto(file: File | null) {
    setPhotoError(null);
    if (!file) return;
    setPreparing(true);
    try {
      const prepared = await prepareChildPhotoForUpload(file);
      if (!prepared) {
        setPhotoError("That photo didn't open. Try a different photo.");
        return;
      }
      setPreview(URL.createObjectURL(prepared));
      onChange({ blob: prepared, remove: false });
    } finally {
      setPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto() {
    setPreview(null);
    setPhotoError(null);
    // Removing a not-yet-saved pick just cancels the pick (back to the
    // saved photo); removing the saved photo marks it for deletion.
    onChange(state.blob ? { blob: null, remove: false } : { blob: null, remove: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function agree() {
    startConsent(async () => {
      const result = await agreeChildPhotoConsentAction();
      if (result.error) {
        setPhotoError(result.error);
        return;
      }
      setConsentedNow(true);
      setConsentOpen(false);
      // The other kids' editors read the stamp from the page data.
      router.refresh();
    });
  }

  if (!consented) {
    return (
      <div className="mt-4">
        <p className="block text-sm font-medium text-[color:var(--homa-ink)]">{kidName}&apos;s photo</p>
        {consentOpen ? (
          <div className="mt-2 rounded-md border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-4">
            <p className="font-medium text-[color:var(--homa-ink)]">One agreement before the first photo</p>
            <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">
              Homa looks at the photo while drawing {kidName}&apos;s materials. That is
              how {kidName} becomes the main character of a picture book, or the
              astronaut on a coloring page.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--homa-ink-muted)]">
              {CONSENT_COMMITMENTS.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="text-[color:var(--homa-brand-text)]">
                    {"\u2022"}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={agree}
                disabled={consentPending}
                className="min-h-10 cursor-pointer rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-5 py-2 text-sm font-semibold text-[color:var(--homa-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--homa-midnight-action)_88%,var(--homa-ink))] disabled:opacity-60"
              >
                {consentPending ? "Saving\u2026" : "I agree"}
              </button>
              <button
                type="button"
                onClick={() => setConsentOpen(false)}
                className="min-h-10 cursor-pointer rounded-[var(--homa-radius-control)] px-4 py-2 text-sm font-medium text-[color:var(--homa-ink-muted)] transition-colors hover:text-[color:var(--homa-ink)]"
              >
                Not now
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">
              Add a photo and Homa can draw {kidName} into picture books, coloring
              pages, and other materials.
            </p>
            <button
              type="button"
              onClick={() => setConsentOpen(true)}
              className="mt-2 min-h-9 cursor-pointer rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-1.5 text-sm font-medium text-[color:var(--homa-ink-muted)] transition-colors hover:border-[var(--homa-midnight-action)] hover:text-[color:var(--homa-ink)]"
            >
              Add {kidName}&apos;s photo
            </button>
          </>
        )}
        {photoError ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {photoError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-[color:var(--homa-ink)]" htmlFor={`kid-${kidId}-photo`}>
        {kidName}&apos;s photo
      </label>
      <div className="mt-2 flex items-center gap-3">
        {shownUrl ? (
          // Local object URL or our Blob URL; nothing for next/image here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownUrl}
            alt={`${kidName}'s photo`}
            className="h-10 w-10 shrink-0 rounded-full border border-[var(--homa-control-boundary)] object-cover"
          />
        ) : (
          <KidAvatar name={kidName} index={kidIndex} avatarUrl={null} size={40} />
        )}
        {/* A styled button over a hidden input: the native control's
            "Choose file" reads as computer-speak on a phone (reader
            gate 2026-07-13); she picks photos, not files. */}
        <input
          ref={fileInputRef}
          id={`kid-${kidId}-photo`}
          type="file"
          accept="image/*"
          disabled={preparing}
          onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <button
          type="button"
          disabled={preparing}
          onClick={() => fileInputRef.current?.click()}
          className="min-h-9 cursor-pointer rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-1.5 text-sm font-semibold text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)] disabled:opacity-60"
        >
          {shownUrl ? "Change the photo" : "Choose a photo"}
        </button>
        {shownUrl ? (
          <button
            type="button"
            onClick={removePhoto}
            className="min-h-9 shrink-0 cursor-pointer rounded-[var(--homa-radius-control)] px-3 py-1.5 text-sm font-medium text-[color:var(--homa-ink-muted)] transition-colors hover:text-[color:var(--homa-ink)]"
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-[color:var(--homa-ink-muted)]">
        {preparing
          ? "Getting the photo ready\u2026"
          : "Nothing is stored until you tap Save below."}
      </p>
      {photoError ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {photoError}
        </p>
      ) : null}
    </div>
  );
}
