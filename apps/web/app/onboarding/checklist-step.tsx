"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getMapSubject, personalizeStatement, planQuestions, type MapAnswer } from "@homa/core";

import type { FlowChild } from "./flow-types";
import {
  classifyMapAnswerResponse,
  createMapAnswerAttempt,
  MapAnswerAttemptKeyPolicy,
  mapAnswerAttemptRequestBody,
  type MapAnswerAttempt,
  type MapAnswerResponse,
} from "./map-answer-attempt";
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
  exitLabel = "back to your family",
  compact = false,
}: {
  child: FlowChild;
  onComplete: () => void;
  onExit: () => void;
  /**
   * Docked inside the chat rather than owning a page.
   *
   * Drops the two-column grid and the report rail, which is the ONLY
   * thing the full-page version was protecting: every founder correction
   * this component carries (fixed card height, chip scale order, the
   * 140ms flash, the reserved kicker slot, time-left over "4 of 16", the
   * child's name inside every question) lives inside the question card
   * and is untouched. The rail is already absent below lg, so a parent
   * on a phone sees exactly what she saw before.
   */
  compact?: boolean;
  /** Where leaving actually goes. The card flow returns to the family
   *  hub; the chat takeover returns to the conversation, and telling a
   *  chat-first parent she is going "back to your family" names a page
   *  she has never seen. */
  exitLabel?: string;
}) {
  const plans = useMemo(() => planQuestions(child.ageMonths), [child.ageMonths]);
  const [answers, setAnswers] = useState<Record<string, MapAnswer>>(child.answers);
  const [flushing, setFlushing] = useState(false);
  const [easilyStreak, setEasilyStreak] = useState(0);
  /** Item ids answered this sitting, so "back" can undo a mis-tap. */
  const [sittingHistory, setSittingHistory] = useState<string[]>([]);
  /** The domain of the last question answered; a different current domain
   * means a fresh subject intro should show. */
  const [lastSubjectId, setLastDomainId] = useState<string | null>(null);
  /** Whether the last question answered was itself a ladder rung: the
   * gold "one more, since that was easy" line should only greet the
   * FIRST rung of a climb, not repeat itself on every rung after
   * (caught 2026-07-07, "gets redundant"). */
  const [lastWasLadder, setLastWasLadder] = useState(false);
  /** The chip just tapped, held briefly so the tap visibly lands. */
  const [flashAnswer, setFlashAnswer] = useState<MapAnswer | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [confirmationItemId, setConfirmationItemId] =
    useState<string | null>(null);
  const pendingSaves = useRef<MapAnswerAttempt[]>([]);
  const permanentSaveFailures = useRef<Set<string>>(new Set());
  const inFlightSaves =
    useRef<Map<string, Set<Promise<MapAnswerResponse>>>>(
      new Map(),
    );
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptKeys =
    useRef<MapAnswerAttemptKeyPolicy | null>(null);
  if (attemptKeys.current === null) {
    attemptKeys.current = new MapAnswerAttemptKeyPolicy();
  }
  const attemptKeyPolicy = attemptKeys.current;

  const queue = buildQueue(plans, answers);
  const current = queue[0];
  const subjectsDone = plans.length - new Set(queue.map((entry) => entry.subjectId)).size;
  const domain = current ? getMapSubject(current.subjectId) : null;
  const isNewSubject = current ? lastSubjectId !== current.subjectId : false;
  const isFirstLadderRung = current ? current.isLadder && !lastWasLadder : false;

  const minutesLeft = Math.max(1, Math.ceil((queue.length * SECONDS_PER_SUBJECT) / 60));
  const timeLabel = queue.length <= 1 ? "almost done" : `about ${minutesLeft} min left`;

  const railSubjects: RailSubject[] = plans.map((plan) => {
    const inQueue = queue.some((entry) => entry.subjectId === plan.subjectId);
    return {
      id: plan.subjectId,
      name: getMapSubject(plan.subjectId)?.displayName ?? plan.subjectId,
      status: !inQueue ? "done" : plan.subjectId === current?.subjectId ? "current" : "upcoming",
    };
  });

  useEffect(() => {
    return () => {
      if (answerTimer.current) {
        clearTimeout(answerTimer.current);
      }
    };
  }, []);

  async function postAnswer(
    attempt: MapAnswerAttempt,
  ): Promise<MapAnswerResponse> {
    const intent = {
      action: "save" as const,
      childId: child.id,
      itemId: attempt.itemId,
      answer: attempt.answer,
      source: attempt.source,
    };
    try {
      const response = await fetch("/api/map/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mapAnswerAttemptRequestBody(child.id, attempt),
        ),
      });
      const errorBody = response.status === 409
        ? await response.json().catch(() => null) as {
            reason?: string;
          } | null
        : null;
      const outcome = classifyMapAnswerResponse(
        response.status,
        errorBody?.reason,
      );
      if (outcome === "success") {
        attemptKeyPolicy.markSucceeded(intent);
        permanentSaveFailures.current.delete(attempt.itemId);
        return outcome;
      }
      if (outcome === "retryable") {
        pendingSaves.current.push(attempt);
        return outcome;
      }
      attemptKeyPolicy.markPermanentFailure(intent);
      permanentSaveFailures.current.add(attempt.itemId);
      if (outcome === "conflict_pending") {
        setConfirmationItemId(attempt.itemId);
        setSaveError(
          "This answer is saved for confirmation in Progress before the questionnaire can continue.",
        );
        return outcome;
      }
      setAnswers((currentAnswers) => {
        if (currentAnswers[attempt.itemId] !== attempt.answer) {
          return currentAnswers;
        }
        const next = { ...currentAnswers };
        delete next[attempt.itemId];
        return next;
      });
      setSittingHistory((history) =>
        history.filter((itemId) => itemId !== attempt.itemId)
      );
      setSaveError(
        outcome === "idempotency_mismatch"
          ? "That answer changed while saving. Please answer it again."
          : "That answer was not saved. You can answer it again.",
      );
      return outcome;
    } catch {
      pendingSaves.current.push(attempt);
      return "retryable";
    }
  }

  function trackPostAnswer(itemId: string, answer: MapAnswer): void {
    const intent = {
      action: "save" as const,
      childId: child.id,
      itemId,
      answer,
      source: "checklist" as const,
    };
    permanentSaveFailures.current.delete(itemId);
    if (confirmationItemId === itemId) {
      setConfirmationItemId(null);
    }
    const idempotencyKey = attemptKeyPolicy.keyFor(intent);
    const attempt = createMapAnswerAttempt(
      { itemId, answer, source: "checklist" },
      () => idempotencyKey,
    );
    const save = postAnswer(attempt);
    const existing =
      inFlightSaves.current.get(itemId) ??
      new Set<Promise<MapAnswerResponse>>();
    existing.add(save);
    inFlightSaves.current.set(itemId, existing);
    void save.finally(() => {
      const saves = inFlightSaves.current.get(itemId);
      saves?.delete(save);
      if (saves?.size === 0) {
        inFlightSaves.current.delete(itemId);
      }
    });
  }

  async function waitForItemSaves(itemId: string): Promise<void> {
    const saves = inFlightSaves.current.get(itemId);
    if (saves) await Promise.allSettled([...saves]);
  }

  async function waitForAllSaves(): Promise<void> {
    while (inFlightSaves.current.size > 0) {
      const saves = [...inFlightSaves.current.values()].flatMap((entries) => [...entries]);
      await Promise.allSettled(saves);
    }
  }

  async function flushPending(): Promise<boolean> {
    const retries = [...pendingSaves.current];
    pendingSaves.current = [];
    for (const entry of retries) {
      await postAnswer(entry);
    }
    return (
      pendingSaves.current.length === 0 &&
      permanentSaveFailures.current.size === 0
    );
  }

  async function completeWhenSaved(): Promise<void> {
    setFlushing(true);
    setSaveError(null);
    await waitForAllSaves();
    const saved = await flushPending();
    if (saved) {
      onComplete();
      return;
    }
    setFlushing(false);
    setSaveError("Some answers are still saving. You can try again before we build the report.");
  }

  async function clearAnswer(itemId: string): Promise<boolean> {
    await waitForItemSaves(itemId);
    const matchingPending = pendingSaves.current.filter((entry) => entry.itemId === itemId);
    pendingSaves.current = pendingSaves.current.filter((entry) => entry.itemId !== itemId);
    const intent = {
      action: "delete" as const,
      childId: child.id,
      itemId,
    };
    const idempotencyKey = attemptKeyPolicy.keyFor(intent);
    try {
      const response = await fetch("/api/map/answer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: child.id,
          itemId,
          idempotencyKey,
        }),
      });
      const errorBody = response.status === 409
        ? await response.json().catch(() => null) as {
            reason?: string;
          } | null
        : null;
      const outcome = classifyMapAnswerResponse(
        response.status,
        errorBody?.reason,
      );
      if (outcome === "success") {
        attemptKeyPolicy.markSucceeded(intent);
        return true;
      }
      if (
        outcome === "permanent" ||
        outcome === "conflict_pending" ||
        outcome === "idempotency_mismatch"
      ) {
        attemptKeyPolicy.markPermanentFailure(intent);
        setSaveError(
          outcome === "conflict_pending"
            ? "This answer needs confirmation in Progress before it can be undone."
            : "That saved answer could not be undone. It is still included.",
        );
      }
    } catch {
      // Keep local state unchanged below, so the parent can try again.
    }
    pendingSaves.current = [...pendingSaves.current, ...matchingPending];
    return false;
  }

  function commitAnswer(answer: MapAnswer) {
    if (!current) return;
    setSaveError(null);
    setLastDomainId(current.subjectId);
    setLastWasLadder(current.isLadder);
    setEasilyStreak(answer === "easily" ? easilyStreak + 1 : 0);
    setSittingHistory((history) => [...history, current.item.id]);
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.item.id]: answer }));
    trackPostAnswer(current.item.id, answer);

    const remaining = buildQueue(plans, { ...answers, [current.item.id]: answer });
    if (remaining.length === 0) {
      void completeWhenSaved();
    }
  }

  /** Chip taps flash selected briefly before advancing; a second tap
   * during the flash is ignored rather than double-answering. */
  function answerCurrent(answer: MapAnswer) {
    if (!current || flashAnswer !== null) return;
    setFlashAnswer(answer);
    answerTimer.current = setTimeout(() => {
      answerTimer.current = null;
      setFlashAnswer(null);
      commitAnswer(answer);
    }, ANSWER_FLASH_MS);
  }

  /** Undo the last tap of this sitting after the server row is clear too. */
  async function goBack() {
    const lastId = sittingHistory[sittingHistory.length - 1];
    if (!lastId || undoing) return;
    setUndoing(true);
    const cleared = await clearAnswer(lastId);
    if (!cleared) {
      setUndoing(false);
      setSaveError("That answer is still saved for now. You can try undo again.");
      return;
    }
    setSittingHistory((history) => history.slice(0, -1));
    setAnswers((currentAnswers) => {
      const next = { ...currentAnswers };
      delete next[lastId];
      return next;
    });
    setEasilyStreak(0);
    setLastWasLadder(false);
    setSaveError(null);
    setUndoing(false);
  }

  function exitChecklist() {
    if (answerTimer.current) {
      clearTimeout(answerTimer.current);
      answerTimer.current = null;
    }
    onExit();
  }

  if (flushing || !current || !domain) {
    return (
      <div aria-busy="true" className="mx-auto max-w-[36rem] rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <p className="font-display text-lg font-semibold text-strong">
          Questionnaire done.
        </p>
        {saveError && !flushing ? (
          <>
            <p className="mt-2 text-body">{saveError}</p>
            <button
              type="button"
              onClick={() => void completeWhenSaved()}
              className="mt-4 rounded-pill border border-border bg-card px-4 py-2 text-sm font-semibold text-strong transition duration-(--dur-fast) ease-out hover:border-brand hover:bg-brand-soft"
            >
              try saving again
            </button>
          </>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-body" role="status">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none"
              aria-hidden="true"
            />
            Saving the last answers{"\u2026"}
          </p>
        )}
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
  // in the same climb fall through to isNewSubject (false, same subject),
  // so the kicker slot goes quiet and the question stands on its own.
  const kicker =
    isFirstLadderRung
      ? { text: "One more, since that was easy\u2026", tone: "gold" as const }
      : isNewSubject
        ? { text: domain.intro, tone: "muted" as const }
        : null;

  // What she just told us this child loves, carried into the one beat
  // that asks her to enumerate what they cannot do yet (walk 002,
  // 2026-07-29: the questions are the arc's only -1, and this is the
  // most exposed moment in the product). She picked these on the child
  // card minutes ago, so the header answers "does it know my kid?" at
  // the exact moment she is bracing to be judged as a teacher.
  //
  // Nothing needed plumbing: /api/map/state already carries
  // child.interests, read straight from children.profile.interests.
  // Three at most, because this line shares a row with the time
  // estimate on a phone; the rest stay in the profile.
  const headerInterests = child.interests.slice(0, 3).join(", ");

  return (
    <div
      className={
        compact ? "" : "lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10"
      }
    >
      <div>
        {/* Two tiers so "who" and "what section" each read on their own
            (founder feedback 2026-07-07, mobile review: kid + subject
            blurred into one small gray line). Tier 1: the kid as a
            brand chip (whose questionnaire) plus the time estimate.
            Tier 2: the subject as a prominent section title, the thing
            they're actually answering about right now. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
              {child.name}
            </span>
            {headerInterests ? (
              <span className="truncate text-xs text-subtle">
                {headerInterests}
              </span>
            ) : null}
          </div>
          <p className="shrink-0 font-mono text-xs text-subtle">{timeLabel}</p>
        </div>
        <p className="mt-2 truncate font-display text-lg font-bold text-strong">
          {domain.displayName}
        </p>
        {/* One continuous hairline, small screens only: the rail carries
            per-subject progress wherever it fits. */}
        <div
          className={`mt-2 h-1 overflow-hidden rounded-pill bg-border-subtle ${compact ? "" : "lg:hidden"}`}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-pill bg-brand transition-[width] duration-(--dur-base) ease-out"
            style={{ width: `${Math.round((subjectsDone / plans.length) * 100)}%` }}
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
            {/* The kid's name rides inside every question (founder call
                2026-07-08), so "Story counts out loud to 10?" always
                names who's being asked about, load-bearing with two or
                more kids in one sitting. */}
            <h2 className="font-display text-xl font-semibold leading-snug text-strong">
              {personalizeStatement(child.name, current.item)}?
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
                  onClick={() => void goBack()}
                  disabled={undoing}
                  className="text-sm text-subtle underline-offset-2 hover:underline"
                >
                  {undoing ? "undoing..." : "undo last answer"}
                </button>
              ) : null}
              {/* D12 (plans/2026-07-21-chat-first-onboarding.md §2.5): the
                  skip flash reuses the same ANSWER_FLASH_MS window the four
                  answer chips already hold before advancing, so this needs
                  no new timing, only a label swap during it. "Trust at the
                  exact moment moms expect to be graded." */}
              <button
                type="button"
                onClick={() => answerCurrent("skip")}
                className="text-sm text-subtle underline-offset-2 hover:underline"
              >
                {flashAnswer === "skip"
                  ? "Skipped. Never counts against her."
                  : "skip this one"}
              </button>
            </span>
            {easilyStreak >= 3 ? (
              <span className="font-hand text-lg text-sage">on a roll {"\u270e"}</span>
            ) : null}
          </div>
          {saveError ? (
            <p className="mt-3 text-center text-sm text-body">{saveError}</p>
          ) : null}
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
          onClick={exitChecklist}
          className="mt-6 text-sm text-subtle underline-offset-2 hover:underline"
        >
          {"\u2190"} {exitLabel}
        </button>
      </div>

      {compact ? null : (
        <ReportRail childName={child.name} subjects={railSubjects} />
      )}
    </div>
  );
}
