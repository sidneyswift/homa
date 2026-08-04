"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ageLabel } from "@homa/core";

import { QuietFrame } from "../../components/design";

/**
 * The beat between kids and the first question of a brand-new
 * questionnaire (founder feedback 2026-07-07: clicking "Start the
 * questionnaire(s)" cut straight to the first question with no
 * transition, no acknowledgment of what just happened). Same pattern as
 * ScoringStep (staged lines revealing with checkmarks, a minimum wait so
 * it never flashes by, a hand-written sign-off), reused rather than
 * inventing a second loading language for one flow. Only shown for a
 * kid who hasn't answered anything yet; resuming an in-progress
 * questionnaire skips straight back in, since there's nothing new to
 * announce.
 */

const LINE_STAGGER_MS = 550;
const MINIMUM_WAIT_MS = LINE_STAGGER_MS * 2 + 500;

function buildLines(name: string, ageMonths: number): string[] {
  return [`Looking at what's typical at ${ageLabel(ageMonths)}\u2026`, `Building ${name}'s questionnaire\u2026`];
}

export function PreparingStep({
  child,
  onDone,
}: {
  child: { name: string; ageMonths: number };
  onDone: () => void;
}) {
  const lineKey = `${child.name}:${child.ageMonths}`;
  const [lineState, setLineState] = useState({ key: lineKey, count: 1 });
  const lineCount = lineState.key === lineKey ? lineState.count : 1;
  const onDoneRef = useRef(onDone);
  const lines = useMemo(() => buildLines(child.name, child.ageMonths), [child.name, child.ageMonths]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timers = lines
      .slice(1)
      .map((_, index) =>
        setTimeout(() => {
          setLineState({ key: lineKey, count: index + 2 });
        }, (index + 1) * LINE_STAGGER_MS),
      );
    const finish = setTimeout(() => onDoneRef.current(), MINIMUM_WAIT_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [lineKey, lines]);

  return (
    <div aria-busy="true" data-brand-surface="onboarding-preparing" className="quiet-onboarding__loading mx-auto max-w-[28rem] text-center">
      <h1 className="quiet-onboarding__loading-heading quiet-onboarding__loading-heading--small">Getting ready&hellip;</h1>
      <QuietFrame as="div" tone="paper" data-brand-layer="onboarding-preparing-progress" className="quiet-onboarding__progress mt-6 p-6 text-left">
        {lines.slice(0, lineCount).map((line, index) => (
          <p key={index} className="quiet-onboarding__progress-line">
            <span className={`quiet-onboarding__progress-mark ${index < lineCount - 1 ? "quiet-onboarding__progress-mark--done" : ""}`.trim()} aria-hidden="true">
              {index < lineCount - 1 ? "\u2713" : "\u25cb"}
            </span>
            {line}
          </p>
        ))}
      </QuietFrame>
      <p className="quiet-onboarding__signature">let&apos;s go {"\u270e"}</p>
    </div>
  );
}
