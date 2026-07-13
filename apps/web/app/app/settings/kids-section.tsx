"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import { addChildAction, type SetupFormState } from "./actions";
import { updateChildAction } from "./profile-actions";
import { BirthdayFields } from "./birthday-fields";
import {
  applyKidPhotoToFormData,
  KidPhotoField,
  type KidPhotoState,
} from "./kid-photo-field";
import { SectionHeading } from "./section-heading";
import { interestSuggestions } from "../../../lib/kid-suggestions";
import { TagInput } from "../../onboarding/tag-input";
import { KidAvatar } from "../../../components/dashboard/kid-avatar";

/**
 * The kids section of the one family card on /app/settings: each child
 * visible and editable in place, name and birthday plus the profile the
 * agent reads (interests, focus, notes), the same fields onboarding's
 * extras beat and chat's update_child_profile tool write (founder
 * direction 2026-07-12: kid preferences belong in settings too), and
 * the child's photo behind the D4 consent screen (migration #75).
 */

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-card px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

const rowButtonClass =
  "min-h-9 cursor-pointer rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand hover:text-strong disabled:opacity-60";

export interface KidRow {
  id: string;
  name: string;
  /** ISO birth date from the children row, "2019-03-14". */
  birthDate: string;
  ageMonths: number;
  /** "7y 4m" (ageLabel, computed by the server page). */
  ageDisplay: string;
  /** "Born Mar 14, 2019" (formatted by the server page). */
  birthdayDisplay: string;
  interests: string[];
  focus: string | null;
  notes: string | null;
  /** The kid's profile photo (migration #75); null keeps the initial. */
  avatarUrl: string | null;
  /** Position in the family list, drives the avatar tone. */
  index: number;
}

/** One kid: the row, and the same row opened for editing. */
function KidItem({ kid, photoConsentGranted }: { kid: KidRow; photoConsentGranted: boolean }) {
  const [editing, setEditing] = useState(false);
  const [interests, setInterests] = useState<string[]>(kid.interests);
  const [photo, setPhoto] = useState<KidPhotoState>({ blob: null, remove: false });
  // The wrapper closes the editor on success (the task-form pattern).
  // The prepared photo blob (never the camera original) rides the same
  // FormData, so the photo saves with everything else in one Save.
  const [state, action, pending] = useActionState(
    async (prev: SetupFormState, formData: FormData) => {
      applyKidPhotoToFormData(formData, photo);
      const result = await updateChildAction(prev, formData);
      if (result.saved) {
        setEditing(false);
        setPhoto({ blob: null, remove: false });
      }
      return result;
    },
    INITIAL_STATE,
  );

  return (
    <li className="py-3 first:pt-1 last:pb-0">
      <div className="flex items-center gap-3">
        <KidAvatar name={kid.name} index={kid.index} avatarUrl={kid.avatarUrl} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-strong">{kid.name}</span>
          <span className="block text-sm text-muted">
            {kid.ageDisplay} {"\u00b7"} {kid.birthdayDisplay}
          </span>
          {!editing && kid.interests.length > 0 ? (
            <span className="block truncate text-sm text-muted">
              Into {kid.interests.join(", ")}
            </span>
          ) : null}
        </span>
        {editing ? null : (
          <button
            type="button"
            onClick={() => {
              setInterests(kid.interests);
              setPhoto({ blob: null, remove: false });
              setEditing(true);
            }}
            className={rowButtonClass}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form action={action} className="mt-3 rounded-md bg-page p-4">
          <input type="hidden" name="child_id" value={kid.id} />
          {interests.map((tag) => (
            <input key={tag} type="hidden" name="interests" value={tag} />
          ))}
          <label className="block text-sm font-medium text-strong" htmlFor={`kid-${kid.id}-name`}>
            First name
          </label>
          <input
            id={`kid-${kid.id}-name`}
            name="child_name"
            type="text"
            required
            defaultValue={kid.name}
            className={`${inputClass}`}
          />
          <BirthdayFields idPrefix={`kid-${kid.id}`} defaultDate={kid.birthDate} />

          <KidPhotoField
            kidId={kid.id}
            kidName={kid.name}
            kidIndex={kid.index}
            currentUrl={kid.avatarUrl}
            consentGranted={photoConsentGranted}
            state={photo}
            onChange={setPhoto}
          />

          <div className="mt-4">
            <TagInput
              label={`What is ${kid.name} loving right now?`}
              suggestions={interestSuggestions(kid.ageMonths)}
              tags={interests}
              setTags={setInterests}
              max={8}
            />
          </div>

          <label className="mt-4 block text-sm font-medium text-strong" htmlFor={`kid-${kid.id}-focus`}>
            Where should Homa focus?
          </label>
          <input
            id={`kid-${kid.id}-focus`}
            name="focus"
            type="text"
            defaultValue={kid.focus ?? ""}
            placeholder={"reading, handwriting, confidence\u2026"}
            className={inputClass}
          />

          <label className="mt-4 block text-sm font-medium text-strong" htmlFor={`kid-${kid.id}-notes`}>
            Anything else Homa should know{" "}
            <span className="font-normal text-muted">(health, temperament, whatever helps)</span>
          </label>
          <textarea
            id={`kid-${kid.id}-notes`}
            name="notes"
            rows={2}
            maxLength={1000}
            defaultValue={kid.notes ?? ""}
            className={inputClass}
          />

          {state.error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 cursor-pointer rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {pending ? "Saving\u2026" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-10 cursor-pointer rounded-pill px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-strong"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** The add-a-child form, tucked behind its button so the list leads. */
function AddChildDisclosure() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: SetupFormState, formData: FormData) => {
      const result = await addChildAction(prev, formData);
      if (result.saved) setOpen(false);
      return result;
    },
    INITIAL_STATE,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-card px-5 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand"
      >
        <Plus size={16} aria-hidden="true" />
        Add a child
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 rounded-md bg-page p-4">
      <p className="font-medium text-strong">Add a child</p>
      <label className="mt-3 block text-sm font-medium text-strong" htmlFor="new-child-name">
        First name
      </label>
      <input id="new-child-name" name="child_name" type="text" required className={inputClass} />
      <BirthdayFields idPrefix="new-child" />
      {state.error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 cursor-pointer rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Adding\u2026" : "Add child"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-10 cursor-pointer rounded-pill px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-strong"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function KidsSection({
  kids,
  photoConsentGranted,
}: {
  kids: KidRow[];
  /** families.child_photo_consent_at is stamped (the D4 agreement). */
  photoConsentGranted: boolean;
}) {
  return (
    <div>
      <SectionHeading first>Kids</SectionHeading>
      <ul className="divide-y divide-[var(--stone-100)]">
        {kids.map((kid) => (
          <KidItem key={kid.id} kid={kid} photoConsentGranted={photoConsentGranted} />
        ))}
      </ul>
      <AddChildDisclosure />
    </div>
  );
}
