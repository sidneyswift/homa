"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { useEffect, useState } from "react";

import {
  buildMapQuestionQueue,
  planQuestions,
  type MapAnswer,
} from "@homa/core";

import { Logo } from "../../components/brand/Logo";

/**
 * The two chat cards chat-first onboarding adds
 * (plans/2026-07-21-chat-first-onboarding.md §2.3, §2.5).
 *
 * Both follow the card contract every other card here follows: exactly
 * one card may be active (the newest with no message from her after it),
 * only the active one may carry a button, and everything above it
 * renders as a settled receipt so nothing in scrollback looks pressable.
 *
 * The checklist card is a POINTER, not a snapshot. It re-reads
 * /api/map/state every time it mounts, because the numbers it shows are
 * the one thing in the transcript that keeps changing after it was
 * written: she answers twelve more questions on her phone, opens the
 * laptop, and a card that had cached "12 left" would lie to her.
 */

interface MapStateChild {
  id: string;
  name: string;
  ageMonths: number;
  inRange: boolean;
  reportToken: string | null;
  answered: number;
  answers: { itemId: string; answer: MapAnswer }[];
}

/** The checklist screen's own constant, so the two never disagree. */
const SECONDS_PER_SUBJECT = 18;

export interface ChecklistPosition {
  answered: number;
  remaining: number;
  minutesLeft: number;
  complete: boolean;
  reportToken: string | null;
}

export function checklistPositionFor(child: MapStateChild): ChecklistPosition {
  const answerMap: Record<string, MapAnswer> = {};
  for (const entry of child.answers) answerMap[entry.itemId] = entry.answer;
  const remaining = buildMapQuestionQueue(
    planQuestions(child.ageMonths),
    answerMap,
  ).length;
  return {
    answered: child.answered,
    remaining,
    minutesLeft: Math.max(1, Math.ceil((remaining * SECONDS_PER_SUBJECT) / 60)),
    complete: child.answered > 0 && remaining === 0,
    reportToken: child.reportToken,
  };
}

async function fetchChecklistPosition(
  childId: string,
): Promise<ChecklistPosition | null> {
  try {
    const response = await fetch("/api/map/state", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      ok?: boolean;
      children?: MapStateChild[];
    };
    if (!data.ok) return null;
    const child = data.children?.find((entry) => entry.id === childId);
    return child ? checklistPositionFor(child) : null;
  } catch {
    return null;
  }
}

export interface ChecklistCardData {
  childId: string;
  childName: string;
  /** The counts as they were when the tool ran; replaced on mount. */
  answered: number;
  remaining: number;
  minutesLeft: number;
  resumed: boolean;
}

export function parseChecklistCardPart(
  part: EveMessagePart,
): ChecklistCardData | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "start_checklist" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.started !== true) return null;
  if (typeof output.childId !== "string" || typeof output.childName !== "string") {
    return null;
  }
  return {
    childId: output.childId,
    childName: output.childName,
    answered: typeof output.answered === "number" ? output.answered : 0,
    remaining: typeof output.remaining === "number" ? output.remaining : 0,
    minutesLeft: typeof output.minutesLeft === "number" ? output.minutesLeft : 1,
    resumed: output.resumed === true,
  };
}

export interface ActiveChecklistRequest {
  message: EveMessage;
  partKey: string;
  card: ChecklistCardData;
}

/**
 * The one checklist card that may still be opened: the newest with no
 * message from her after it. Same rule as the snap card, so two live
 * cards can never both want the screen.
 */
export function latestChecklistRequest(
  messages: readonly EveMessage[],
): ActiveChecklistRequest | null {
  let latest: ActiveChecklistRequest | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const card = parseChecklistCardPart(part);
      if (card) latest = { message, partKey: `${message.id}:${partIndex}`, card };
    }
  }
  return latest;
}

/**
 * The live receipt in the transcript. It fronts the questions rather
 * than containing them: the questions themselves take over the screen,
 * because that component carries six dated founder corrections and
 * re-rendering it inside a 26rem chat card would re-fight all six.
 */
