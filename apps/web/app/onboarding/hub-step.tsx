"use client";

import { useState } from "react";

import { Icon } from "../../components/design/Icon";
import { QuietAction, QuietFeedback, QuietFrame } from "../../components/design";

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
    <div className="quiet-onboarding__hub">
      <h1 className="quiet-onboarding__hub-heading">
        {welcomeBack ? "Welcome back" : "Your family"}
      </h1>
      <p className="quiet-onboarding__hub-intro">
        {childrenList.length === 0
          ? "Add your kids and we'll get mapping."
          : "Everything saves as you go. Pick up anywhere."}
      </p>

      <div className="quiet-onboarding__hub-cards">
        {childrenList.map((child) => {
          if (!child.inRange) {
            return (
              <QuietFrame
                as="article"
                key={child.id}
                className="quiet-onboarding__hub-card"
              >
                <QuietFeedback
                  tone="constructive"
                  title={child.name}
                  className="quiet-onboarding__hub-card-feedback"
                >
                  The questionnaire starts at age 2. I&apos;ll email you the moment {child.name}&apos;s is
                  ready. Everything you&apos;ve shared is saved.
                </QuietFeedback>
                <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
              </QuietFrame>
            );
          }
          if (child.reportToken) {
            return (
              <QuietFrame as="article" key={child.id} className="quiet-onboarding__hub-card">
                <p className="quiet-onboarding__hub-card-name">{child.name}</p>
                <p className="quiet-onboarding__hub-card-copy">The report is ready, and it&apos;s in your inbox too.</p>
                <QuietAction
                  href={`/onboarding/r/${child.reportToken}`}
                  size="large"
                  className="quiet-onboarding__hub-card-action"
                >
                  Open {child.name}&apos;s report
                </QuietAction>
                <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
              </QuietFrame>
            );
          }
          // All questions answered, report not built yet (she stepped
          // away at the finish line): the checklist has nothing left to
          // ask, so the honest action is the report itself.
          if (isChecklistComplete(child)) {
            return (
              <QuietFrame as="article" key={child.id} className="quiet-onboarding__hub-card">
                <p className="quiet-onboarding__hub-card-name">{child.name}</p>
                <p className="quiet-onboarding__hub-card-copy">Every question is answered. The report is one tap away.</p>
                <QuietAction
                  type="button"
                  onClick={() => onSeeReport(child.id)}
                  size="large"
                  className="quiet-onboarding__hub-card-action"
                >
                  See {child.name}&apos;s report
                </QuietAction>
                <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
              </QuietFrame>
            );
          }
          const started = child.answered > 0;
          return (
            <QuietFrame as="article" key={child.id} className="quiet-onboarding__hub-card">
              {/* Further simplified (2026-07-07, "subtitles are
                  unneeded"): the separate subtitle line is gone; the one
                  fact worth keeping, how many answers already exist,
                  now rides as a quiet parenthetical on the heading
                  itself instead of its own sentence below it. Nothing
                  shown at all once there's nothing to report ("About 5
                  minutes" was cut too, matching the reasoning it was
                  removed in on the checklist's first-question kicker). */}
              <p className="quiet-onboarding__hub-card-name">
                {child.name}
                {started ? (
                  <span className="quiet-onboarding__hub-card-saved">
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
              <QuietAction
                type="button"
                onClick={() => onStartChecklist(child.id)}
                aria-label={started ? "Continue the questionnaire" : `Start ${child.name}'s questionnaire`}
                size="large"
                className="quiet-onboarding__hub-card-action"
              >
                {started ? "Continue" : "Start"}
              </QuietAction>
              <RemoveKid childId={child.id} name={child.name} onRemoved={onChildRemoved} />
            </QuietFrame>
          );
        })}
      </div>

      {anyPending && childrenList.every((child) => !child.inRange) ? (
        <QuietFeedback tone="constructive" className="quiet-onboarding__hub-card-status">
          You&apos;re all set. We&apos;ll email you when the questionnaire is ready for their age.
        </QuietFeedback>
      ) : null}

      <div className="quiet-onboarding__hub-actions">
        {childrenList.length < MAP_KID_CAP ? (
          <QuietAction
            kind="secondary"
            size="large"
            type="button"
            onClick={onAddKids}
            className="quiet-onboarding__hub-add"
            icon={<Icon name="add" size={16} />}
          >
            add another kid
          </QuietAction>
        ) : null}
        {email ? (
          linkStatus === "sent" ? (
            <QuietFeedback tone="constructive" className="quiet-onboarding__hub-card-status">
              Link sent. It works on any device.
            </QuietFeedback>
          ) : (
            <>
              {linkStatus === "failed" ? (
                <QuietFeedback tone="error" className="quiet-onboarding__hub-card-status">
                  That link did not send. You can try again.
                </QuietFeedback>
              ) : null}
              <QuietAction
                kind="quiet"
                type="button"
                onClick={() => void emailMeThisLink()}
                disabled={linkStatus === "sending"}
                className="quiet-onboarding__hub-utility-action disabled:cursor-wait disabled:opacity-70"
                icon={<Icon name="chat" size={16} />}
              >
                {linkStatus === "sending" ? "sending…" : "email me this link (for later, or another device)"}
              </QuietAction>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
