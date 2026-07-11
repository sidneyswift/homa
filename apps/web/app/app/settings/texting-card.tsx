"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { PhoneClaim } from "../../../components/phone-claim";
import {
  addFamilyPhoneAction,
  removeFamilyPhoneAction,
  type SetupFormState,
} from "./actions";

const INITIAL_STATE: SetupFormState = { error: null };

const inputClass =
  "mt-2 w-full rounded-md border border-border px-4 py-3 text-base text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export interface LinkedPhone {
  /** Raw +1XXXXXXXXXX, carried into the remove action's hidden field. */
  e164: string;
  /** "(954) 990-3497" for display. */
  display: string;
}

/** One linked number row: the formatted number and its remove action. */
function LinkedPhoneRow({ phone }: { phone: LinkedPhone }) {
  const [state, action, pending] = useActionState(removeFamilyPhoneAction, INITIAL_STATE);

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
      <span className="text-base text-strong">{phone.display}</span>
      <form action={action}>
        <input type="hidden" name="phone" value={phone.e164} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill border border-border px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand disabled:opacity-60"
        >
          {pending ? "Removing…" : "Remove"}
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
 * The phone numbers card on /settings: lists every cell linked to the
 * family (one per parent since multi-parent v0, plan 2026-07-11) and
 * lets a parent add another or remove one. Account settings, not a
 * texting-feature gate: numbers save the same way whether or not this
 * deployment's Homa texting line is live, so a family's contact info is
 * never lost to a feature flag. Homa's own number, and the
 * texting-specific framing, render only once the deployment has a live
 * line configured.
 */
export function TextingCard({
  linkedPhones,
  homaNumberDisplay,
}: {
  /** Every number linked to the family, oldest first. */
  linkedPhones: LinkedPhone[];
  /** Homa's own texting number, formatted, or null when SMS is off. */
  homaNumberDisplay: string | null;
}) {
  const [state, action, pending] = useActionState(addFamilyPhoneAction, INITIAL_STATE);
  const router = useRouter();
  const hasNumbers = linkedPhones.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">
        {homaNumberDisplay ? "Text with Homa" : "Your phone numbers"}
      </h2>
      <p className="mt-1 text-sm text-body">
        {homaNumberDisplay
          ? hasNumbers
            ? `Texts from these numbers reach your family's Homa. Her number is ${homaNumberDisplay}.`
            : `Add your cell and texts from it will reach your family's Homa. Her number is ${homaNumberDisplay}.`
          : "Save your cells so Homa can reach your family. Once her texting line is live, you'll be able to text her directly too."}
      </p>

      {hasNumbers ? (
        <ul className="mt-4 space-y-2">
          {linkedPhones.map((phone) => (
            <LinkedPhoneRow key={phone.e164} phone={phone} />
          ))}
        </ul>
      ) : null}

      <form action={action}>
        <label className="mt-4 block font-medium text-strong" htmlFor="family-phone">
          {hasNumbers ? "Add another cell number" : "Your cell number"}
        </label>
        <input
          id="family-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="mobile tel"
          placeholder="(954) 555-0123"
          className={inputClass}
        />
        <p className="mt-2 text-xs text-muted">
          {hasNumbers
            ? "Each parent can link their own cell. Standard messaging rates apply."
            : homaNumberDisplay
              ? "Standard messaging rates apply."
              : "You can remove a saved number anytime."}
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

        <button
          type="submit"
          disabled={pending}
          className="mt-5 min-h-12 rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition-colors hover:border-brand disabled:opacity-60"
        >
          {pending ? "Saving…" : hasNumbers ? "Add number" : "Save number"}
        </button>
      </form>
    </div>
  );
}
