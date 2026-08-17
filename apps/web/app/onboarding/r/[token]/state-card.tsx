import Link from "next/link";

import type { StateRequirementsSummary } from "../../../../lib/map/state-requirements";

import { reportButtonClass } from "./report-button";

/**
 * The state requirements card: the compliance data layer (migration #21)
 * surfaced where the fear lives, now closed by default (founder ask
 * 2026-07-08: progressive disclosure; the title is enough until she
 * wants it). Reference data is joined at render time, never copied into
 * the report row, so a statute change never strands a stale claim on
 * anyone's permanent URL. Laws of this card: reassure before inform,
 * always show the verification date, always name the boundary (this
 * report satisfies nothing), never legal advice.
 */
export function StateCard({
  summary,
  childName,
  statePackHref = null,
  className = "mt-9",
}: {
  summary: StateRequirementsSummary;
  childName: string;
  /** The report is shareable, while state-pack creation is family-scoped.
   * This door therefore opens the authenticated Binder instead of trying
   * to create a pack from the report token. */
  statePackHref?: string | null;
  /** Outer spacing, owned by the layout: the letter-style page flows
   * this after the subjects (mt-9, the default); the in-app dashboard
   * grid spaces cards itself and passes "". */
  className?: string;
}) {
  const verified = new Date(summary.sourceLastVerified).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
  const compulsory =
    summary.compulsoryStartAge !== null && summary.compulsoryEndAge !== null
      ? `ages ${summary.compulsoryStartAge} to ${summary.compulsoryEndAge}`
      : null;

  return (
    <details data-brand-layer="report-state" className={`quiet-report__state group ${className}`.trim()}>
      <summary className="quiet-report__state-summary">
        <span className="min-w-0">
          <span className="quiet-report__eyebrow">
            Your state {"\u00b7"} last verified {verified}
          </span>
          <span className="quiet-report__state-title">
            What {summary.stateName} asks of homeschooling families
          </span>
        </span>
        <span aria-hidden="true" className="quiet-report__state-chevron">
          {"\u25BE"}
        </span>
      </summary>
      <div className="quiet-report__state-body">
        <p className="quiet-report__body-copy">
          Homeschooling is legal in all 50 states, including {summary.stateName}. Here is how{" "}
          {summary.stateName} works, so nothing about it ever surprises you.
        </p>
        <ul className="quiet-report__state-list">
          <li>
            <span className="quiet-report__strong">Telling the state:</span>{" "}
            {summary.notificationRequired
              ? "some form of notification is part of the default path."
              : "no notification is required on the default path."}
          </li>
          <li>
            <span className="quiet-report__strong">Year-end check:</span>{" "}
            {summary.assessmentRequired
              ? "the default path asks for some year-end artifact, often with test-free options like an evaluator letter or a portfolio."
              : "the default path asks for no year-end artifact."}
          </li>
          {compulsory ? (
            <li>
              <span className="quiet-report__strong">School-age window:</span> {compulsory}.
            </li>
          ) : null}
          {summary.defaultPathway ? (
            <li>
              <span className="quiet-report__strong">Most families use:</span>{" "}
              {summary.defaultPathway}.
            </li>
          ) : null}
        </ul>
        <p className="quiet-report__fine-print">
          {childName}&apos;s progress report is your own answers, organized. It does not
          satisfy any state requirement of any kind, and different pathways in{" "}
          {summary.stateName} can carry different rules. Laws change, so the current statute is
          always worth a look before you act. This is not legal advice.
          {summary.sourcePageUrl ? (
            <>
              {" "}
              <a
                href={summary.sourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="quiet-report__source-link"
              >
                See the source
              </a>
              .
            </>
          ) : null}
        </p>
        {statePackHref ? (
          <div
            data-brand-layer="report-state-pack-entry"
            className="quiet-report__fine-print--spaced print:hidden"
          >
            <p className="quiet-report__body-copy">
              Homa can make one printable {summary.stateName} pack with current requirements,
              deadlines, and the attendance and subject records you save. Nothing is filed with
              the state.
            </p>
            <Link
              href={statePackHref}
              className={reportButtonClass(
                "secondary",
                "mt-3 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold",
              )}
            >
              Open the {summary.stateName} pack page
            </Link>
          </div>
        ) : (
          <p className="quiet-report__fine-print quiet-report__fine-print--spaced">
            When your invite opens, Homa tracks {summary.stateName}&apos;s requirements and
            deadlines for you.
          </p>
        )}
      </div>
    </details>
  );
}
