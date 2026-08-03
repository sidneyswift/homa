"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";

/**
 * The filing card (gh#421): the button that produces the document a
 * family actually sends their state, as opposed to the pack, which
 * explains what their state asks for.
 *
 * Plus and Elite only (founder ruling 4, 2026-07-29). A regular family
 * sees that it exists and is invited to upgrade, which is why the
 * locked branch renders the same description rather than hiding the
 * feature: the point of the tier is that this is worth paying for.
 *
 * Like the pack card, this sends no state and no family data. It asks;
 * the server resolves everything from session auth.
 */
export function StateFilingCard({
  stateName,
  entitled,
  kind,
  dueLabel,
  needsSchoolYearStart,
}: {
  stateName: string;
  entitled: boolean;
  /** What this state's filing is, so the copy can be concrete. */
  kind: "letter" | "worksheet" | "not_required";
  /** "August 15, 2026", or null when Homa cannot date it honestly. */
  dueLabel: string | null;
  /** True when the deadline is countable but the family never said when
   *  their year starts, which is the one thing they can fix themselves. */
  needsSchoolYearStart: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "working" }
    | { kind: "done"; pdfPath: string; gaps: string[] }
    | { kind: "error"; note: string }
  >({ kind: "idle" });

  async function makeFiling() {
    setStatus({ kind: "working" });
    try {
      const response = await fetch("/api/compliance/filing", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; pdfPath: string; gaps?: string[] }
        | { ok: false; note?: string }
        | null;
      if (!body || !("ok" in body) || !body.ok) {
        setStatus({
          kind: "error",
          note:
            (body && "note" in body && body.note) ||
            "The filing maker had trouble just now. Nothing was saved; try again in a moment.",
        });
        return;
      }
      setStatus({
        kind: "done",
        pdfPath: body.pdfPath,
        gaps: body.gaps ?? [],
      });
      window.open(body.pdfPath, "_blank", "noopener");
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        note: "The filing maker had trouble just now. Nothing was saved; try again in a moment.",
      });
    }
  }

  const describe =
    kind === "not_required"
      ? `${stateName} does not ask you to file anything. Homa can make you a short sheet saying so, for your records.`
      : kind === "letter"
        ? `A ready-to-sign letter for ${stateName}, filled in with your family's details and carrying every assurance ${stateName} asks for. You sign it and send it.`
        : `${stateName} uses its own form, so Homa fills a sheet you copy across, with your family's details already in place.`;

  return (
    <QuietFrame tone="paper" as="section" className="p-6">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        {dueLabel ? `Your filing · due ${dueLabel}` : "Your filing"}
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold text-[color:var(--homa-ink)]">
        What you send {stateName}
      </h2>
      <p className="mt-2 max-w-[42rem] text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">{describe}</p>

      {entitled ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuietAction
              onClick={makeFiling}
              disabled={status.kind === "working"}
              icon={status.kind === "working" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--homa-paper)] border-t-transparent" /> : <Icon name="print" size={16} />}
            >
              {status.kind === "working" ? (
                "Filling it in..."
              ) : (
                "Get your filing"
              )}
            </QuietAction>
            {status.kind === "done" ? (
              <a
                href={status.pdfPath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-[color:var(--homa-brand-text)] underline underline-offset-2"
              >
                Open it
              </a>
            ) : null}
          </div>
          {status.kind === "done" && status.gaps.length > 0 ? (
            // Named rather than counted: a family who knows it is three
            // blanks and which three can finish them at the kitchen table.
            <QuietStatus tone="attention" className="mt-3 p-3">
              <p className="text-sm font-semibold text-[color:var(--homa-ink)]">
                {status.gaps.length === 1
                  ? "One blank to fill in by hand"
                  : `${status.gaps.length} blanks to fill in by hand`}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
                {status.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                Homa left these blank rather than guessing. Everything else
                is already filled in.
              </p>
            </QuietStatus>
          ) : null}
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QuietAction href="/app/settings" icon={<Icon name="next" size={16} />}>
            See Homa Plus
          </QuietAction>
          <span className="text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Plus fills your filing in and tells you when it is due.
          </span>
        </div>
      )}

      {status.kind === "error" ? (
        <QuietStatus tone="error" className="mt-3 text-sm">{status.note}</QuietStatus>
      ) : null}

      {needsSchoolYearStart ? (
        <p className="mt-3 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
          {stateName} counts your deadline from the day you start your
          school year, so Homa needs that date to tell you when this is
          due.{" "}
          <a
            href="/app/settings"
            className="underline underline-offset-2 hover:text-[color:var(--homa-brand-text)]"
          >
            Add it in settings
          </a>
          .
        </p>
      ) : null}

      <p className="mt-3 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        Homa fills this in for you and does not send it. You send it
        yourself, and Homa never files anything on your behalf.
      </p>
    </QuietFrame>
  );
}
