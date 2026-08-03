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
      <div>
        <h1 className="font-display text-3xl font-bold leading-tight text-[var(--homa-ink)]">
          Going deeper on {domain.displayName.toLowerCase()}
        </h1>
        <p className="mt-3 text-[var(--homa-ink)]">
          A few more questions to pin down where {child.name} stands and where a plan should
          start. Two ways to do it:
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => chooseMode("parent")}
            className="rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-5 text-left shadow-sm transition duration-(--homa-motion-fast) ease-out hover:border-[var(--homa-visual-coral)]"
          >
            <p className="font-display text-lg font-semibold text-[var(--homa-ink)]">Answer from what you&apos;ve seen</p>
            <p className="mt-1 text-sm text-[var(--homa-muted-ink)]">
              Your own noticing, from memory, right now.
            </p>
          </button>
          <button
            type="button"
            onClick={() => chooseMode("together")}
            className="rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-5 text-left shadow-sm transition duration-(--homa-motion-fast) ease-out hover:border-[var(--homa-visual-coral)]"
          >
            <p className="font-display text-lg font-semibold text-[var(--homa-ink)]">Sit with {child.name} and try them</p>
            <p className="mt-1 text-sm text-[var(--homa-muted-ink)]">
              Try each one together, casually. No test energy, just the two of you finding out.
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="mt-6 text-sm text-[var(--homa-muted-ink)] underline-offset-2 hover:underline"
        >
          back to the report
        </button>
      </div>
    );
  }

  if (flushing || !current) {
    return (
      <div aria-busy="true" className="rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm">
        <p className="font-display text-lg font-semibold text-[var(--homa-ink)]">
          Deep dive done.
        </p>
        {saveError && !flushing ? (
          <>
            <p className="mt-2 text-[var(--homa-ink)]">{saveError}</p>
            <button
              type="button"
              onClick={() => finish()}
              className="mt-4 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-2 text-sm font-semibold text-[var(--homa-ink)] transition duration-(--homa-motion-fast) ease-out hover:border-[var(--homa-visual-coral)] hover:bg-[var(--homa-info-tint)]"
            >
              try saving again
            </button>
          </>
        ) : (
          <p className="mt-2 text-[var(--homa-ink)]">Updating {child.name}&apos;s report{"\u2026"}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--homa-muted-ink)]">
          {child.name} {"\u00b7"} {domain.displayName} deep dive
        </p>
        <p className="font-mono text-xs text-[var(--homa-muted-ink)]">
          {sittingCount + 1} of up to {DEEP_DIVE_CAP}
        </p>
      </div>

      {mode === "together" && sittingCount === 0 ? (
        <p className="mt-4 rounded-[var(--homa-radius-control)] bg-[var(--homa-constructive-tint)] px-4 py-3 text-sm text-[var(--homa-ink)]">
          Keep it playful: &ldquo;hey {child.name}, want to try something?&rdquo; Stop anytime,
          everything saves as you go.
        </p>
      ) : null}

      <div className="mt-3 flex min-h-[19rem] flex-col rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm">
        <p className="text-sm font-medium text-[var(--homa-muted-ink)]">
          {mode === "together" ? `Try it with ${child.name}:` : `From what you've seen:`}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-[var(--homa-ink)]">
          {personalizeStatement(child.name, current)}?
        </h2>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          {CHIP_LABELS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => answerCurrent(value)}
              className="min-h-12 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-3 text-sm font-semibold text-[var(--homa-ink)] transition duration-(--homa-motion-fast) ease-out hover:border-[var(--homa-visual-coral)] hover:bg-[var(--homa-info-tint)] motion-safe:active:scale-[var(--press-scale)]"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4">
          {sittingHistory.length > 0 ? (
            <button
              type="button"
              onClick={() => void goBack()}
              disabled={undoing}
              className="text-sm text-[var(--homa-muted-ink)] underline-offset-2 hover:underline"
            >
              {undoing ? "undoing..." : `${"\u2190"} back`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => finish()}
            className="text-sm text-[var(--homa-muted-ink)] underline-offset-2 hover:underline"
          >
            stop here and update the report
          </button>
        </div>
        {saveError ? (
          <p className="mt-3 text-sm text-[var(--homa-ink)]">{saveError}</p>
        ) : null}
      </div>
    </div>
  );
}
