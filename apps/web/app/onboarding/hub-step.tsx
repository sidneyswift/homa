"use client";

import { useState } from "react";
import { Mail, Plus } from "lucide-react";

import { MAP_KID_CAP } from "@homa/core";

import type { FlowChild } from "./flow-types";
import { isChecklistComplete } from "./question-queue";
import { RemoveKid } from "./remove-kid";

/**
 * The family hub: one card per child with the honest next action. Map
 * ready, questionnaire done and waiting on its report, checklist in
 * progress, not started, or the sage promise for ages whose bands haven't
 * shipped. Doubles as the welcome-back screen.
 *
 * Follow-up (2026-07-07, "how can we make these better design"): the two
 * actions below the cards were bare colored text links of identical
 * weight, even though they're not the same kind of action. "Add
 * another kid" is a real, likely-used action, promoted to a proper
 * secondary pill button (the sage-outline treatment used elsewhere for
 * secondary actions). "Email me this link" is a safety-net utility, one
 * she reaches for rarely, so it stays a quiet text link, just with a
 * small icon for scannability.
 */
export function HubStep({
  childrenList,
  email,
  welcomeBack,
  onStartChecklist,
  onSeeReport,
  onAddKids,
  onChildRemoved,
}: {
  childrenList: FlowChild[];
  email: string | null;
  welcomeBack: boolean;
  onStartChecklist: (childId: string) => void;
  /** For a kid whose questions are all answered but whose report hasn't
   * been built yet: sends the flow to scoring (via signup if needed). */
  onSeeReport: (childId: string) => void;
  onAddKids: () => void;
  onChildRemoved: () => void;
}) {
  const [linkStatus, setLinkStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function emailMeThisLink() {
    if (!email || linkStatus === "sending") return;
    setLinkStatus("sending");
    try {
      const response = await fetch("/api/map/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setLinkStatus(response.ok ? "sent" : "failed");
    } catch {
      setLinkStatus("failed");
    }
  }

  const anyPending = childrenList.some((child) => !child.inRange);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        {welcomeBack ? "Welcome back" : "Your family"}
      </h1>
      <p className="mt-3 text-body">
        {childrenList.length === 0
          ? "Add your kids and we'll get mapping."
          : "Everything saves as you go. Pick up anywhere."}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {childrenList.map((child) => {
          if (!child.inRange) {
            return (
              <div
                key={child.id}
                className="relative rounded-lg border border-sage/40 bg-[var(--accent-sage-soft)] p-5"
              >
                <p className="font-display text-lg font-semibold text-strong">{child.name}</p>
                <p className="mt-1 text-body">
                  The questionnaire starts at age 2. I&apos;ll email you the moment {child.name}&apos;s is
                  ready. Everything you&apos;ve shared is saved.
                </p>
                <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
              </div>
            );
          }
          if (child.reportToken) {
            return (
              <div key={child.id} className="relative rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
                <p className="font-display text-lg font-semibold text-strong">{child.name}</p>
                <p className="mt-1 text-body">The report is ready, and it&apos;s in your inbox too.</p>
                <a
                  href={`/onboarding/r/${child.reportToken}`}
                  className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition duration-(--dur-fast) ease-out hover:bg-brand-hover"
                >
                  Open {child.name}&apos;s report
                </a>
                <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
              </div>
            );
          }
          // All questions answered, report not built yet (she stepped
          // away at the finish line): the checklist has nothing left to
          // ask, so the honest action is the report itself.
          if (isChecklistComplete(child)) {
            return (
              <div key={child.id} className="relative rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
                <p className="font-display text-lg font-semibold text-strong">{child.name}</p>
                <p className="mt-1 text-body">Every question is answered. The report is one tap away.</p>
                <button
                  type="button"
                  onClick={() => onSeeReport(child.id)}
                  className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
                >
                  See {child.name}&apos;s report
                </button>
                <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
              </div>
            );
          }
          const started = child.answered > 0;
          return (
            <div key={child.id} className="relative rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
              {/* Further simplified (2026-07-07, "subtitles are
                  unneeded"): the separate subtitle line is gone; the one
                  fact worth keeping, how many answers already exist,
                  now rides as a quiet parenthetical on the heading
                  itself instead of its own sentence below it. Nothing
                  shown at all once there's nothing to report ("About 5
                  minutes" was cut too, matching the reasoning it was
                  removed in on the checklist's first-question kicker). */}
              <p className="font-display text-lg font-semibold text-strong">
                {child.name}
                {started ? (
                  <span className="font-normal text-muted">
                    {" "}
                    ({child.answered} answer{child.answered === 1 ? "" : "s"} saved)
                  </span>
                ) : null}
              </p>
              {/* Fixed, equal width (2026-07-07, "buttons should be the
                  same size"): "Continue" and "Start" used to size to
                  their own text, so two cards side by side never lined
                  up. The accessible name still carries the full
                  sentence for a screen reader user pulling up a bare
                  list of buttons. */}
              <button
                type="button"
                onClick={() => onStartChecklist(child.id)}
                aria-label={started ? "Continue the questionnaire" : `Start ${child.name}'s questionnaire`}
                className="mt-3 inline-flex min-h-11 w-28 items-center justify-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
              >
                {started ? "Continue" : "Start"}
              </button>
              <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
            </div>
          );
        })}
      </div>

      {anyPending && childrenList.every((child) => !child.inRange) ? (
        <p className="mt-4 text-body">
          You&apos;re all set. We&apos;ll email you when the questionnaire is ready for their age.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {childrenList.length < MAP_KID_CAP ? (
          <button
            type="button"
            onClick={onAddKids}
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-pill border-[1.5px] border-[var(--sage-300)] px-4 py-2 text-sm font-semibold text-[var(--sage-700)] transition duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] motion-safe:active:scale-[var(--press-scale)]"
          >
            <Plus size={15} aria-hidden="true" />
            add another kid
          </button>
        ) : null}
        {email ? (
          linkStatus === "sent" ? (
            <p className="text-sm text-muted">Link sent. It works on any device.</p>
          ) : (
            <>
              {linkStatus === "failed" ? (
                <p className="text-sm text-body">That link did not send. You can try again.</p>
              ) : null}
              <button
                type="button"
                onClick={() => void emailMeThisLink()}
                disabled={linkStatus === "sending"}
                className="inline-flex items-center gap-1.5 self-start text-sm text-muted underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-strong hover:underline disabled:cursor-wait disabled:opacity-70"
              >
                <Mail size={14} aria-hidden="true" />
                {linkStatus === "sending" ? "sending..." : "email me this link (for later, or another device)"}
              </button>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
