"use client";

import { useMemo, useRef, useState } from "react";

import {
  getMapDomain,
  planQuestions,
  type MapAnswer,
  type MapItem,
} from "@homa/core";

import type { FlowChild } from "./flow-types";

/**
 * S3: the checklist, straight in with no intro screen (read-through ruling:
 * the /map page already set the contract, so the hint rides quietly above
 * the first question instead). One question per screen, four chips, fixed
 * card height so nothing jumps between questions. The adaptive ladder:
 * "easily" unlocks the next rung up, anything else moves on. Every tap
 * saves immediately; failed saves queue and flush before scoring.
 */

const CHIP_LABELS: ReadonlyArray<readonly [MapAnswer, string]> = [
  ["easily", "Easily"],
  ["getting_there", "Getting there"],
  ["not_yet", "Not yet"],
  ["not_sure", "Not sure"],
];

interface QueueEntry {
  domainId: string;
  item: MapItem;
  isLadder: boolean;
}

function buildQueue(
  plans: ReturnType<typeof planQuestions>,
  answers: Record<string, MapAnswer>,
): QueueEntry[] {
  const queue: QueueEntry[] = [];
  for (const plan of plans) {
    const baseAnswer = answers[plan.base.id];
    if (baseAnswer === undefined) {
      queue.push({ domainId: plan.domainId, item: plan.base, isLadder: false });
      continue;
    }
    if (baseAnswer !== "easily") continue;
    // Climb the ladder while the answers stay "easily"; the first unanswered
    // rung is the next question, and any other answer ends the climb.
    for (const rung of plan.ladders) {
      const rungAnswer = answers[rung.id];
      if (rungAnswer === undefined) {
        queue.push({ domainId: plan.domainId, item: rung, isLadder: true });
        break;
      }
      if (rungAnswer !== "easily") break;
    }
  }
  return queue;
}

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
  const pendingSaves = useRef<Array<{ itemId: string; answer: MapAnswer }>>([]);

  const queue = buildQueue(plans, answers);
  const current = queue[0];
  const domainsDone = plans.length - new Set(queue.map((entry) => entry.domainId)).size;
  const domain = current ? getMapDomain(current.domainId) : null;
  const previousDomainId = useRef<string | null>(null);
  const isNewDomain = current ? previousDomainId.current !== current.domainId : false;

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

  function answerCurrent(answer: MapAnswer) {
    if (!current) return;
    previousDomainId.current = current.domainId;
    setEasilyStreak(answer === "easily" ? easilyStreak + 1 : 0);
    setAnsweredCount((count) => count + 1);
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

  if (flushing || !current || !domain) {
    return (
      <div aria-busy="true" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="font-display text-lg font-semibold text-strong">
          That&apos;s the checklist done.
        </p>
        <p className="mt-2 text-body">Saving the last answers{"\u2026"}</p>
      </div>
    );
  }

  return (
    <div>
      {answeredCount === 0 ? (
        <p className="mb-4 rounded-md bg-[var(--accent-sage-soft)] px-4 py-3 text-sm text-body">
          Answer from what you&apos;ve seen {child.name} do, day to day. Skip anything, and
          &ldquo;not sure&rdquo; is a real answer.
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">
          {child.name} {"\u00b7"} {domain.displayName}
        </p>
        <p className="font-mono text-xs text-subtle">
          subject {Math.min(domainsDone + 1, plans.length)} of {plans.length}
        </p>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {plans.map((plan, index) => (
          <span
            key={plan.domainId}
            className={`h-1.5 flex-1 rounded-pill ${index < domainsDone ? "bg-sage" : index === domainsDone ? "bg-brand" : "bg-border-subtle"}`}
          />
        ))}
      </div>

      <p className={`mt-5 text-sm text-muted ${isNewDomain ? "" : "invisible"}`}>{domain.intro}</p>

      {/* Fixed minimum height so the card never jumps as question length changes. */}
      <div className="mt-3 flex min-h-[19rem] flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className={`text-sm font-medium text-[var(--gold-ink)] ${current.isLadder ? "" : "invisible"}`}>
          One more, since that was easy{"\u2026"}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-strong">
          {current.item.statement}?
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
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => answerCurrent("skip")}
            className="text-sm text-subtle underline-offset-2 hover:underline"
          >
            skip this one
          </button>
          {easilyStreak >= 3 ? (
            <span className="font-hand text-lg text-sage">on a roll {"\u270e"}</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onExit}
        className="mt-6 text-sm text-subtle underline-offset-2 hover:underline"
      >
        finish later (everything so far is saved)
      </button>
    </div>
  );
}
