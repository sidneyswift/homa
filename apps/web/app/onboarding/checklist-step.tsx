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
 *
 * Third pass (2026-07-07, "easier to see what kid"): the meta row's
 * "{name} · {subject}" was one plain gray line, easy to lose track of
 * with more than one kid in the sitting. The name is now a small brand
 * chip, visually distinct from the subject label beside it.
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
  /** Item ids answered this sitting, so "back" can undo a mis-tap. */
  const [sittingHistory, setSittingHistory] = useState<string[]>([]);
  /** The domain of the last question answered; a different current domain
   * means a fresh subject intro should show. */
  const [lastDomainId, setLastDomainId] = useState<string | null>(null);
  /** Whether the last question answered was itself a ladder rung: the
   * gold "one more, since that was easy" line should only greet the
   * FIRST rung of a climb, not repeat itself on every rung after
   * (caught 2026-07-07, "gets redundant"). */
  const [lastWasLadder, setLastWasLadder] = useState(false);
  /** The chip just tapped, held briefly so the tap visibly lands. */
  const [flashAnswer, setFlashAnswer] = useState<MapAnswer | null>(null);
  const pendingSaves = useRef<Array<{ itemId: string; answer: MapAnswer }>>([]);

  const queue = buildQueue(plans, answers);
  const current = queue[0];
  const domainsDone = plans.length - new Set(queue.map((entry) => entry.domainId)).size;
  const domain = current ? getMapDomain(current.domainId) : null;
  const isNewDomain = current ? lastDomainId !== current.domainId : false;
  const isFirstLadderRung = current ? current.isLadder && !lastWasLadder : false;

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
    setLastWasLadder(current.isLadder);
    setEasilyStreak(answer === "easily" ? easilyStreak + 1 : 0);
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
    setEasilyStreak(0);
    setLastWasLadder(false);
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

  // The card's one kicker slot: the subject intro when a new subject
  // opens, the gold ladder line on ladder questions. One slot, so
  // nothing above the question ever appears or disappears between
  // questions. (2026-07-07, "idk if we need that": the very first
  // question used to get its own reassurance line here instead of a
  // subject intro, "Answer from what you've seen Story do. 'Not sure'
  // is a real answer." Cut on request; question 1 is also the first new
  // subject, so it falls through to that branch below and gets the same
  // domain-intro kicker every other subject opens with, e.g. "First up:
  // numbers." "Not sure" stays legible on its own as one of the four
  // answer chips either way.)
  //
  // 2026-07-07 ("gets redundant"): the gold ladder line used to show on
  // EVERY rung of a climb, so a streak of "easily" answers in one
  // subject repeated the identical line two or three times in a row.
  // isFirstLadderRung narrows it to just the first surprise; later rungs
  // in the same climb fall through to isNewDomain (false, same subject),
  // so the kicker slot goes quiet and the question stands on its own.
  const kicker =
    isFirstLadderRung
      ? { text: "One more, since that was easy\u2026", tone: "gold" as const }
      : isNewDomain
        ? { text: domain.intro, tone: "muted" as const }
        : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
      <div>
        {/* Two tiers so "who" and "what section" each read on their own
            (founder feedback 2026-07-07, mobile review: kid + subject
            blurred into one small gray line). Tier 1: the kid as a
            brand chip (whose questionnaire) plus the time estimate.
            Tier 2: the subject as a prominent section title, the thing
            they're actually answering about right now. */}
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
            {child.name}
          </span>
          <p className="shrink-0 font-mono text-xs text-subtle">{timeLabel}</p>
        </div>
        <p className="mt-2 truncate font-display text-lg font-bold text-strong">
          {domain.displayName}
        </p>
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
          {/* Centered when it's the only thing here (2026-07-07, "looks
              bad"): `justify-between` with nothing on the right left this
              row pinned to the left edge, which read fine under stacked
              chips but looked stranded under a wide four-across row,
              tucked under "Easily" and "Getting there" specifically as
              if it belonged to those buttons. Splits back to the sides
              only once "on a roll" actually has something to balance
              against. */}
          <div className={`mt-4 flex items-center ${easilyStreak >= 3 ? "justify-between" : "justify-center"}`}>
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
            saved)": this answers the real question the old label didn't,
            this is where she'd go to add another kid mid-flow. The hub
            she lands on has an "add another kid" control and a
            "Continue the questionnaire" button for exactly this child.
            (2026-07-07: the quiet header's "Everything saves as you go"
            this comment used to point to is gone, cut on request; the
            save-in-progress reassurance now lives only on the hub
            itself, see hub-step.tsx.) */}
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
