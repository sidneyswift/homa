"use client";

import { PhoneForwarded, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

import { lendFounderPhoneAction, returnFounderPhoneAction } from "../../actions";

/**
 * The founder's texting-line switch on a TEST family's file (founder
 * ask 2026-07-14 evening): lend a number from their real family to this
 * test family (two taps; the second names the cost: the real family
 * stops texting while it's here), and send it home with one tap. One
 * number routes to one family, so this is a move, never a share.
 */

function prettyPhone(e164: string): string {
  const digits = e164.replace(/^\+1/, "");
  if (digits.length !== 10) return e164;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const chipClass =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-border bg-card px-2.5 py-1 text-[0.7rem] font-bold text-muted shadow-sm transition-colors hover:text-strong disabled:opacity-50";

export function PhoneLendControls({
  familyId,
  linkedPhones,
  homeFamilyName,
  homePhones,
}: {
  familyId: string;
  /** Numbers currently routing to THIS test family. */
  linkedPhones: string[];
  /** The founder's real family, the lend source and return home. */
  homeFamilyName: string | null;
  homePhones: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [armedPhone, setArmedPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lend = (phone: string) => {
    if (armedPhone !== phone) {
      setArmedPhone(phone);
      return;
    }
    startTransition(async () => {
      const result = await lendFounderPhoneAction(familyId, phone);
      setError(result.error);
      setArmedPhone(null);
    });
  };

  const sendHome = (phone: string) => {
    startTransition(async () => {
      const result = await returnFounderPhoneAction(familyId, phone);
      setError(result.error);
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {linkedPhones.map((phone) => (
        <button
          key={phone}
          type="button"
          onClick={() => sendHome(phone)}
          disabled={pending}
          className={chipClass}
        >
          <Undo2 size={12} aria-hidden="true" />
          {pending
            ? "Moving\u2026"
            : `Send ${prettyPhone(phone)} home${homeFamilyName ? ` to ${homeFamilyName}` : ""}`}
        </button>
      ))}
      {homePhones
        .filter((phone) => !linkedPhones.includes(phone))
        .map((phone) => (
          <button
            key={phone}
            type="button"
            onClick={() => lend(phone)}
            disabled={pending}
            className={chipClass}
          >
            <PhoneForwarded size={12} aria-hidden="true" />
            {pending
              ? "Moving\u2026"
              : armedPhone === phone
                ? `${homeFamilyName ?? "Your family"} stops texting while it's here \u00b7 tap to confirm`
                : `Text with ${prettyPhone(phone)} here`}
          </button>
        ))}
      {armedPhone && !pending ? (
        <button
          type="button"
          onClick={() => setArmedPhone(null)}
          className="text-[0.7rem] font-semibold text-subtle hover:text-strong"
        >
          Never mind
        </button>
      ) : null}
      {error ? (
        <span className="text-[0.7rem] font-semibold text-[var(--rose-600)]">{error}</span>
      ) : null}
    </span>
  );
}
