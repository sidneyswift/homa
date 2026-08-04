"use client";

import { QuietAction, QuietFrame } from "../../components/design";
import type { FlowChild } from "./flow-types";

/**
 * The next-kid choice, shown after one kid's checklist and extras finish
 * while another in-range kid's questionnaire still has open questions
 * (founder call 2026-07-06: reaching the second or third kid's questions
 * must be easy, and the order is the parent's call, answer everyone first
 * or see each report as it lands. The ask itself stays under ten words).
 *
 * Button order follows the kids-step precedent, secondary detour above the
 * primary action, so the card reads in task order: answer the next kid, then
 * the report. Either choice loses nothing; picking the report keeps the
 * next kid one tap away on the report page's handoff card and the hub.
 */
export function NextKidStep({
  nextKid,
  pendingNames,
  onAnswerNext,
  onSeeReports,
}: {
  /** The kid whose questionnaire still has questions to ask. */
  nextKid: FlowChild;
  /** First names of kids answered this sitting, reports pending, in order. */
  pendingNames: string[];
  onAnswerNext: () => void;
  onSeeReports: () => void;
}) {
  const reportLabel = pendingNames.length === 1 ? `${pendingNames[0]}'s report` : "the reports";
  const started = nextKid.answered > 0;

  return (
    <div className="quiet-onboarding__step">
      <h1 className="quiet-onboarding__step-heading">
        {nextKid.name}&apos;s questions now, or {reportLabel} first?
      </h1>

      <QuietFrame className="quiet-onboarding__next-card">
        <p className="quiet-onboarding__next-copy">
          {started
            ? `${nextKid.answered} answer${nextKid.answered === 1 ? "" : "s"} already saved. A few minutes finishes it.`
            : `Same questionnaire, tuned to ${nextKid.name}'s age. About five minutes.`}
        </p>
        <div className="quiet-onboarding__next-actions">
          <QuietAction
            kind="secondary"
            size="large"
            type="button"
            onClick={onAnswerNext}
            className="w-full"
          >
            {started
              ? `Continue ${nextKid.name}'s questionnaire`
              : `Start ${nextKid.name}'s questionnaire`}
          </QuietAction>
          <QuietAction
            type="button"
            size="large"
            onClick={onSeeReports}
            className="w-full"
          >
            See {reportLabel}
          </QuietAction>
        </div>
      </QuietFrame>
    </div>
  );
}
