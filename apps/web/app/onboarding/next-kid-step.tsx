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
      <h1 className="font-display text-3xl font-bold leading-tight text-[var(--homa-ink)]">
        {nextKid.name}&apos;s questions now, or {reportLabel} first?
      </h1>

      <div className="mt-6 rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm">
        <p className="text-sm text-[var(--homa-muted-ink)]">
          {started
            ? `${nextKid.answered} answer${nextKid.answered === 1 ? "" : "s"} already saved. A few minutes finishes it.`
            : `Same questionnaire, tuned to ${nextKid.name}'s age. About five minutes.`}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onAnswerNext}
            className="min-h-12 w-full rounded-[var(--homa-radius-control)] border-[1.5px] border-[var(--homa-constructive-ink)] bg-transparent px-6 py-3 text-base font-semibold text-[var(--homa-constructive-ink)] transition duration-(--homa-motion-fast) ease-out hover:bg-[var(--homa-constructive-tint)] motion-safe:active:scale-[var(--press-scale)]"
          >
            {started
              ? `Continue ${nextKid.name}'s questionnaire`
              : `Start ${nextKid.name}'s questionnaire`}
          </button>
          <button
            type="button"
            onClick={onSeeReports}
            className="min-h-12 w-full rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-6 py-3 text-base font-semibold text-[var(--homa-paper)] shadow-sm transition duration-(--homa-motion-fast) ease-out hover:bg-[var(--homa-ink)] motion-safe:active:scale-[var(--press-scale)]"
          >
            See {reportLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
