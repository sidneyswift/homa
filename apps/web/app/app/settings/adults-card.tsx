"use client";

import { useActionState } from "react";

import {
  cancelInviteAction,
  inviteCoParentAction,
  type SetupFormState,
} from "./actions";

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export interface AdultRow {
  /** "Sidney", or "Parent" when no display name is set yet. */
  name: string;
  isYou: boolean;
}

export interface PendingInviteRow {
  id: string;
  email: string;
  /** "Sent July 11" */
  sentDisplay: string;
}

/** One open invite: the address, when it went out, and its cancel action. */
function PendingInviteItem({ invite }: { invite: PendingInviteRow }) {
  const [state, action, pending] = useActionState(cancelInviteAction, INITIAL_STATE);

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-4 py-3">
      <span className="min-w-0">
        <span className="block truncate text-base text-strong">{invite.email}</span>
        <span className="text-xs text-muted">{invite.sentDisplay} · pending</span>
      </span>
      <form action={action}>
        <input type="hidden" name="invite_id" value={invite.id} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill border border-border px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand disabled:opacity-60"
        >
          {pending ? "Canceling…" : "Cancel"}
        </button>
      </form>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The adults card on /settings (multi-parent plan Phase 3): who shares
 * this family's Homa, plus the invite-a-co-parent form. Invites travel
 * by email as a tokenized /join link; the server actions derive the
 * family from the caller's own membership, never the form.
 */
export function AdultsCard({
  adults,
  pendingInvites,
}: {
  adults: AdultRow[];
  pendingInvites: PendingInviteRow[];
}) {
  const [state, action, pending] = useActionState(inviteCoParentAction, INITIAL_STATE);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">
        Parents on this account
      </h2>
      <p className="mt-1 text-sm text-body">
        Homa is for both of you. Another parent signs in with their own Google
        or email. They see everything here: the kids, every conversation with
        Homa so far, and all your materials.
      </p>

      <ul className="mt-4 space-y-2">
        {adults.map((adult, index) => (
          <li
            key={`${adult.name}-${index}`}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <span className="text-base text-strong">{adult.name}</span>
            {adult.isYou ? <span className="text-xs text-muted">You</span> : null}
          </li>
        ))}
        {pendingInvites.map((invite) => (
          <PendingInviteItem key={invite.id} invite={invite} />
        ))}
      </ul>

      <form action={action}>
        <label className="mt-4 block font-medium text-strong" htmlFor="invite-email">
          Invite another parent
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
          They&apos;ll get an email with a link that works for 7 days. Never
          used Homa? Signing in creates their account.
        </p>

        {state.error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 min-h-12 rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </form>
    </div>
  );
}
