"use client";

import { useState } from "react";

import { MAP_KID_CAP } from "@homa/core";

import type { FlowChild } from "./flow-types";
import { isChecklistComplete } from "./question-queue";
import { RemoveKid } from "./remove-kid";

/**
 * The family hub: one card per child with the honest next action. Map
 * ready, questionnaire done and waiting on its report, checklist in
 * progress, not started, or the sage promise for ages whose bands haven't
 * shipped. Doubles as the welcome-back screen.
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
  const [linkSent, setLinkSent] = useState(false);

  async function emailMeThisLink() {
    if (!email) return;
    try {
      await fetch("/api/map/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setLinkSent(true);
    } catch {
      setLinkSent(true);
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
              <div key={child.id} className="rounded-lg border border-sage/40 bg-[var(--accent-sage-soft)] p-5">
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
              <div key={child.id} className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
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
              <div key={child.id} className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
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
            <div key={child.id} className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
              <p className="font-display text-lg font-semibold text-strong">{child.name}</p>
              <p className="mt-1 text-body">
                {started
                  ? `${child.answered} answer${child.answered === 1 ? "" : "s"} saved. A few minutes finishes the report.`
                  : "About 5 minutes, from what you've seen them do."}
              </p>
              <button
                type="button"
                onClick={() => onStartChecklist(child.id)}
                className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
              >
                {started ? "Continue the questionnaire" : `Start ${child.name}'s questionnaire`}
              </button>
              <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
            </div>
          );
        })}
      </div>

      {anyPending && childrenList.every((child) => !child.inRange) ? (
        <p className="mt-4 text-body">
          You&apos;re on the invite list. Your invite comes by email.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 text-sm">
        {childrenList.length < MAP_KID_CAP ? (
          <button
            type="button"
            onClick={onAddKids}
            className="self-start text-brand underline-offset-2 hover:underline"
          >
            add another kid
          </button>
        ) : null}
        {email ? (
          linkSent ? (
            <p className="text-muted">Link sent. It works on any device.</p>
          ) : (
            <button
              type="button"
              onClick={() => void emailMeThisLink()}
              className="self-start text-brand underline-offset-2 hover:underline"
            >
              email me this link (for later, or another device)
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
