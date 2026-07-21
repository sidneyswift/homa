"use client";

import { useEffect, useRef, useState } from "react";

import { MAP_SUBJECTS } from "@homa/core";

import { Logo } from "../../components/brand/Logo";
import type { ReportCardData } from "./onboarding-cards";

/**
 * The reveal, in the conversation
 * (plans/2026-07-21-chat-first-onboarding.md §8.3).
 *
 * This is the single biggest structural change in chat-first onboarding.
 * Today a family earns a report and gets an email, and one in four never
 * opens the link. Here the report arrives where she already is.
 *
 * Two acts, from the parts the flow already proved:
 *
 * Act 1 is the wait, and the wait IS the value narration. Staged lines
 * land at 700ms with a check turning sage behind them, exactly as the
 * scoring step does, and the card holds its floor even when the server
 * answered in 200ms. Shortening it would make the work look like
 * nothing happened.
 *
 * Act 2 is the reading: what her own answers placed, strongest first, in
 * her child's name. The whole report opens from here.
 *
 * The scoring itself already happened in the tool. What this card
 * finishes is the slow half the tool deliberately skipped: the report's
 * written narrative and the emailed copy, both through the existing
 * scoring route, which has the long function and the background hook
 * built for exactly that. It is idempotent, so a remount costs nothing.
 */

const LINE_STAGGER_MS = 700;
/** Two staggers plus a breath, the scoring step's own floor. */
const MINIMUM_HOLD_MS = LINE_STAGGER_MS * 2 + 800;

/**
 * The reveal's own view beacon, on the same route the report page uses.
 * entry "chat" is what makes the rebuild's central claim measurable: one
 * family in four never opened the emailed link, and this is the field
 * that says whether being shown the report beats being sent it.
 */
function beaconChatReveal(token: string): void {
  void fetch("/api/map/report-viewed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, entry: "chat" }),
    keepalive: true,
  }).catch(() => {
    // Analytics never surface to her.
  });
}

function finalizeReport(childId: string): void {
  void fetch("/api/map/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId }),
    keepalive: true,
  }).catch(() => {
    // The report page falls back to template sentences when the
    // narrative is missing, so a failure here costs the written words
    // and nothing else. Never show her an error for it.
  });
}

export function ReportRevealCard({
  card,
  active,
  onOpenReport,
}: {
  card: ReportCardData;
  active: boolean;
  onOpenReport?: (childId: string) => void;
}) {
  const lines = [
    `Reading ${card.childName}'s answers…`,
    `Placing ${MAP_SUBJECTS.length} subjects…`,
    `Finding ${card.childName}'s strengths…`,
  ];
  // A card already in scrollback has been read; only a live reveal
  // plays. Scoring that already happened does not get narrated twice.
  const [revealed, setRevealed] = useState(() => !active || card.alreadyScored);
  const [shownLines, setShownLines] = useState(() =>
    !active || card.alreadyScored ? lines.length : 1,
  );
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (!card.alreadyScored) finalizeReport(card.childId);
    // Only a live reveal counts as a view. A card scrolled past in
    // yesterday's transcript is scrollback, not a reading.
    if (active) beaconChatReveal(card.token);
  }, [card.childId, card.alreadyScored, card.token, active]);

  useEffect(() => {
    if (revealed) return;
    const timers = lines.slice(1).map((_line, index) =>
      setTimeout(() => setShownLines(index + 2), (index + 1) * LINE_STAGGER_MS),
    );
    const reveal = setTimeout(() => setRevealed(true), MINIMUM_HOLD_MS);
    return () => {
      for (const timer of timers) clearTimeout(timer);
      clearTimeout(reveal);
    };
    // The line list is derived from the card, which never changes for a
    // mounted message; re-running on its identity would restart the beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  if (!revealed) {
    return (
      <section
        aria-busy="true"
        aria-label={`Building ${card.childName}'s progress report`}
        className="w-full max-w-[26rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      >
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
          <Logo size={15} variant="mark" />
          {card.childName}
        </p>
        <div className="mt-3">
          {lines.slice(0, shownLines).map((line, index) => (
            <p
              key={line}
              className="nb-line mt-2 flex items-center gap-2 text-body first:mt-0"
            >
              <span
                aria-hidden="true"
                className={index < shownLines - 1 ? "text-sage" : "text-subtle"}
              >
                {index < shownLines - 1 ? "✓" : "○"}
              </span>
              {line}
            </p>
          ))}
        </div>
        <p className="mt-4 font-hand text-xl text-sage">worth the wait {"✎"}</p>
      </section>
    );
  }

  // Spent: the settled receipt, tapping through to the report itself.
  if (!active) {
    return (
      <p className="inline-flex max-w-full items-baseline gap-1.5 self-start rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs">
        <span className="font-semibold text-sage">Report ready</span>
        <span className="truncate text-body">{card.childName}</span>
      </p>
    );
  }

  const skippedLine =
    card.skipped > 0
      ? `You skipped ${card.skipped}. The map just leaves those edges open.`
      : null;

  return (
    <section
      className="w-full max-w-[26rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      aria-label={`${card.childName}'s progress report`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
          {card.childName}
        </span>
        <p className="shrink-0 font-mono text-xs text-subtle">
          {card.mappedSubjects} of {card.totalSubjects} placed
        </p>
      </div>
      <p className="mt-3 font-display text-lg font-semibold leading-snug text-strong">
        {card.childName}&apos;s progress report is ready.
      </p>
      <p className="mt-1.5 text-sm text-muted">
        Built from your {card.answered} {card.answered === 1 ? "answer" : "answers"}.
        {skippedLine ? ` ${skippedLine}` : ""}
      </p>
      {card.strengths.length > 0 ? (
        <div className="mt-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-subtle">
            Strongest right now
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.strengths.map((strength) => (
              <span
                key={strength}
                className="rounded-pill border border-sage/30 bg-sage/10 px-2.5 py-1 text-xs text-body"
              >
                {strength}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        disabled={onOpenReport === undefined}
        onClick={() => onOpenReport?.(card.childId)}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        See the whole report
      </button>
    </section>
  );
}