export function ChecklistCard({
  card,
  active,
  onOpen,
}: {
  card: ChecklistCardData;
  active: boolean;
  onOpen?: (childId: string) => void;
}) {
  const [position, setPosition] = useState<ChecklistPosition | null>(null);

  useEffect(() => {
    let current = true;
    void fetchChecklistPosition(card.childId).then((next) => {
      if (current && next) setPosition(next);
    });
    return () => {
      current = false;
    };
  }, [card.childId]);

  const answered = position?.answered ?? card.answered;
  const remaining = position?.remaining ?? card.remaining;
  const minutesLeft = position?.minutesLeft ?? card.minutesLeft;
  const complete = position?.complete ?? false;
  const total = answered + remaining;
  const filled = total > 0 ? Math.round((answered / total) * 100) : 0;

  // Spent: a settled receipt, in the same pill grammar every other
  // finished thing uses. It taps through to what she earned, never back
  // into the questions.
  if (!active || complete) {
    return (
      <p className="inline-flex max-w-full items-baseline gap-1.5 self-start rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs">
        <span className="font-semibold text-sage">
          {complete ? "Questions done" : "Questions open"}
        </span>
        <span className="truncate text-body">
          {card.childName}
          {answered > 0 ? `, ${answered} ${answered === 1 ? "answer" : "answers"}` : ""}
        </span>
      </p>
    );
  }

  return (
    <section
      className="w-full max-w-[26rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      aria-label={`${card.childName}'s questions`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
          {card.childName}
        </span>
        <p className="shrink-0 font-mono text-xs text-subtle">
          {remaining <= 1 ? "almost done" : `about ${minutesLeft} min left`}
        </p>
      </div>
      {/* The hairline, not a rail: on a phone the full rail was a settled
          simplification and resurrecting it here would re-litigate it. */}
      <div
        className="mt-3 h-1 overflow-hidden rounded-pill bg-border-subtle"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-pill bg-brand transition-[width] duration-(--dur-base) ease-out"
          style={{ width: `${filled}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted">
        {answered > 0
          ? `Already learned ${answered} ${answered === 1 ? "thing" : "things"} about ${card.childName}. Stop whenever you like.`
          : `A few taps about ${card.childName}. Even five tells me a lot, and you can stop whenever you like.`}
      </p>
      <button
        type="button"
        disabled={onOpen === undefined}
        onClick={() => onOpen?.(card.childId)}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Logo size={17} variant="mark" />
        {card.resumed || answered > 0 ? "Pick up where you left off" : "Start the questions"}
      </button>
    </section>
  );
}

export interface ReportCardData {
  childId: string;
  childName: string;
  token: string;
  answered: number;
  skipped: number;
  mappedSubjects: number;
  totalSubjects: number;
  strengths: string[];
  alreadyScored: boolean;
}

export function parseReportCardPart(part: EveMessagePart): ReportCardData | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "score_child_report" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.scored !== true) return null;
  if (
    typeof output.childId !== "string" ||
    typeof output.childName !== "string" ||
    typeof output.token !== "string"
  ) {
    return null;
  }
  return {
    childId: output.childId,
    childName: output.childName,
    token: output.token,
    answered: typeof output.answered === "number" ? output.answered : 0,
    skipped: typeof output.skipped === "number" ? output.skipped : 0,
    mappedSubjects:
      typeof output.mappedSubjects === "number" ? output.mappedSubjects : 0,
    totalSubjects:
      typeof output.totalSubjects === "number" ? output.totalSubjects : 0,
    strengths: Array.isArray(output.strengths)
      ? output.strengths.filter((entry): entry is string => typeof entry === "string")
      : [],
    alreadyScored: output.alreadyScored === true,
  };
}

export interface ActiveReportReveal {
  message: EveMessage;
  partKey: string;
  card: ReportCardData;
}

export function latestReportReveal(
  messages: readonly EveMessage[],
): ActiveReportReveal | null {
  let latest: ActiveReportReveal | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const card = parseReportCardPart(part);
      if (card) latest = { message, partKey: `${message.id}:${partIndex}`, card };
    }
  }
  return latest;
}
