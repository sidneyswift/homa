"use client";

import { useActionState, useRef, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { uploadAvatarPhoto } from "../../../lib/avatar-upload";
import { ConfirmRemoveButton } from "../../../components/dashboard/confirm-remove-button";
import { PhoneClaim } from "../../../components/phone-claim";
import {
  cancelInviteAction,
  inviteCoParentAction,
  removeFamilyPhoneAction,
  type SetupFormState,
} from "./actions";
import { updateMyProfileAction } from "./profile-actions";
import { SectionHeading } from "./section-heading";

/**
 * The parents section of the one family card on /app/settings (settings
 * consolidation, founder direction 2026-07-12): every adult with their
 * own photo, email, and cell number on one row; the "Main account" tag
 * on the family's first adult (migration #72's ruling: Homa's task
 * texts go to the account owner); the signed-in adult's editor for
 * name, photo, and number; Homa's own texting number; open invites; and
 * the invite form behind a button. The old Text-with-Homa card
 * dissolved into this section: a number is a fact about a person.
 */

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-card px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

const rowButtonClass =
  "min-h-9 cursor-pointer rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand hover:text-strong disabled:opacity-60";

export interface AdultRow {
  userId: string;
  /** "Sidney", or "Parent" when no display name is set yet. */
  name: string;
  isYou: boolean;
  /** The family's first adult: set up the account, gets task texts. */
  isPrimary: boolean;
  avatarUrl: string | null;
  email: string | null;
  /** "(954) 990-3497", or null when no cell is linked. */
  phoneDisplay: string | null;
}

export interface PendingInviteRow {
  id: string;
  email: string;
  /** "Invite sent Jul 11" */
  sentDisplay: string;
}

/** A number linked before per-member attribution; nobody's row owns it. */
export interface LegacyPhoneRow {
  e164: string;
  display: string;
}

function AdultAvatar({ adult, size }: { adult: AdultRow; size: number }) {
  if (adult.avatarUrl) {
    return (
      // Plain <img>: a remote Supabase storage URL; next/image would need
      // remotePatterns config for a tiny avatar (same call as AccountMenu).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={adult.avatarUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border border-border-subtle object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--sage-500)] text-base font-bold text-white"
      aria-hidden="true"
    >
      {adult.name.charAt(0)}
    </span>
  );
}

function AdultRowLine({
  adult,
  showPrimaryTag,
}: {
  adult: AdultRow;
  /** The tag only means something next to a second adult: single-parent
   * families (most) never see it (2026-07-13 UX read: explainers were
   * rendering for people they don't apply to). */
  showPrimaryTag: boolean;
}) {
  return (
    <span className="min-w-0 flex-1">
      {/* The name line wraps (never truncates): on a 390px screen the
          Main account tag must stay readable, not clipped. */}
      <span className="block font-semibold text-strong">
        {adult.name}
        {adult.isYou ? <span className="font-normal text-muted"> (you)</span> : null}
        {showPrimaryTag && adult.isPrimary ? (
          <span className="ml-2 inline-flex whitespace-nowrap rounded-pill bg-[var(--stone-100)] px-2 py-0.5 align-middle text-[0.66rem] font-bold uppercase tracking-[0.06em] text-muted">
            Main account
          </span>
        ) : null}
      </span>
      {adult.email ? <span className="block truncate text-sm text-muted">{adult.email}</span> : null}
      {adult.phoneDisplay ? (
        <span className="block text-sm text-muted">{adult.phoneDisplay}</span>
      ) : null}
    </span>
  );
}

/** The signed-in adult's row with its name-photo-number editor. */
function MyAdultItem({
  adult,
  showPrimaryTag,
  openPhoneEditorInitially,
}: {
  adult: AdultRow;
  showPrimaryTag: boolean;
  openPhoneEditorInitially: boolean;
}) {
  const [editing, setEditing] = useState(openPhoneEditorInitially);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  function choosePhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  // Upload rides inside the action so the photo, name, and number save
  // together; the server re-checks the URL points at our bucket and
  // swaps the linked number only when it actually changed.
  const [state, action, pending] = useActionState(
    async (prev: SetupFormState, formData: FormData): Promise<SetupFormState> => {
      if (photo) {
        const url = await uploadAvatarPhoto(photo);
        if (!url) {
          return { error: "That photo didn't upload. Try a different one, or save without a photo." };
        }
        formData.set("avatar_url", url);
      }
      const result = await updateMyProfileAction(prev, formData);
      if (result.saved) {
        setEditing(false);
        choosePhoto(null);
      }
      return result;
    },
    INITIAL_STATE,
  );

  return (
    <li className="py-3 first:pt-1 last:pb-0">
      <div className="flex items-center gap-3">
        <AdultAvatar adult={adult} size={40} />
        <AdultRowLine adult={adult} showPrimaryTag={showPrimaryTag} />
        {editing ? null : (
          <button type="button" onClick={() => setEditing(true)} className={rowButtonClass}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form action={action} className="mt-3 rounded-md bg-page p-4">
          <label className="block text-sm font-medium text-strong" htmlFor="my-display-name">
            Your name
          </label>
          <input
            id="my-display-name"
            name="display_name"
            type="text"
            required
            defaultValue={adult.name}
            autoComplete="name"
            className={inputClass}
          />

          <label className="mt-4 block text-sm font-medium text-strong" htmlFor="my-photo">
            Your photo
          </label>
          <div className="mt-2 flex items-center gap-3">
            {photoPreview ? (
              // Local object URL preview, nothing for next/image to do.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Your new photo"
                className="h-10 w-10 rounded-full border border-border object-cover"
              />
            ) : (
              <AdultAvatar adult={adult} size={40} />
            )}
            <input
              ref={fileInputRef}
              id="my-photo"
              type="file"
              accept="image/*"
              onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
              className="min-w-0 text-sm text-body file:mr-3 file:cursor-pointer file:rounded-pill file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-sm file:font-semibold file:text-strong hover:file:border-brand"
            />
          </div>

          <label className="mt-4 block text-sm font-medium text-strong" htmlFor="my-phone">
            Your cell number
          </label>
          <input
            id="my-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="mobile tel"
            autoFocus={openPhoneEditorInitially}
            defaultValue={adult.phoneDisplay ?? ""}
            placeholder="Ten digits, like 954 555 0123"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-muted">
            Texts from this number reach your family&apos;s Homa. Clear it to unlink.
            Standard messaging rates apply.
          </p>

          {state.error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.phoneTaken ? (
            <PhoneClaim
              phone={state.phoneTaken}
              phoneDisplay={state.phoneTaken}
              onClaimed={() => router.refresh()}
            />
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
              onClick={() => {
                setEditing(false);
                choosePhoto(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
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

/** One open invite: the address, when it went out, and its cancel action. */
function PendingInviteItem({ invite }: { invite: PendingInviteRow }) {
  const [state, action, pending] = useActionState(cancelInviteAction, INITIAL_STATE);

  return (
    <li className="py-3 last:pb-0">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-base font-bold text-subtle"
          aria-hidden="true"
        >
          {invite.email.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-strong">{invite.email}</span>
          <span className="block text-sm text-muted">{invite.sentDisplay}</span>
        </span>
        <form action={action}>
          <input type="hidden" name="invite_id" value={invite.id} />
          <button type="submit" disabled={pending} className={rowButtonClass}>
            {pending ? "Canceling\u2026" : "Cancel invite"}
          </button>
        </form>
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}

/** A linked number no adult's row owns (pre-attribution rows). */
function LegacyPhoneItem({ phone }: { phone: LegacyPhoneRow }) {
  const [state, action, pending] = useActionState(removeFamilyPhoneAction, INITIAL_STATE);

  return (
    <li className="py-3 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-strong">{phone.display}</span>
          <span className="block text-sm text-muted">Linked number</span>
        </span>
        <form action={action}>
          <input type="hidden" name="phone" value={phone.e164} />
          <ConfirmRemoveButton pending={pending} ariaLabel={`Remove ${phone.display}`} />
        </form>
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}

/** The invite form, tucked behind its button so the list leads. */
function InviteDisclosure() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: SetupFormState, formData: FormData) => {
      const result = await inviteCoParentAction(prev, formData);
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
        Invite another parent
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 rounded-md bg-page p-4">
      <p className="font-medium text-strong">Invite another parent</p>
      <p className="mt-1 text-sm text-body">
        They&apos;ll see everything here: the kids, every conversation with Homa so
        far, and all your materials. They sign in with their own Google or email.
      </p>
      <label className="mt-3 block text-sm font-medium text-strong" htmlFor="invite-email">
        Their email
      </label>
      <input
        id="invite-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder="name@example.com"
        className={inputClass}
      />
      <p className="mt-2 text-xs text-muted">
        The emailed link works for 7 days. If they&apos;ve never used Homa, signing
        in creates their account.
      </p>
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
          {pending ? "Sending\u2026" : "Send invite"}
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

export function ParentsSection({
  adults,
  pendingInvites,
  legacyPhones,
  homaNumberDisplay,
  homaNumberE164,
  openSignedInAdultPhoneEditor,
}: {
  adults: AdultRow[];
  pendingInvites: PendingInviteRow[];
  legacyPhones: LegacyPhoneRow[];
  /** Homa's own texting number, formatted, or null when SMS is off. */
  homaNumberDisplay: string | null;
  homaNumberE164: string | null;
  /** Opens only the authenticated adult's existing profile editor. */
  openSignedInAdultPhoneEditor: boolean;
}) {
  // The main-account concept only exists once a second adult (or an
  // invite on its way to one) is in the picture; the self-edit rule is
  // only worth stating when another adult's row visibly has no Edit
  // (2026-07-13 UX read: Ben's missing Edit was a silent dead end).
  const multiAdult = adults.length > 1 || pendingInvites.length > 0;
  const hasOtherAdult = adults.some((adult) => !adult.isYou);

  return (
    <div id="parents">
      <SectionHeading>Parents</SectionHeading>
      {multiAdult && adults.some((adult) => adult.isPrimary) ? (
        <p className="mt-2 text-sm text-body">
          The main account set up Homa and gets her task texts.
        </p>
      ) : null}
      <ul className="divide-y divide-[var(--stone-100)]">
        {adults.map((adult) =>
          adult.isYou ? (
            <MyAdultItem
              key={adult.userId}
              adult={adult}
              showPrimaryTag={multiAdult}
              openPhoneEditorInitially={openSignedInAdultPhoneEditor}
            />
          ) : (
            <li key={adult.userId} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
              <AdultAvatar adult={adult} size={40} />
              <AdultRowLine adult={adult} showPrimaryTag={multiAdult} />
            </li>
          ),
        )}
        {pendingInvites.map((invite) => (
          <PendingInviteItem key={invite.id} invite={invite} />
        ))}
        {legacyPhones.map((phone) => (
          <LegacyPhoneItem key={phone.e164} phone={phone} />
        ))}
      </ul>
      {hasOtherAdult ? (
        <p className="mt-1 text-xs text-muted">Each parent edits their own info.</p>
      ) : null}

      {homaNumberDisplay && homaNumberE164 ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-body">
          {/* sms:, never tel:: tapping this opens Messages, it never
              dials. whitespace-nowrap: the number itself must never
              split across lines (2026-07-13 UX read). */}
          <a
            href={`sms:${homaNumberE164}`}
            className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-pill border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
          >
            <MessageCircle size={15} className="text-brand" aria-hidden="true" />
            Text Homa {"\u00b7"} {homaNumberDisplay}
          </a>
          <span className="text-muted">Only texts from the numbers above reach her.</span>
        </p>
      ) : null}

      <InviteDisclosure />
    </div>
  );
}
