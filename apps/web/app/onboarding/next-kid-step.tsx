"use client";

import type { FlowChild } from "./flow-types";

/**
 * The next-kid choice, shown after one kid's checklist and extras finish
 * while another in-range kid's questionnaire still has open questions
 * (founder call 2026-07-06: reaching the second or third kid's questions
 * must be easy, and the order is the parent's call, answer everyone first
 * or see each report as it lands. The ask itself stays under ten words).
 *
 * Button order follows the kids-step precedent, secondary detour above the
 * clay primary, so the card reads in task order: answer the next kid, then
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
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        {nextKid.name}&apos;s questions now, or {reportLabel} first?
      </h1>

      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <p className="text-sm text-muted">
          {started
            ? `${nextKid.answered} answer${nextKid.answered === 1 ? "" : "s"} already saved. A few minutes finishes it.`
            : `Same questionnaire, tuned to ${nextKid.name}'s age. About five minutes.`}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAnswerNext}
            className="min-h-12 w-full rounded-pill border-[1.5px] border-[var(--sage-300)] bg-transparent px-6 py-3 text-base font-semibold text-[var(--sage-700)] transition duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] motion-safe:active:scale-[var(--press-scale)]"
          >
            {started
              ? `Continue ${nextKid.name}'s questionnaire`
              : `Start ${nextKid.name}'s questionnaire`}
          </button>
          <button
            type="button"
            onClick={onSeeReports}
            className="min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
          >
            See {reportLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
