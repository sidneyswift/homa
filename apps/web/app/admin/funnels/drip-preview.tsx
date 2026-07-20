"use client";

import { useActionState } from "react";

import { sendDripPreviewAction, type DripPreviewState } from "../actions";

/**
 * The onboarding-drip preview panel (funnel work 2026-07-20). Each button
 * sends one nudge template to the founder's own inbox so the copy can be
 * read for real before the drip is ever un-darkened. The automated sweep
 * stays gated on HOMA_DRIP_ENABLED; this panel does not.
 */

const INITIAL_STATE: DripPreviewState = { error: null };

const PREVIEWS: { kind: string; label: string; note: string }[] = [
  { kind: "setup", label: "Setup nudge", note: "signed up, no report yet" },
  { kind: "report", label: "Report ready", note: "emailed, never opened" },
  { kind: "add_kid", label: "Add a kid", note: "one kid, room for more" },
];

const SENT_LABEL: Record<string, string> = {
  setup: "Setup nudge",
  report: "Report ready",
  add_kid: "Add a kid",
};

export function DripPreview({ founderEmail }: { founderEmail: string }) {
  const [state, action, pending] = useActionState(sendDripPreviewAction, INITIAL_STATE);

  return (
    <div className="mt-3 rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
      <p className="text-sm text-body">
        The drip is off (HOMA_DRIP_ENABLED). Send any nudge to yourself
        ({founderEmail}) to read the copy in a real inbox. Nothing goes to a
        family.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PREVIEWS.map((preview) => (
          <form key={preview.kind} action={action}>
            <input type="hidden" name="kind" value={preview.kind} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill border-[1.5px] border-[var(--sage-300)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--sage-700)] transition hover:bg-[var(--sage-50)] disabled:opacity-60"
            >
              {pending ? "Sending…" : `Send me: ${preview.label}`}
              <span className="ml-1 font-normal text-subtle">({preview.note})</span>
            </button>
          </form>
        ))}
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.sent ? (
        <p className="mt-2 text-sm text-[var(--sage-700)]" role="status">
          Sent the {SENT_LABEL[state.sent] ?? state.sent} preview to {founderEmail}.
        </p>
      ) : null}
    </div>
  );
}
