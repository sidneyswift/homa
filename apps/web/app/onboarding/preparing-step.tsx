"use client";

import { useEffect, useMemo, useState } from "react";

import { ageLabel } from "@homa/core";

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
  const [lineCount, setLineCount] = useState(1);
  const lines = useMemo(() => buildLines(child.name, child.ageMonths), [child.name, child.ageMonths]);

  useEffect(() => {
    const timers = lines
      .slice(1)
      .map((_, index) => setTimeout(() => setLineCount(index + 2), (index + 1) * LINE_STAGGER_MS));
    const finish = setTimeout(onDone, MINIMUM_WAIT_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
    // Runs once per kid: onDone is a fresh closure each render, but this
    // beat should never restart mid-flight because of a parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  return (
    <div aria-busy="true" className="mx-auto max-w-[28rem] text-center">
      <h1 className="font-display text-2xl font-bold leading-tight text-strong">Getting ready&hellip;</h1>
      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 text-left shadow-sm">
        {lines.slice(0, lineCount).map((line, index) => (
          <p key={index} className="mt-2 flex items-center gap-2 text-body first:mt-0">
            <span className={index < lineCount - 1 ? "text-sage" : "text-subtle"} aria-hidden="true">
              {index < lineCount - 1 ? "\u2713" : "\u25cb"}
            </span>
            {line}
          </p>
        ))}
      </div>
      <p className="mt-4 font-hand text-xl text-sage">let&apos;s go {"\u270e"}</p>
    </div>
  );
}
