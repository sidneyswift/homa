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
 *
 * Act 3 keeps the optional writing honest without making it a gate. The
 * deterministic report and its template fallback both exist as soon as
 * Act 2 does, so its open action is always available. The prose can
 * improve in place when it settles. A parent who asks for the report is
 * asking for the report, not for an optional model-writing job to finish.
 */

const LINE_STAGGER_MS = 700;
/** Two staggers plus a breath, the scoring step's own floor. */
const MINIMUM_HOLD_MS = LINE_STAGGER_MS * 2 + 800;

/**
 * The reveal's rendered beacon. The report page owns the separate open
 * receipt because rendering a card does not prove the parent opened it.
 */
function beaconChatReportRendered(token: string): void {
  void fetch("/api/map/report-rendered", {
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

const NARRATIVE_POLL_MS = 2500;

/**
 * Is the report's written narrative actually done, right now.
 *
 * "writing" is the only value that means keep waiting. "off" (the flag
 * is disabled) and "none" both mean there is nothing to wait FOR, and
 * every other value is a finished attempt, successful or not; the report
 * page already falls back to template sentences on a failed one, so this
 * card only needs to know whether the wait itself is over.
 */
export function narrativeSettled(status: string): boolean {
  return status !== "writing";
}

export function reportRevealCopy(card: Pick<ReportCardData, "childName" | "mappedSubjects" | "answered" | "skipped">): {
  coverage: string;
  heading: string;
  summary: string;
} {
  if (card.mappedSubjects === 0) {
    return {
      coverage: "No subjects mapped yet",
      heading: `${card.childName}'s starting point is saved.`,
      summary: "These answers did not give Homa enough subject evidence to label a strength or next step yet. Add what you do know after a real lesson, and this report will grow from there.",
    };
  }

  const skippedLine = card.skipped > 0
    ? ` ${card.skipped} ${card.skipped === 1 ? "answer is" : "answers are"} still blank. You can fill them in any time.`
    : "";
  return {
    coverage: `${card.mappedSubjects} subjects covered`,
    heading: `${card.childName}'s progress report is ready.`,
    summary: `Built from your ${card.answered} ${card.answered === 1 ? "answer" : "answers"}.${skippedLine}`,
  };
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
  // Her answers, not the child's: the reader gate caught the same set of
  // answers changing owner between this screen and the next one fifteen
  // seconds later. "Sorting" rather than "placing" because placement is
  // what a school does to a child, and this parent's defining fear is
  // being judged as a teacher.
  const lines = [
    `Reading your answers about ${card.childName}…`,
    `Sorting them across ${MAP_SUBJECTS.length} subjects…`,
    `Finding ${card.childName}'s strengths…`,
  ];
  // A card already in scrollback has been read; only a live reveal
  // plays. Scoring that already happened does not get narrated twice.
  const [revealed, setRevealed] = useState(() => !active || card.alreadyScored);
  const [shownLines, setShownLines] = useState(() =>
    !active || card.alreadyScored ? lines.length : 1,
  );
  const finalizedRef = useRef(false);
  // A report scored in a past turn has had an entire session's worth of
  // wall-clock time to finish writing, so it starts settled; only a
  // fresh live scoring needs to ask the status endpoint at all.
  const [narrativeReady, setNarrativeReady] = useState(
    () => !active || card.alreadyScored,
  );

  useEffect(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (!card.alreadyScored) finalizeReport(card.childId);
    // Only a live card counts as rendered. A card scrolled past in
    // yesterday's transcript is scrollback, not a new handoff.
    if (active) beaconChatReportRendered(card.token);
  }, [card.childId, card.alreadyScored, card.token, active]);

  useEffect(() => {
    if (!active || card.alreadyScored) return;
    let cancelled = false;
    let settled = false;

    async function poll(): Promise<void> {
      try {
        const response = await fetch(
          `/api/map/narrative-status?token=${encodeURIComponent(card.token)}`,
        );
        const data = (await response.json()) as { ok: boolean; status?: string };
        if (cancelled || settled) return;
        if (data.ok && data.status && narrativeSettled(data.status)) {
          settled = true;
          setNarrativeReady(true);
        }
      } catch {
        // The next tick retries. A poll failure is never hers to see;
        // the card just keeps reading "still writing" a little longer.
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), NARRATIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, card.alreadyScored, card.token]);

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
        data-brand-layer="report-reveal"
        className="quiet-report__reveal w-full max-w-[26rem] rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-4 shadow-md sm:p-5"
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
                className={index < shownLines - 1 ? "text-[var(--homa-constructive-ink)]" : "text-[var(--homa-muted-ink)]"}
              >
                {index < shownLines - 1 ? "✓" : "○"}
              </span>
              {line}
            </p>
          ))}
        </div>
      </section>
    );
  }

  // Spent: the settled receipt, tapping through to the report itself.
  if (!active) {
    return (
      <p data-brand-layer="report-reveal" className="inline-flex max-w-full items-baseline gap-1.5 self-start rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-constructive-tint)] px-3 py-1.5 text-xs">
        <span className="font-semibold text-[var(--homa-constructive-ink)]">Progress report ready</span>
        <span className="truncate text-body">{card.childName}</span>
      </p>
    );
  }

  const copy = reportRevealCopy(card);

  return (
    <section
      data-brand-layer="report-reveal"
      className="quiet-report__reveal w-full max-w-[26rem] rounded-[var(--homa-radius-card)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-4 shadow-md sm:p-5"
      aria-label={`${card.childName}'s progress report`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 rounded-[var(--homa-radius-control)] bg-[var(--homa-info-tint)] px-2.5 py-1 text-xs font-bold text-[var(--homa-info-ink)]">
          {card.childName}
        </span>
        <p className="shrink-0 font-mono text-xs text-subtle">
          {copy.coverage}
        </p>
      </div>
      <p className="mt-3 font-display text-lg font-semibold leading-snug text-strong">
        {copy.heading}
      </p>
      <p className="mt-1.5 text-sm text-muted">
        {narrativeReady || card.mappedSubjects === 0
          ? copy.summary
          : (
            // The report page owns a deterministic template fallback. The
            // sentence layer may improve after she opens it, never before.
            "Built from your answers. I'm still polishing the written note, and the full report is ready now."
          )}
      </p>
      {/* "Strongest" is a comparison, so it only renders when there is
          something to compare against: with two subjects covered and
          both listed, the label flatters instead of informs, and the
          persona read caught exactly that ("I answered three questions
          and I'm pretty sure they were math questions"). A strict
          subset keeps the claim traceable to her answers. */}
      {card.strengths.length > 0 && card.strengths.length < card.mappedSubjects ? (
        <div className="mt-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-subtle">
            Strongest subjects right now
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.strengths.map((strength) => (
              <span
                key={strength}
                className="rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-constructive-tint)] px-2.5 py-1 text-xs text-body"
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
        className="quiet-action quiet-action--primary mt-4 min-h-12 w-full px-4 py-3 text-base shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        Open the full report
      </button>
    </section>
  );
}
