"use client";

import { useState } from "react";

import type { FlowChild } from "./flow-types";
import { TagInput } from "./tag-input";

/**
 * The extras step: optional context collected AFTER the checklist, right
 * before the report (read-through ruling: she's invested now, and these
 * answers make the report and the future product better).
 *
 * UX review 2026-07-06 (approved in full): dieted from nine asks to the
 * two that feed the report itself, interests (they end up in the
 * materials) and help-with (it shapes the report's note). The "About
 * your homeschool" block (style, curriculums, values) now has its own
 * homeschool step earlier in onboarding (homeschool-step.tsx); the
 * remaining asks (activities, crew, notes) belong to the product proper,
 * not the lead flow. Everything here is still skippable in one tap.
 */

function interestSuggestions(ageMonths: number): readonly string[] {
  if (ageMonths < 96) {
    return ["dinosaurs", "horses", "space", "princesses", "trucks", "bugs", "ocean", "drawing", "music", "animals"];
  }
  return ["sports", "music", "gaming", "drawing", "reading", "animals", "building things", "science", "cooking", "fashion"];
}

function helpSuggestions(ageMonths: number): readonly string[] {
  if (ageMonths < 60) {
    return ["letters", "counting", "writing their name", "scissors", "colors and shapes", "calm-down skills"];
  }
  if (ageMonths < 96) {
    return ["reading", "handwriting", "math", "focus", "science curiosity", "confidence"];
  }
  return ["reading", "writing", "math", "focus", "study habits", "confidence"];
}

export function ExtrasStep({
  child,
  hasNextKid = false,
  pendingReportCount = 1,
  onDone,
}: {
  child: FlowChild;
  /** Whether another kid's questions are still open, so the next screen
   * is the next-kid choice rather than the report. */
  hasNextKid?: boolean;
  /** How many kids' reports this sitting has queued up (this kid
   * included), so the copy says "the reports" when several are coming. */
  pendingReportCount?: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [helpWith, setHelpWith] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  /** One save at the end, with whatever she chose along the way: skipping
   * the second question must never throw away the first one's answers. */
  async function finish() {
    setBusy(true);
    if (interests.length > 0 || helpWith.length > 0) {
      try {
        await fetch("/api/map/extras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            child: {
              childId: child.id,
              interests: interests.length > 0 ? interests : undefined,
              helpWith: helpWith.length > 0 ? helpWith : undefined,
            },
          }),
        });
      } catch {
        // Extras are a bonus, never a blocker: the report proceeds regardless.
      }
    }
    onDone();
  }

  // "See the report" would lie when the next-kid choice comes first; the
  // button only promises the report when the report is truly next. With
  // several kids' reports queued this sitting, the landing report is the
  // first kid's, so the label goes plural instead of naming the wrong kid.
  const reportIsNext = !hasNextKid;
  const finishLabel = !reportIsNext
    ? "Continue"
    : pendingReportCount > 1
      ? "See the reports"
      : `See ${child.name}'s progress report`;
  const finishSkipLabel = !reportIsNext
    ? "skip this"
    : pendingReportCount > 1
      ? "skip this, show the reports"
      : "skip this, show the report";

  return (
    <div>
      {/* Completion gets the hand-note celebration (the house playful
          device, same family as "on a roll" and "worth the wait"), so the
          headline can be ONE beat instead of the old "Done. The report is
          next." fragment pair. The subtitle is gone: "skippable" is the
          skip link's job, and "makes the report fit better" rides in the
          first question's hint. One question per card (founder call
          2026-07-06: "these should be separated, one question at a
          time"), same rhythm as the questionnaire itself. */}
      <p className="font-hand text-2xl text-sage">questionnaire done {"\u2713"}</p>
      {/* "while I build" is honest only when the report is actually next;
          with another kid's questions still open, the build may wait on
          the next-kid choice one screen later. And once several reports
          are queued, "the reports" beats naming only this kid. */}
      <h1 className="mt-1 font-display text-3xl font-bold leading-tight text-strong">
        {hasNextKid
          ? `Two quick extras about ${child.name}`
          : pendingReportCount > 1
            ? "Two quick extras while I build the reports"
            : `Two quick extras while I build ${child.name}'s report`}
      </h1>

      <div
        key={step}
        className="flow-step-in mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-[var(--shadow-md)] sm:p-7"
      >
        <p className="font-mono text-xs text-subtle">extra {step + 1} of 2</p>

        {step === 0 ? (
          <>
            <TagInput
              className="mt-3"
              label={`What is ${child.name} loving right now?`}
              hint="Tap or type anything. It ends up in their materials."
              suggestions={interestSuggestions(child.ageMonths)}
              tags={interests}
              setTags={setInterests}
              max={12}
            />
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-7 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-2 w-full text-center text-sm text-subtle underline-offset-2 hover:underline"
            >
              skip this one
            </button>
          </>
        ) : (
          <>
            {/* "Where should Homa start", not "what do you want help
                with" (founder 2026-07-08: that phrasing is too open
                ended): the chips below ARE the answer space, and the
                question asks for a starting point, not an inventory of
                needs. */}
            <TagInput
              className="mt-3"
              label={`Where should Homa start with ${child.name}?`}
              aside="pick as many as you like"
              suggestions={helpSuggestions(child.ageMonths)}
              tags={helpWith}
              setTags={setHelpWith}
              max={6}
            />
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="mt-7 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
            >
              {busy ? "Saving\u2026" : finishLabel}
            </button>
            <div className="mt-2 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={busy}
                className="text-sm text-subtle underline-offset-2 hover:underline"
              >
                back
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={busy}
                className="text-sm text-subtle underline-offset-2 hover:underline"
              >
                {finishSkipLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
