"use client";

import { useMemo, useRef, useState } from "react";

import { getMapDomain, planQuestions, type MapAnswer } from "@homa/core";

import type { FlowChild } from "./flow-types";
import { buildQueue } from "./question-queue";
import { ReportRail, type RailSubject } from "./report-rail";

/**
 * S3: the checklist, straight in with no intro screen (read-through ruling:
 * the entry page already set the contract, so the hint rides quietly above
 * the first question instead). One question per screen, four chips, fixed
 * card height so nothing jumps between questions. The adaptive ladder:
 * "easily" unlocks the next rung up, anything else moves on. Every tap
 * saves immediately; failed saves queue and flush before scoring.
 *
 * UX review 2026-07-06 (approved in full):
 * - The report rail assembles beside the questions (ReportRail), so the
 *   artifact she came for stays visible while she works toward it.
 * - "subject 4 of 16" became "about 4 min left": 16 subjects reads as
 *   long at the exact moment she's deciding to commit, and time is what
 *   the entry page promised.
 * - Answer chips sit in scale order (Easily to Not sure), one row on
 *   desktop, an ordered stack on small screens; the old 2x2 grid
 *   shuffled the scale.
 * - A tapped chip flashes selected for ~140ms before the next question
 *   arrives; the old instant swap felt like the tap hadn't registered.
 *
 * Second pass, same day ("still seems like a lot going on"): the screen
 * had six stacked bands before the question (mobile report strip, hint
 * bar, meta row, 16 progress dots, domain intro, card). Consolidated to
 * ONE meta row plus the card:
 * - The hint bar, domain intro, and ladder note all share the card's
 *   single kicker slot now (reassurance on the first question, intro on
 *   a new subject, gold ladder line on ladders). Nothing outside the
 *   card mounts or unmounts between questions, so the screen never
 *   shifts mid-flow (the old hint bar unmounted on the FIRST answer and
 *   lurched the whole page).
 * - The 16-segment dot bar is gone: the rail is the progress display on
 *   desktop, and mobile gets one continuous hairline bar instead.
 * - The mobile report strip is gone too (it was a second progress row).
 * - The question centers vertically in the card's fixed height, so the
 *   reserved space reads as intentional breathing room instead of a
 *   void between a top-stuck question and bottom-stuck chips.
 * - The card now carries the screen's strongest elevation (the rail sat
 *   visually higher than the primary surface before).
 * - The in-card "back" (an undo action) was renamed "undo last answer"
 *   so it can't be confused with "back to your family" (navigation)
 *   right below the card.
 */

const CHIP_LABELS: ReadonlyArray<readonly [MapAnswer, string]> = [
  ["easily", "Easily"],
  ["getting_there", "Getting there"],
  ["not_yet", "Not yet"],
  ["not_sure", "Not sure"],
];

/** Rough seconds per remaining subject, tuned so a fresh 16-subject
 * questionnaire reads "about 5 min", matching the entry-page promise. */
const SECONDS_PER_SUBJECT = 18;

const ANSWER_FLASH_MS = 140;

