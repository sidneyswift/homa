"use client";

import { useRef, useState } from "react";

import {
  DEEP_DIVE_CAP,
  getMapSubject,
  nextDeepDiveItem,
  personalizeStatement,
  type MapAnswer,
} from "@homa/core";

import type { FlowChild } from "./flow-types";
import { QuietAction, QuietChoice, QuietFeedback, QuietFrame, QuietStatus } from "../../components/design";
import {
  classifyMapAnswerResponse,
  createMapAnswerAttempt,
  MapAnswerAttemptKeyPolicy,
  mapAnswerAttemptRequestBody,
  type MapAnswerAttempt,
  type MapAnswerResponse,
} from "./map-answer-attempt";

/**
 * The subject deep dive (read-through ruling: click into a subject and go
 * deeper). Up to eight extra questions that walk DOWN to find the honest
 * starting line when things are growing, and UP past the report's cap when
 * they're strong. Mode chooser first: answer from memory, or sit together
 * and try things, the mom's choice, exactly as discussed.
 */

const CHIP_LABELS: ReadonlyArray<readonly [MapAnswer, string]> = [
  ["easily", "Easily"],
  ["getting_there", "Getting there"],
  ["not_yet", "Not yet"],
  ["not_sure", "Not sure"],
];

export function DeepDiveStep({
  child,
  subjectId,
  onComplete,
  onExit,
}: {
  child: FlowChild;
  subjectId: string;
  onComplete: () => void;
  onExit: () => void;
}) {
  const domain = getMapSubject(subjectId);
  const [mode, setMode] = useState<"parent" | "together" | null>(null);
  const [answers, setAnswers] = useState<Record<string, MapAnswer>>(child.answers);
  const [sittingCount, setSittingCount] = useState(0);
  /** Item ids answered this sitting, so "back" can undo a mis-tap. */
  const [sittingHistory, setSittingHistory] = useState<string[]>([]);
  const [flushing, setFlushing] = useState(false);
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
  const attemptKeys =
    useRef<MapAnswerAttemptKeyPolicy | null>(null);
  if (attemptKeys.current === null) {
    attemptKeys.current = new MapAnswerAttemptKeyPolicy();
  }
  const attemptKeyPolicy = attemptKeys.current;

  const current = domain ? nextDeepDiveItem(subjectId, child.ageMonths, answers, sittingCount) : null;

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
          "This answer is saved for confirmation in Progress before the deep dive can continue.",
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
      setSittingCount((count) => Math.max(0, count - 1));
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
      source: "deep_dive" as const,
    };
    permanentSaveFailures.current.delete(itemId);
    if (confirmationItemId === itemId) {
      setConfirmationItemId(null);
    }
    permanentSaveFailures.current.delete(itemId);
    const idempotencyKey = attemptKeyPolicy.keyFor(intent);
    const attempt = createMapAnswerAttempt(
      { itemId, answer, source: "deep_dive" },
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

  function chooseMode(chosen: "parent" | "together") {
    setMode(chosen);
    void fetch("/api/map/deep-dive-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: child.id, subject: subjectId, mode: chosen }),
    }).catch(() => undefined);
  }

  function finish() {
    setFlushing(true);
    setSaveError(null);
    void (async () => {
      await waitForAllSaves();
      const saved = await flushPending();
      if (saved) {
        onComplete();
        return;
      }
      setFlushing(false);
      setSaveError("Some answers are still saving. You can try again before we update the report.");
    })();
  }

  function answerCurrent(answer: MapAnswer) {
    if (!current) return;
    setSaveError(null);
    const updated = { ...answers, [current.id]: answer };
    setAnswers(updated);
    setSittingCount((count) => count + 1);
    setSittingHistory((history) => [...history, current.id]);
    trackPostAnswer(current.id, answer);

    if (nextDeepDiveItem(subjectId, child.ageMonths, updated, sittingCount + 1) === null) {
      finish();
    }
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
    setSittingCount((count) => Math.max(0, count - 1));
    setSaveError(null);
    setUndoing(false);
  }

  if (!domain) {
    onExit();
    return null;
  }

  if (mode === null) {
    return (
      <div data-brand-surface="onboarding-deep-dive" className="quiet-onboarding__deep-dive">
        <h1 className="quiet-onboarding__step-heading">
          Going deeper on {domain.displayName.toLowerCase()}
        </h1>
        <p className="quiet-onboarding__step-copy mt-3">
          A few more questions to pin down where {child.name} stands and where a plan should
          start. Two ways to do it:
        </p>
        <QuietChoice
          name="deep-dive-mode"
          label="How would you like to begin?"
          value={mode ?? ""}
          className="mt-6"
          options={[
            {
              value: "parent",
              label: "Answer from what you've seen",
              description: "Your own noticing, from memory, right now.",
            },
            {
              value: "together",
              label: `Sit with ${child.name} and try them`,
              description: "Try each one together, casually. No test energy, just the two of you finding out.",
            },
          ]}
          onChange={(value) => {
            if (typeof value === "string" && (value === "parent" || value === "together")) {
              chooseMode(value);
            }
          }}
        />
        <QuietAction kind="quiet" type="button" onClick={onExit} className="quiet-onboarding__exit-action mt-6">
          back to the report
        </QuietAction>
      </div>
    );
  }

  if (flushing || !current) {
    return (
      <QuietFrame
        as="article"
        aria-busy="true"
        data-brand-layer="onboarding-deep-dive-saving"
        className="quiet-onboarding__answer-state p-6"
      >
        <p className="quiet-onboarding__loading-title">
          Deep dive done.
        </p>
        {saveError && !flushing ? (
          <QuietFeedback tone="error" className="mt-3">{saveError}</QuietFeedback>
        ) : (
          <QuietStatus tone="info" className="mt-3">Updating {child.name}&apos;s report{"\u2026"}</QuietStatus>
        )}
        {saveError && !flushing ? (
          <QuietAction kind="secondary" type="button" onClick={() => finish()} className="mt-4">
            Try saving again
          </QuietAction>
        ) : null}
      </QuietFrame>
    );
  }

  return (
    <div data-brand-surface="onboarding-deep-dive" className="quiet-onboarding__deep-dive">
      <div className="flex items-center justify-between">
        <p className="quiet-onboarding__deep-dive-meta">
          {child.name} {"\u00b7"} {domain.displayName} deep dive
        </p>
        <p className="quiet-onboarding__deep-dive-count">
          {sittingCount + 1} of up to {DEEP_DIVE_CAP}
        </p>
      </div>

      {mode === "together" && sittingCount === 0 ? (
        <QuietStatus tone="constructive" className="mt-4">
          Keep it playful: &ldquo;hey {child.name}, want to try something?&rdquo; Stop anytime,
          everything saves as you go.
        </QuietStatus>
      ) : null}

      <QuietFrame as="article" data-brand-layer="onboarding-deep-dive-question" className="quiet-onboarding__question-card mt-3 p-6">
        <p className="quiet-onboarding__question-kicker">
          {mode === "together" ? `Try it with ${child.name}:` : `From what you've seen:`}
        </p>
        <h2 className="quiet-onboarding__question-title mt-1">
          {personalizeStatement(child.name, current)}?
        </h2>

        <div className="quiet-onboarding__answer-grid mt-auto pt-5">
          {CHIP_LABELS.map(([value, label]) => (
            <QuietAction
              key={value}
              type="button"
              onClick={() => answerCurrent(value)}
              kind="secondary"
              className="quiet-onboarding__answer-chip"
            >
              {label}
            </QuietAction>
          ))}
        </div>
        <div className="quiet-onboarding__deep-dive-actions mt-3">
          {sittingHistory.length > 0 ? (
            <QuietAction
              kind="quiet"
              type="button"
              onClick={() => void goBack()}
              disabled={undoing}
              className="quiet-onboarding__text-action"
            >
              {undoing ? "Undoing..." : "← Back"}
            </QuietAction>
          ) : null}
          <QuietAction
            kind="quiet"
            type="button"
            onClick={() => finish()}
            className="quiet-onboarding__text-action"
          >
            stop here and update the report
          </QuietAction>
        </div>
        {saveError ? (
          <QuietFeedback tone="error" className="mt-3">{saveError}</QuietFeedback>
        ) : null}
      </QuietFrame>
    </div>
  );
}
