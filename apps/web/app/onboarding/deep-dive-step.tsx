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
  const pendingSaves = useRef<Array<{ itemId: string; answer: MapAnswer }>>([]);
  const inFlightSaves = useRef<Map<string, Set<Promise<boolean>>>>(new Map());

  const current = domain ? nextDeepDiveItem(subjectId, child.ageMonths, answers, sittingCount) : null;

  async function postAnswer(itemId: string, answer: MapAnswer): Promise<boolean> {
    try {
      const response = await fetch("/api/map/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, itemId, answer }),
      });
      if (response.ok) return true;
      pendingSaves.current.push({ itemId, answer });
      return false;
    } catch {
      pendingSaves.current.push({ itemId, answer });
      return false;
    }
  }

  function trackPostAnswer(itemId: string, answer: MapAnswer): void {
    const save = postAnswer(itemId, answer);
    const existing = inFlightSaves.current.get(itemId) ?? new Set<Promise<boolean>>();
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
      await postAnswer(entry.itemId, entry.answer);
    }
    return pendingSaves.current.length === 0;
  }

  async function clearAnswer(itemId: string): Promise<boolean> {
    await waitForItemSaves(itemId);
    const matchingPending = pendingSaves.current.filter((entry) => entry.itemId === itemId);
    pendingSaves.current = pendingSaves.current.filter((entry) => entry.itemId !== itemId);
    try {
      const response = await fetch("/api/map/answer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, itemId }),
      });
      if (response.ok) return true;
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
        <h1 className="font-display text-3xl font-bold leading-tight text-strong">
          Going deeper on {domain.displayName.toLowerCase()}
        </h1>
        <p className="mt-3 text-body">
          A few more questions to pin down where {child.name} stands and where a plan should
          start. Two ways to do it:
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => chooseMode("parent")}
            className="rounded-lg border border-border-subtle bg-card p-5 text-left shadow-sm transition duration-(--dur-fast) ease-out hover:border-brand"
          >
            <p className="font-display text-lg font-semibold text-strong">Answer from what you&apos;ve seen</p>
            <p className="mt-1 text-sm text-muted">
              Your own noticing, from memory, right now.
            </p>
          </button>
          <button
            type="button"
            onClick={() => chooseMode("together")}
            className="rounded-lg border border-border-subtle bg-card p-5 text-left shadow-sm transition duration-(--dur-fast) ease-out hover:border-brand"
          >
            <p className="font-display text-lg font-semibold text-strong">Sit with {child.name} and try them</p>
            <p className="mt-1 text-sm text-muted">
              Try each one together, casually. No test energy, just the two of you finding out.
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="mt-6 text-sm text-subtle underline-offset-2 hover:underline"
        >
          back to the report
        </button>
      </div>
    );
  }

  if (flushing || !current) {
    return (
      <div aria-busy="true" className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <p className="font-display text-lg font-semibold text-strong">
          Deep dive done.
        </p>
        {saveError && !flushing ? (
          <>
            <p className="mt-2 text-body">{saveError}</p>
            <button
              type="button"
              onClick={() => finish()}
              className="mt-4 rounded-pill border border-border bg-card px-4 py-2 text-sm font-semibold text-strong transition duration-(--dur-fast) ease-out hover:border-brand hover:bg-brand-soft"
            >
              try saving again
            </button>
          </>
        ) : (
          <p className="mt-2 text-body">Updating {child.name}&apos;s report{"\u2026"}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">
          {child.name} {"\u00b7"} {domain.displayName} deep dive
        </p>
        <p className="font-mono text-xs text-subtle">
          {sittingCount + 1} of up to {DEEP_DIVE_CAP}
        </p>
      </div>

      {mode === "together" && sittingCount === 0 ? (
        <p className="mt-4 rounded-md bg-[var(--accent-sage-soft)] px-4 py-3 text-sm text-body">
          Keep it playful: &ldquo;hey {child.name}, want to try something?&rdquo; Stop anytime,
          everything saves as you go.
        </p>
      ) : null}

      <div className="mt-3 flex min-h-[19rem] flex-col rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-subtle">
          {mode === "together" ? `Try it with ${child.name}:` : `From what you've seen:`}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-strong">
          {personalizeStatement(child.name, current)}?
        </h2>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          {CHIP_LABELS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => answerCurrent(value)}
              className="min-h-12 rounded-pill border border-border bg-card px-4 py-3 text-sm font-semibold text-strong transition duration-(--dur-fast) ease-out hover:border-brand hover:bg-brand-soft motion-safe:active:scale-[var(--press-scale)]"
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
              className="text-sm text-subtle underline-offset-2 hover:underline"
            >
              {undoing ? "undoing..." : `${"\u2190"} back`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => finish()}
            className="text-sm text-subtle underline-offset-2 hover:underline"
          >
            stop here and update the report
          </button>
        </div>
        {saveError ? (
          <p className="mt-3 text-sm text-body">{saveError}</p>
        ) : null}
      </div>
    </div>
  );
}