export function ChecklistStep({
  child,
  onComplete,
  onExit,
}: {
  child: FlowChild;
  onComplete: () => void;
  onExit: () => void;
}) {
  const plans = useMemo(() => planQuestions(child.ageMonths), [child.ageMonths]);
  const [answers, setAnswers] = useState<Record<string, MapAnswer>>(child.answers);
  const [flushing, setFlushing] = useState(false);
  const [easilyStreak, setEasilyStreak] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(Object.keys(child.answers).length);
  /** Item ids answered this sitting, so "back" can undo a mis-tap. */
  const [sittingHistory, setSittingHistory] = useState<string[]>([]);
  /** The domain of the last question answered; a different current domain
   * means a fresh subject intro should show. */
  const [lastDomainId, setLastDomainId] = useState<string | null>(null);
  /** The chip just tapped, held briefly so the tap visibly lands. */
  const [flashAnswer, setFlashAnswer] = useState<MapAnswer | null>(null);
  const pendingSaves = useRef<Array<{ itemId: string; answer: MapAnswer }>>([]);

  const queue = buildQueue(plans, answers);
  const current = queue[0];
  const domainsDone = plans.length - new Set(queue.map((entry) => entry.domainId)).size;
  const domain = current ? getMapDomain(current.domainId) : null;
  const isNewDomain = current ? lastDomainId !== current.domainId : false;

  const minutesLeft = Math.max(1, Math.ceil((queue.length * SECONDS_PER_SUBJECT) / 60));
  const timeLabel = queue.length <= 1 ? "almost done" : `about ${minutesLeft} min left`;

  const railSubjects: RailSubject[] = plans.map((plan) => {
    const inQueue = queue.some((entry) => entry.domainId === plan.domainId);
    return {
      id: plan.domainId,
      name: getMapDomain(plan.domainId)?.displayName ?? plan.domainId,
      status: !inQueue ? "done" : plan.domainId === current?.domainId ? "current" : "upcoming",
    };
  });

  async function postAnswer(itemId: string, answer: MapAnswer): Promise<void> {
    try {
      const response = await fetch("/api/map/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, itemId, answer }),
      });
      if (!response.ok) pendingSaves.current.push({ itemId, answer });
    } catch {
      pendingSaves.current.push({ itemId, answer });
    }
  }

  async function flushPending(): Promise<void> {
    const retries = [...pendingSaves.current];
    pendingSaves.current = [];
    for (const entry of retries) {
      await postAnswer(entry.itemId, entry.answer);
    }
  }

  function commitAnswer(answer: MapAnswer) {
    if (!current) return;
    setLastDomainId(current.domainId);
    setEasilyStreak(answer === "easily" ? easilyStreak + 1 : 0);
    setAnsweredCount((count) => count + 1);
    setSittingHistory((history) => [...history, current.item.id]);
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.item.id]: answer }));
    void postAnswer(current.item.id, answer);

    const remaining = buildQueue(plans, { ...answers, [current.item.id]: answer });
    if (remaining.length === 0) {
      setFlushing(true);
      void (async () => {
        await flushPending();
        onComplete();
      })();
    }
  }

  /** Chip taps flash selected briefly before advancing; a second tap
   * during the flash is ignored rather than double-answering. */
  function answerCurrent(answer: MapAnswer) {
    if (!current || flashAnswer !== null) return;
    setFlashAnswer(answer);
    setTimeout(() => {
      setFlashAnswer(null);
      commitAnswer(answer);
    }, ANSWER_FLASH_MS);
  }

  /** Undo the last tap of this sitting; the re-answer overwrites the save. */
  function goBack() {
    const lastId = sittingHistory[sittingHistory.length - 1];
    if (!lastId) return;
    setSittingHistory((history) => history.slice(0, -1));
    setAnswers((currentAnswers) => {
      const next = { ...currentAnswers };
      delete next[lastId];
      return next;
    });
    setAnsweredCount((count) => Math.max(0, count - 1));
    setEasilyStreak(0);
  }

  if (flushing || !current || !domain) {
    return (
      <div aria-busy="true" className="mx-auto max-w-[36rem] rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <p className="font-display text-lg font-semibold text-strong">
          Questionnaire done.
        </p>
        <p className="mt-2 text-body">Saving the last answers{"\u2026"}</p>
      </div>
    );
  }

  // The card's one kicker slot: reassurance on the very first question,
  // the subject intro when a new subject opens, the gold ladder line on
  // ladder questions. One slot, so nothing above the question ever
  // appears or disappears between questions.
  const kicker =
    answeredCount === 0
      ? {
          text: `Answer from what you've seen ${child.name} do. \u201cNot sure\u201d is a real answer.`,
          tone: "muted" as const,
        }
      : current.isLadder
        ? { text: "One more, since that was easy\u2026", tone: "gold" as const }
        : isNewDomain
          ? { text: domain.intro, tone: "muted" as const }
          : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted">
            {child.name} {"\u00b7"} {domain.displayName}
          </p>
          <p className="font-mono text-xs text-subtle">{timeLabel}</p>
        </div>
        {/* One continuous hairline, small screens only: the rail carries
            per-subject progress wherever it fits. */}
        <div className="mt-2 h-1 overflow-hidden rounded-pill bg-border-subtle lg:hidden" aria-hidden="true">
          <div
            className="h-full rounded-pill bg-brand transition-[width] duration-(--dur-base) ease-out"
            style={{ width: `${Math.round((domainsDone / plans.length) * 100)}%` }}
          />
        </div>

        {/* Fixed minimum height so the card never jumps as question length
            changes; the question centers in the leftover space so the
            reserve reads as breathing room, not a void. */}
        <div className="mt-3 flex min-h-[19rem] flex-col rounded-lg border border-border-subtle bg-card p-6 shadow-[var(--shadow-md)]">
          <p
            className={`text-sm font-medium ${
              kicker?.tone === "gold" ? "text-[var(--gold-ink)]" : "text-muted"
            } ${kicker ? "" : "invisible"}`}
          >
            {kicker?.text ?? "\u00a0"}
          </p>
          <div className="flex flex-1 items-center py-4">
            <h2 className="font-display text-xl font-semibold leading-snug text-strong">
              {current.item.statement}?
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            {CHIP_LABELS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => answerCurrent(value)}
                aria-pressed={flashAnswer === value}
                className={`min-h-12 rounded-pill border px-3 py-3 text-sm font-semibold transition duration-(--dur-fast) ease-out motion-safe:active:scale-[var(--press-scale)] ${
                  flashAnswer === value
                    ? "border-brand bg-brand text-on-brand"
                    : "border-border bg-card text-strong hover:border-brand hover:bg-brand-soft"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-4">
              {/* "undo last answer", not "back": "back" next to the
                  "back to your family" navigation link below was two
                  identical affordances with opposite consequences. */}
              {sittingHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-subtle underline-offset-2 hover:underline"
                >
                  undo last answer
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => answerCurrent("skip")}
                className="text-sm text-subtle underline-offset-2 hover:underline"
              >
                skip this one
              </button>
            </span>
            {easilyStreak >= 3 ? (
              <span className="font-hand text-lg text-sage">on a roll {"\u270e"}</span>
            ) : null}
          </div>
        </div>

        {/* "Back to your family", not "finish later (your answers are
            saved)": the "saved" reassurance already lives in the quiet
            header above (OnboardingShell's "Everything saves as you go"),
            repeating it here read as saying the same thing twice on one
            screen. This also answers the real question the old label
            didn't: this is where she'd go to add another kid mid-flow,
            the hub she lands on has an "add another kid" control and a
            "Continue the questionnaire" button for exactly this child. */}
        <button
          type="button"
          onClick={onExit}
          className="mt-6 text-sm text-subtle underline-offset-2 hover:underline"
        >
          {"\u2190"} back to your family
        </button>
      </div>

      <ReportRail childName={child.name} subjects={railSubjects} />
    </div>
  );
}
